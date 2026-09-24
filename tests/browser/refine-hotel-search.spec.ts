import { expect, type Page, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ context, baseURL }) => {
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort(),
  );
});

async function hotels(page: Page, names: string[]) {
  await expect(
    page.getByRole('heading', {
      name: new RegExp(`^${names.length} hotel(?:es)? para descubrir$`),
    }),
  ).toBeVisible();
  await expect(page.getByTestId('hotel-card')).toHaveCount(names.length);
  for (const name of names) {
    await expect(
      page.getByRole('link', { name: `Ver hotel Hotel Demo ${name}`, exact: true }),
    ).toBeVisible();
  }
}

const shared =
  '/?country=Spain&sort=rating&destination=city%2Fmalaga&stars=5&services=pool%2Cparking&themes=beach&pets=allowed-or-conditional';

test('AC1–AC9: afinar, recuperar resultados y volver desde la ficha', async ({ page }) => {
  await page.goto('/');
  await hotels(page, ['Málaga', 'Sevilla', 'Lisboa']);
  await page.getByLabel('Destino', { exact: true }).selectOption('city/malaga');
  await hotels(page, ['Málaga']);
  await expect(page).toHaveURL(/destination=city%2Fmalaga/);
  await page.getByRole('button', { name: 'Quitar filtro Málaga', exact: true }).click();
  await hotels(page, ['Málaga', 'Sevilla', 'Lisboa']);
  await page.getByLabel('Estrellas', { exact: true }).selectOption('4');
  await hotels(page, ['Sevilla']);
  await expect(page).toHaveURL(/stars=4/);
  await expect(
    page.getByRole('button', { name: 'Quitar filtro 4 estrellas', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await hotels(page, ['Málaga', 'Sevilla', 'Lisboa']);
  await page.getByRole('checkbox', { name: 'Piscina', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Aparcamiento', exact: true }).check();
  await hotels(page, ['Málaga']);
  await page.getByLabel('Destino', { exact: true }).selectOption('city/sevilla');
  await hotels(page, []);
  await expect(
    page.getByText('Todavía no hemos encontrado tu hotel', { exact: true }),
  ).toBeVisible();
  for (const label of ['Sevilla', 'Piscina', 'Aparcamiento']) {
    await expect(
      page.getByRole('button', { name: `Quitar filtro ${label}`, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Quitar filtro Aparcamiento', exact: true }).click();
  await hotels(page, ['Sevilla']);
  await expect(page).not.toHaveURL(/parking/);
  await expect(
    page.getByRole('button', { name: 'Quitar filtro Aparcamiento', exact: true }),
  ).toHaveCount(0);
  for (const label of ['Sevilla', 'Piscina']) {
    await expect(
      page.getByRole('button', { name: `Quitar filtro ${label}`, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await hotels(page, ['Málaga', 'Sevilla', 'Lisboa']);
  await expect(page).not.toHaveURL(/destination|stars|services|themes|pets/);
  await page.getByRole('checkbox', { name: 'Admite mascotas', exact: true }).check();
  await hotels(page, ['Málaga', 'Sevilla']);
  await expect(
    page.getByText('Incluye las que las admiten con condiciones.', { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/pets=allowed-or-conditional/);
  await page.getByRole('checkbox', { name: 'Playa', exact: true }).check();
  await hotels(page, ['Málaga']);
  await expect(page).toHaveURL(/themes=beach/);
  await expect(page).toHaveURL(/pets=allowed-or-conditional/);
  await page.getByRole('link', { name: 'Ver hotel Hotel Demo Málaga', exact: true }).click();
  await page.getByRole('link', { name: 'Volver a resultados', exact: true }).click();
  await hotels(page, ['Málaga']);
  for (const label of ['Playa', 'Admite mascotas']) {
    await expect(page.getByRole('checkbox', { name: label, exact: true })).toBeChecked();
    await expect(
      page.getByRole('button', { name: `Quitar filtro ${label}`, exact: true }),
    ).toBeVisible();
  }
});

test('AC10: dirección compartida restaura controles, fichas y navegación', async ({ page }) => {
  await page.goto(shared);
  await hotels(page, ['Málaga']);
  await expect(page.getByLabel('Destino', { exact: true })).toHaveValue('city/malaga');
  await expect(page.getByLabel('Estrellas', { exact: true })).toHaveValue('5');
  for (const label of ['Piscina', 'Aparcamiento', 'Playa', 'Admite mascotas']) {
    await expect(page.getByRole('checkbox', { name: label, exact: true })).toBeChecked();
  }
  for (const label of [
    'Málaga',
    '5 estrellas',
    'Piscina',
    'Aparcamiento',
    'Playa',
    'Admite mascotas',
  ]) {
    await expect(
      page.getByRole('button', { name: `Quitar filtro ${label}`, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByLabel('País', { exact: true })).toHaveValue('Spain');
  await expect(page.getByLabel('Ordenar por', { exact: true })).toHaveValue('rating');
  await page.getByRole('link', { name: 'Ver hotel Hotel Demo Málaga', exact: true }).click();
  await page.getByRole('link', { name: 'Volver a resultados', exact: true }).click();
  await hotels(page, ['Málaga']);
  const parameters = new URL(page.url()).searchParams;
  for (const [key, value] of new URL(shared, 'http://localhost').searchParams) {
    expect(parameters.get(key)).toBe(value);
  }
});

test('limpiar conserva texto y orden; el reinicio vacío elimina todos los criterios', async ({
  page,
}) => {
  await page.goto(`${shared}&q=Demo&brand=aurora&minRating=4&page=2&pageSize=1`);
  await expect(page.getByText('Esta página ya no tiene resultados', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Quitar filtro Aparcamiento', exact: true }).click();
  await hotels(page, ['Málaga']);
  await expect(page).not.toHaveURL(/page=2|parking/);
  await expect(page).toHaveURL(/services=pool/);
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(page.getByText('Página 1 de 3', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.toString()).toBe('q=Demo&sort=rating&pageSize=1');
  await page.goto(`${shared}&q=inexistente&brand=aurora&minRating=4`);
  await page.getByRole('button', { name: 'Ver todos los hoteles', exact: true }).click();
  await hotels(page, ['Málaga', 'Sevilla', 'Lisboa']);
  expect(new URL(page.url()).search).toBe('');
});

test('la hoja móvil comparte opciones y cuenta cada valor; las temáticas se exigen todas', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(shared);
  await hotels(page, ['Málaga']);
  await page.getByRole('button', { name: 'Filtros 7', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('checkbox', { name: 'Ciudad', exact: true }).check();
  await expect(sheet.getByRole('checkbox', { name: 'Playa', exact: true })).toBeChecked();
  await sheet.getByRole('button', { name: 'Ver resultados', exact: true }).click();
  await hotels(page, []);
  await expect(page).toHaveURL(/themes=beach%2Ccity/);
  await page.getByRole('button', { name: 'Quitar filtro Ciudad', exact: true }).click();
  await hotels(page, ['Málaga']);
  await page.getByRole('button', { name: 'Filtros 7', exact: true }).click();
  await sheet.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await sheet.getByRole('button', { name: 'Ver resultados', exact: true }).click();
  await hotels(page, ['Málaga', 'Sevilla', 'Lisboa']);
  await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible();
  expect(new URL(page.url()).search).toBe('?sort=rating');
});

test('recupera las opciones completas si falla su carga al entrar filtrado', async ({ page }) => {
  await page.route('**/api/catalog/hotels?', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto(shared);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/catalog/hotels?');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await hotels(page, ['Málaga']);
  await expect(
    page.getByLabel('Destino', { exact: true }).locator('option[value="city/sevilla"]'),
  ).toHaveCount(1);
  await expect(page.getByRole('checkbox', { name: 'Ciudad', exact: true })).toBeVisible();
});
