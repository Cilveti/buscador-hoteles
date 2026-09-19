import { resolve } from 'node:path';
import { test as base, expect } from '@playwright/test';
import { loadAccess } from '../../../../scripts/coding-eval-ui/access';

export { expect };
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    await page.addInitScript(
      ({ origin, token }) => {
        if (location.origin === origin) localStorage.setItem('harness-lab-access', token);
      },
      { origin: baseURL, token: loadAccess(resolve('.agent-evals/ui/access.json')) },
    );
    await use(page);
  },
});
