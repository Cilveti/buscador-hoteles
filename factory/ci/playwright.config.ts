import { defineConfig } from '@playwright/test';

/** Real Next/Payload/PostgreSQL E2E, separate from the fast browser fixture suite. */
export default defineConfig({
  projects: [
    { name: 'application', testDir: '../../tests/e2e' },
    ...(process.env.FACTORY_DESIGN_ID === 'hotel-empty-v1'
      ? [{ name: 'penpot', testDir: '../checks/browser', testMatch: '**/*.pw.ts' }]
      : []),
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  outputDir: '/evidence/e2e/artifacts',
  reporter: [
    ['list'],
    ['json', { outputFile: '/evidence/e2e/results.json' }],
    ['html', { outputFolder: '/evidence/e2e/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3101',
    browserName: 'chromium',
    headless: true,
    trace: 'on',
    screenshot: 'on',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'bun run dev:full',
    url: 'http://127.0.0.1:3101/api/health',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
