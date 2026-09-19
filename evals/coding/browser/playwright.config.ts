import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const directory = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(process.env.EVAL_BROWSER_OUTPUT ?? '.agent-evals/browser');
const baseURL = `http://127.0.0.1:${process.env.EVAL_BROWSER_PORT ?? '3413'}`;
export default defineConfig({
  testDir: directory,
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 20_000,
  reporter: [
    ['list'],
    ['json', { outputFile: resolve(output, 'results.json') }],
    ['html', { outputFolder: resolve(output, 'report'), open: 'never' }],
  ],
  outputDir: resolve(output, 'test-results'),
  use: {
    baseURL,
    ...(process.env.EVAL_BROWSER_WS_ENDPOINT
      ? { connectOptions: { wsEndpoint: process.env.EVAL_BROWSER_WS_ENDPOINT } }
      : { channel: process.env.EVAL_BROWSER_CHANNEL ?? 'chrome' }),
    viewport: { width: 1440, height: 1000 },
    trace: 'on',
    screenshot: 'on',
    serviceWorkers: 'block',
  },
  webServer: {
    command: `bun '${resolve(directory, 'server.ts').replaceAll("'", "'\\''")}'`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      EVAL_PROJECT_ROOT: resolve(process.env.EVAL_PROJECT_ROOT ?? process.cwd()),
      EVAL_BROWSER_OUTPUT: output,
      EVAL_BROWSER_PORT: process.env.EVAL_BROWSER_PORT ?? '3413',
    },
  },
});
