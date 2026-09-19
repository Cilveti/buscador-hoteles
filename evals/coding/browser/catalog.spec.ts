import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context, baseURL }) => {
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort(),
  );
});

test('buscar, abrir detalle y volver conserva la consulta', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Nombre del hotel o destino', exact: true })
    .fill('Málaga');
  await page.getByRole('button', { name: 'Buscar hoteles', exact: true }).click();
  await expect(page.getByTestId('hotel-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Ver hotel Hotel Eval Málaga', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hotel Eval Málaga' })).toBeVisible();
  await page.getByRole('link', { name: 'Volver a resultados', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Nombre del hotel o destino', exact: true }),
  ).toHaveValue('Málaga');
  await expect(page.getByTestId('hotel-card')).toHaveCount(1);
});

test('país, orden, paginación y recarga consultan el handler real', async ({ page }) => {
  await page.goto('/?country=Spain&sort=rating&pageSize=1');
  await expect(
    page.getByRole('link', { name: 'Ver hotel Hotel Eval Sevilla', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Página siguiente', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Ver hotel Hotel Eval Málaga', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Ver hotel Hotel Eval Málaga', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible();
});

test('vacío y datos desconocidos no inventan resultados ni valoraciones', async ({ page }) => {
  await page.goto('/?q=inexistente');
  await expect(
    page.getByRole('button', { name: 'Ver todos los hoteles', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('hotel-card')).toHaveCount(0);
  await page.goto('/?q=Lisboa');
  await expect(page.getByText('Sin valoración disponible', { exact: true })).toBeVisible();
  await expect(page.getByTestId('hotel-card')).toHaveCount(1);
});

test('un error HTTP permite reintentar conservando los filtros', async ({ page }) => {
  await page.route('**/api/catalog/hotels?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'catalog_unavailable' } }),
    }),
  );
  await page.goto('/?q=Málaga');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/catalog/hotels?*');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Ver hotel Hotel Eval Málaga', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Nombre del hotel o destino', exact: true }),
  ).toHaveValue('Málaga');
});
