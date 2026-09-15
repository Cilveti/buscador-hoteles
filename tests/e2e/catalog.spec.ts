import { expect, type Page, test } from '@playwright/test';
import { type CatalogResponse, CatalogResponseSchema } from '../../packages/contracts/src/catalog';

const endpoint = '/api/catalog/hotels';

async function queryAfter(
  page: Page,
  action: () => Promise<unknown>,
  matches: (query: URLSearchParams) => boolean = () => true,
) {
  const response = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === endpoint && response.status() === 200 && matches(url.searchParams);
  });
  await action();
  return CatalogResponseSchema.parse(await (await response).json());
}

async function expectCards(page: Page, result: CatalogResponse) {
  const cards = page.getByRole('link', { name: /^Ver hotel / });
  await expect(cards).toHaveCount(result.hotels.length);
  for (const [index, hotel] of result.hotels.entries()) {
    await expect(cards.nth(index)).toHaveAccessibleName(`Ver hotel ${hotel.name}`);
  }
}

test('encuentra Málaga sin acento y abre la ficha del hotel correcto', async ({ page }) => {
  await queryAfter(page, () => page.goto('/'));
  await page
    .getByRole('textbox', { name: 'Nombre del hotel o destino', exact: true })
    .fill('AURORA malaga');
  const result = await queryAfter(
    page,
    () => page.getByRole('button', { name: 'Buscar hoteles', exact: true }).click(),
    (query) => query.get('q') === 'AURORA malaga',
  );
  // El catálogo incluye Málaga y Marbella como destinos de la misma provincia.
  expect(result.hotels.map((hotel) => hotel.id).sort()).toEqual([
    'hotel-001',
    'hotel-002',
    'hotel-021',
    'hotel-022',
  ]);
  expect(
    result.hotels.find((hotel) => hotel.id === 'hotel-002')?.attributes?.destinations,
  ).toContainEqual({ value: 'province/malaga', label: 'Malaga', level: 'province' });
  await expectCards(page, result);
  await page.getByRole('link', { name: 'Ver hotel Aurora Patio Azul', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/hotels/hotel-001');
  await expect(
    page.getByRole('heading', { name: 'Aurora Patio Azul', exact: true, level: 1 }),
  ).toBeVisible();
});

test('combina país, marca y valoración, ordena los resultados y permite limpiar', async ({
  page,
}) => {
  await queryAfter(
    page,
    () => page.goto('/?minRating=0'),
    (query) => query.get('minRating') === '0',
  );
  await expect(page.getByLabel('Valoración mínima', { exact: true })).toHaveValue('0');
  await expect(page.getByRole('button', { name: 'Limpiar filtros', exact: true })).toBeEnabled();
  await queryAfter(
    page,
    () => page.getByLabel('País', { exact: true }).selectOption('Spain'),
    (query) => query.get('country') === 'Spain',
  );
  await queryAfter(
    page,
    () => page.getByLabel('Marca', { exact: true }).selectOption('brisa'),
    (query) => query.get('brand') === 'brisa',
  );
  await queryAfter(
    page,
    () => page.getByLabel('Valoración mínima', { exact: true }).selectOption('4.5'),
    (query) => query.get('minRating') === '4.5',
  );
  const result = await queryAfter(
    page,
    () => page.getByLabel('Ordenar por', { exact: true }).selectOption('rating'),
    (query) => query.get('sort') === 'rating',
  );
  expect(result.hotels.length).toBeGreaterThan(0);
  expect(
    result.hotels.every(
      (hotel) =>
        hotel.country === 'Spain' &&
        hotel.brand === 'brisa' &&
        hotel.guestRating !== null &&
        hotel.guestRating >= 4.5,
    ),
  ).toBe(true);
  const ratings = result.hotels.map((hotel) => hotel.guestRating);
  expect(ratings).toEqual([...ratings].sort((a, b) => (b ?? -1) - (a ?? -1)));
  await expectCards(page, result);

  const cleared = await queryAfter(
    page,
    () => page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click(),
    (query) => !query.has('country') && !query.has('brand') && !query.has('minRating'),
  );
  expect(cleared.total).toBe(60);
  await expectCards(page, cleared);
});

test('la paginación conserva el orden y una nueva búsqueda vuelve a la primera página', async ({
  page,
}) => {
  const first = await queryAfter(
    page,
    () => page.goto('/?sort=rating'),
    (query) => query.get('sort') === 'rating',
  );
  expect(first.page).toBe(1);
  const second = await queryAfter(
    page,
    () => page.getByRole('button', { name: 'Página siguiente', exact: true }).click(),
    (query) => query.get('page') === '2' && query.get('sort') === 'rating',
  );
  expect(second.page).toBe(2);
  expect(second.hotels.length).toBeGreaterThan(0);
  expect(
    second.hotels.some((hotel) => first.hotels.some((previous) => previous.id === hotel.id)),
  ).toBe(false);
  await expectCards(page, second);
  const previous = await queryAfter(
    page,
    () => page.getByRole('button', { name: 'Página anterior', exact: true }).click(),
    (query) => (query.get('page') ?? '1') === '1',
  );
  expect(previous.hotels.map((hotel) => hotel.id)).toEqual(first.hotels.map((hotel) => hotel.id));

  await queryAfter(
    page,
    () => page.getByRole('button', { name: 'Página siguiente', exact: true }).click(),
    (query) => query.get('page') === '2',
  );
  await page
    .getByRole('textbox', { name: 'Nombre del hotel o destino', exact: true })
    .fill('MALAGA');
  const searched = await queryAfter(
    page,
    () => page.getByRole('button', { name: 'Buscar hoteles', exact: true }).click(),
    (query) => query.get('q') === 'MALAGA' && (query.get('page') ?? '1') === '1',
  );
  expect(searched.page).toBe(1);
  expect(searched.hotels.some((hotel) => hotel.id === 'hotel-001')).toBe(true);
  await expectCards(page, searched);

  const outOfRange = await queryAfter(
    page,
    () => page.goto('/?country=Italy&page=2'),
    (query) => query.get('country') === 'Italy' && query.get('page') === '2',
  );
  expect(outOfRange.total).toBeGreaterThan(0);
  expect(outOfRange.hotels).toHaveLength(0);
  await expect(page.getByText('Esta página ya no tiene resultados', { exact: true })).toBeVisible();
  const validPage = await queryAfter(
    page,
    () => page.getByRole('button', { name: 'Volver a la primera página', exact: true }).click(),
    (query) => query.get('country') === 'Italy' && (query.get('page') ?? '1') === '1',
  );
  expect(validPage.page).toBe(1);
  expect(validPage.hotels.length).toBeGreaterThan(0);
  await expectCards(page, validPage);
});

test('recupera un error HTTP y permite salir de una búsqueda sin resultados', async ({ page }) => {
  let simulateFailure = true;
  await page.route('**/api/catalog/hotels**', async (route) => {
    if (simulateFailure) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Fallo local simulado por el test' }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto('/?country=Italy&minRating=5');
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  simulateFailure = false;
  const empty = await queryAfter(
    page,
    () => page.getByRole('button', { name: 'Reintentar', exact: true }).click(),
    (query) => query.get('country') === 'Italy' && query.get('minRating') === '5',
  );
  expect(empty.total).toBe(0);
  await expectCards(page, empty);
  const reset = await queryAfter(
    page,
    () => page.getByRole('button', { name: 'Ver todos los hoteles', exact: true }).click(),
    (query) =>
      !query.has('q') && !query.has('country') && !query.has('brand') && !query.has('minRating'),
  );
  expect(reset.total).toBe(60);
  await expect(page).toHaveURL(
    (url) => !url.searchParams.has('country') && !url.searchParams.has('minRating'),
  );
  await expectCards(page, reset);
});

test('en móvil los filtros se usan desde el panel sin desbordar la pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await queryAfter(page, () => page.goto('/'));
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  const filtered = await queryAfter(
    page,
    () => panel.getByLabel('País', { exact: true }).selectOption('Spain'),
    (query) => query.get('country') === 'Spain',
  );
  expect(filtered.hotels.length).toBeGreaterThan(0);
  expect(filtered.hotels.every((hotel) => hotel.country === 'Spain')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expectCards(page, filtered);
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.width).toBe(390);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
});
