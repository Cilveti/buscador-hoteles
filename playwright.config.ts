import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://127.0.0.1:3101', channel: 'chrome', trace: 'off', screenshot: 'off' },
  webServer: {
    command: 'bun run dev:full',
    url: 'http://127.0.0.1:3101/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
