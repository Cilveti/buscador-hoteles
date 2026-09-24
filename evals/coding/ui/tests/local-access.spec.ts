import { resolve } from 'node:path';
import { loadAccess } from '../../../../scripts/coding-eval-ui/access';
import { expect, test } from './fixtures';

test('localhost recupera el acceso previo y permite volver con la URL sin clave', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  const token = loadAccess(resolve('.agent-evals/ui/access.json'));
  const legacy = new URL(baseURL ?? 'http://127.0.0.1:3417');
  legacy.hostname = '127.0.0.1';
  const local = new URL(legacy);
  local.hostname = 'localhost';
  try {
    await context.addInitScript(
      ({ origin, token }) => {
        if (location.origin === origin) localStorage.setItem('harness-lab-access', token);
      },
      { origin: legacy.origin, token },
    );
    const page = await context.newPage();
    await page.goto(local.href);
    await expect(page.getByRole('heading', { name: 'Evaluaciones', exact: true })).toBeVisible();
    expect(page.url()).toBe(local.href);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Evaluaciones', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Workflows', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sala de control' })).toBeVisible();
    expect((await context.request.get(`${local.origin}/api/bootstrap`)).status()).toBe(403);
    expect(
      (
        await context.request.get(`${local.origin}/api/bootstrap`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await context.request.get(local.href, { headers: { Host: 'external.example' } })).status(),
    ).toBe(403);
  } finally {
    await context.close();
  }
});

test('un navegador nuevo recibe instrucciones sin bucles y conserva la autorización tras el primer enlace', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  const local = new URL(baseURL ?? 'http://127.0.0.1:3417');
  local.hostname = 'localhost';
  try {
    const page = await context.newPage();
    await page.goto(local.href);
    await expect(page.getByText(/Este navegador aún no tiene acceso/)).toBeVisible();
    expect(page.url()).toBe(local.href);
    const token = loadAccess(resolve('.agent-evals/ui/access.json'));
    await page.goto(`${local.href}#access=${token}`);
    await expect(page.getByRole('heading', { name: 'Evaluaciones', exact: true })).toBeVisible();
    expect(page.url()).toBe(local.href);
    await page.goto(local.href);
    await expect(page.getByRole('heading', { name: 'Evaluaciones', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
