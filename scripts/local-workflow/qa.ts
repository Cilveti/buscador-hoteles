import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { chromium, expect, type Page } from '@playwright/test';
import { type AgentAssignments, callAgent } from './agents';
import { actionSchema, type BrowserAction, type Specification, validQaFinish } from './contracts';
import { stop } from './process';
import { qaPrompt } from './prompts';

export function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('No local port'));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

/** Chrome is owned by the controller; sandboxed workers use Playwright's existing connection. */
export async function withBrowserChecks<T>(
  output: string,
  run: (environment: Record<string, string>) => Promise<T>,
  endpoint?: string,
): Promise<T> {
  const port = await availablePort();
  if (endpoint)
    return run({
      TEST_BROWSER_PORT: String(port),
      TEST_BROWSER_OUTPUT: output,
      TEST_BROWSER_WS_ENDPOINT: endpoint,
    });
  const browser = await chromium.launchServer({
    channel: process.env.TEST_BROWSER_CHANNEL ?? 'chrome',
    headless: true,
    host: '127.0.0.1',
  });
  try {
    return await run({
      TEST_BROWSER_PORT: String(port),
      TEST_BROWSER_OUTPUT: output,
      TEST_BROWSER_WS_ENDPOINT: browser.wsEndpoint(),
    });
  } finally {
    await browser.close();
  }
}

/** Narrow browser actions: no arbitrary JavaScript, file access or navigation to other origins. */
export async function act(page: Page, action: BrowserAction, baseURL: string): Promise<void> {
  const locator = () => {
    if (action.role === 'none') throw new Error('This action requires an accessible role');
    return page.getByRole(action.role, { name: action.name, exact: true });
  };
  switch (action.action) {
    case 'navigate': {
      const url = new URL(action.value, baseURL);
      if (url.origin !== baseURL) throw new Error('QA navigation is limited to the local app');
      await page.goto(url.href);
      break;
    }
    case 'click':
      await locator().click();
      break;
    case 'fill':
      await locator().fill(action.value);
      break;
    case 'select':
      await locator().selectOption(action.value);
      break;
    case 'press':
      await locator().press(action.value);
      break;
    case 'back':
      await page.goBack();
      break;
    case 'expect-text':
      await expect(page.getByText(action.value, { exact: true })).toBeVisible();
      break;
    case 'expect-url':
      await expect(page).toHaveURL(new URL(action.value, baseURL).href);
      break;
    case 'inspect':
    case 'finish':
      break;
  }
}

type QaOptions = {
  agents: AgentAssignments | undefined;
  root: string;
  output: string;
  spec: Specification;
  headed?: boolean;
  maxSteps?: number;
  browserEndpoint?: string;
  permissionArgs?: string[];
  persistSessions?: boolean;
};

async function waitForApp(
  server: ReturnType<typeof spawn>,
  baseURL: string,
  getLaunchError: () => Error | undefined,
): Promise<void> {
  let ready = false;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const launchError = getLaunchError();
    if (launchError) throw launchError;
    if (server.exitCode !== null) throw new Error('QA app exited; see app.log');
    try {
      ready = (await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(800) })).ok;
    } catch {}
    if (ready) break;
    await Bun.sleep(200);
  }
  if (!ready) throw new Error('QA app did not become healthy in 60 seconds');
}

export async function runQa(options: QaOptions) {
  mkdirSync(options.output, { recursive: true });
  const port = await availablePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const serverLog = openSync(join(options.output, 'app.log'), 'wx', 0o600);
  const server = spawn('bun', ['tests/browser/server.ts'], {
    cwd: options.root,
    detached: true,
    stdio: ['ignore', serverLog, serverLog],
    env: {
      ...process.env,
      TEST_BROWSER_PORT: String(port),
      TEST_BROWSER_OUTPUT: join(options.output, 'app'),
    },
  });
  let launchError: Error | undefined;
  server.on('error', (error) => {
    launchError = error;
  });
  const cancel = () => stop(server.pid);
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const history: {
    action: BrowserAction;
    outcome: string;
    screenshot: string;
    before: string;
  }[] = [];
  const screenshots: string[] = [];
  try {
    await waitForApp(server, baseURL, () => launchError);
    browser = options.browserEndpoint
      ? await chromium.connect(options.browserEndpoint)
      : await chromium.launch({ channel: 'chrome', headless: !options.headed });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      serviceWorkers: 'block',
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort(),
    );
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    const page = await context.newPage();
    const requests: { method: string; path: string }[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin === baseURL && url.pathname.startsWith('/api/'))
        requests.push({ method: request.method(), path: `${url.pathname}${url.search}` });
    });
    page.setDefaultTimeout(8000);
    await page.goto(baseURL);
    try {
      for (let step = 0; step < (options.maxSteps ?? 16); step++) {
        await page.waitForLoadState('networkidle');
        const screenshot = `screen-${String(step).padStart(2, '0')}.png`;
        const image = join(options.output, screenshot);
        await page.screenshot({ path: image, fullPage: true });
        screenshots.push(screenshot);
        const focus = await page.evaluate(() => ({
          tag: document.activeElement?.tagName ?? null,
          label: document.activeElement?.getAttribute('aria-label') ?? null,
          id: document.activeElement?.id ?? null,
        }));
        const tree = (await page.locator('body').ariaSnapshot()).slice(0, 25_000);
        const state = `URL: ${page.url()}\nFOCUS: ${JSON.stringify(focus)}\nAPI REQUEST COUNT: ${requests.length}`;
        const observation = `${state}\nAPI REQUESTS: ${JSON.stringify(requests)}\n${tree}`;
        writeFileSync(
          join(options.output, `screen-${String(step).padStart(2, '0')}.txt`),
          observation,
        );
        const action = await callAgent(
          options.agents,
          {
            role: 'qa',
            root: options.root,
            output: join(options.output, `step-${step}`),
            images: [image],
            timeoutSeconds: 180,
            permissionArgs: options.permissionArgs,
            persistSession: options.persistSessions,
            prompt: qaPrompt({
              spec: options.spec,
              url: page.url(),
              baseURL,
              screenshot,
              observation,
              history,
              remainingActions: (options.maxSteps ?? 16) - step,
              screenshots,
            }),
          },
          actionSchema,
        );
        if (action.action === 'finish') {
          if (!validQaFinish(options.spec, action, screenshots))
            throw new Error('QA returned incomplete criteria or nonexistent evidence');
          const report = {
            passed: action.results.every((result) => result.status === 'pass'),
            results: action.results,
            history,
            screenshots,
            requests,
            baseURL,
            scope: 'React + HTTP + core; synthetic catalog, no persistence/SSR',
          };
          writeFileSync(join(options.output, 'qa.json'), JSON.stringify(report, null, 2));
          return report;
        }
        let outcome = 'Action executed; verify the resulting observation before asserting success.';
        try {
          await act(page, action, baseURL);
        } catch (error) {
          outcome = `FAILED: ${error instanceof Error ? error.message : String(error)}`;
        }
        history.push({ action, outcome, screenshot, before: `${state}\n${tree.slice(0, 8000)}` });
        writeFileSync(join(options.output, 'actions.json'), JSON.stringify(history, null, 2));
      }
      throw new Error('QA reached its action limit without a complete verdict');
    } finally {
      writeFileSync(join(options.output, 'requests.json'), JSON.stringify(requests, null, 2));
      await context.tracing.stop({ path: join(options.output, 'trace.zip') });
    }
  } finally {
    await browser?.close();
    stop(server.pid);
    closeSync(serverLog);
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}
