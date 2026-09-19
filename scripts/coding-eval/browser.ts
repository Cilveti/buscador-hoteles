import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

type BrowserLease = {
  endpoint: string;
  close: () => Promise<void>;
};

export function browserDeniedRoots(extra: string[] = []) {
  return [
    ...new Set(
      [
        process.cwd(),
        join(homedir(), '.codex'),
        join(homedir(), '.local/share/hoteles-harness-evals'),
        ...['Codex', 'com.openai.codex', 'com.openai.atlas', 'OpenAI'].map((name) =>
          join(homedir(), 'Library/Application Support', name),
        ),
        ...(process.env.EVAL_PRIVATE_READ_ROOTS ?? '').split(delimiter).filter(Boolean),
        ...extra,
      ]
        .filter(existsSync)
        .map((path) => realpathSync(path)),
    ),
  ];
}

/** Chrome keeps its normal OS capabilities, but cannot read or write controller/private files. */
export function browserProfile(roots: string[]) {
  return `(version 1)\n(allow default)\n${roots.map((path) => `(deny file-read* file-write* (subpath ${JSON.stringify(path)}))`).join('\n')}\n`;
}

/** Retry only an inconclusive navigation timeout; readable files and other errors fail closed. */
export async function probePrivateBrowserFile(navigate: () => Promise<unknown>) {
  const attempts: { denied: boolean; error: string | null }[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await navigate();
      attempts.push({ denied: false, error: null });
      break;
    } catch (failure) {
      const error = String(failure);
      const denied = /net::ERR_(FILE_NOT_FOUND|ACCESS_DENIED)/.test(error);
      attempts.push({ denied, error });
      if (denied || !(failure instanceof Error && failure.name === 'TimeoutError')) break;
    }
  }
  return { denied: attempts.at(-1)?.denied === true, attempts };
}

async function launchEvaluationBrowser(deniedRoots: string[] = []): Promise<BrowserLease> {
  if (process.platform !== 'darwin')
    throw new Error('Private browser filesystem isolation currently requires macOS.');
  const channel = process.env.EVAL_BROWSER_CHANNEL ?? 'chrome';
  const executable =
    process.env.EVAL_BROWSER_EXECUTABLE ??
    (channel === 'chrome'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : channel === 'chromium'
        ? chromium.executablePath()
        : null);
  if (!executable || !existsSync(executable))
    throw new Error(
      `Browser executable unavailable for ${channel}; set EVAL_BROWSER_EXECUTABLE explicitly.`,
    );
  const directory = mkdtempSync(join(tmpdir(), 'hoteles-private-browser-'));
  const profile = join(directory, 'browser.sb');
  const wrapper = join(directory, 'chrome');
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  writeFileSync(profile, browserProfile(browserDeniedRoots(deniedRoots)), { mode: 0o600 });
  writeFileSync(
    wrapper,
    `#!/bin/sh\ncd /private/tmp\nexec /usr/bin/sandbox-exec -f ${quote(profile)} ${quote(executable)} "$@"\n`,
    { mode: 0o700 },
  );
  try {
    const server = await chromium.launchServer({
      executablePath: wrapper,
      headless: true,
      host: '127.0.0.1',
      port: 0,
    });
    try {
      const outputRoot = join(process.cwd(), '.agent-evals/browser-isolation');
      mkdirSync(outputRoot, { recursive: true });
      const evidence = mkdtempSync(join(outputRoot, 'probe-'));
      const sentinel = join(evidence, 'private.txt');
      writeFileSync(sentinel, 'PRIVATE_BROWSER_SENTINEL');
      const connection = await chromium.connect(server.wsEndpoint());
      try {
        const context = await connection.newContext();
        try {
          const page = await context.newPage();
          const probe = await probePrivateBrowserFile(() =>
            page.goto(pathToFileURL(sentinel).href, { timeout: 30_000, waitUntil: 'commit' }),
          );
          writeFileSync(
            join(evidence, 'result.json'),
            JSON.stringify(
              {
                checkedAt: new Date().toISOString(),
                ...probe,
                roots: browserDeniedRoots(deniedRoots),
                profile: browserProfile(browserDeniedRoots(deniedRoots)),
              },
              null,
              2,
            ),
          );
          if (!probe.denied)
            throw new Error(`Private browser isolation could not be confirmed; see ${evidence}`);
        } finally {
          await context.close();
        }
      } finally {
        await connection.close();
      }
    } catch (error) {
      await server.close();
      throw error;
    }
    return {
      endpoint: server.wsEndpoint(),
      close: async () => {
        try {
          await server.close();
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

/** Keep a fresh protected browser/profile alive until delivery, then release it. */
export async function withEvaluationBrowser<T>(
  run: (endpoint: string) => Promise<T>,
  launch: (deniedRoots?: string[]) => Promise<BrowserLease> = launchEvaluationBrowser,
  deniedRoots: string[] = [],
): Promise<T> {
  const browser = await launch(deniedRoots);
  try {
    return await run(browser.endpoint);
  } finally {
    await browser.close();
  }
}
