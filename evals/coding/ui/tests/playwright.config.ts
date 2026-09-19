import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: import.meta.dir,
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 20000,
  outputDir: resolve('.agent-evals/ui/ux-tests'),
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3417',
    ...(process.env.EVAL_BROWSER_WS_ENDPOINT
      ? { connectOptions: { wsEndpoint: process.env.EVAL_BROWSER_WS_ENDPOINT } }
      : { channel: process.env.EVAL_BROWSER_CHANNEL ?? 'chrome' }),
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun run eval:coding:ui',
    url: 'http://127.0.0.1:3417',
    env: { EVAL_UI_PORT: '3417' },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
