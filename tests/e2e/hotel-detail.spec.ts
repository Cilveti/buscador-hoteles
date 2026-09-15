import { expect, test } from '@playwright/test';
import { CatalogResponseSchema } from '../../packages/contracts/src/catalog';

test('la ficha tiene URL propia y conserva los filtros y la página al recargar y volver', async ({
  page,
}) => {
  const search = '/?country=Spain&brand=aurora&minRating=4&sort=rating&page=2';
  const response = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/catalog/hotels' && response.status() === 200,
  );
  await page.goto(search);
  const catalog = CatalogResponseSchema.parse(await (await response).json());
  const hotel = catalog.hotels[0];
  if (!hotel)
    throw new Error('El catálogo local no contiene hoteles en la segunda página de esta búsqueda.');
  const originalParameters = Object.fromEntries(new URL(page.url()).searchParams);

  await page.getByRole('link', { name: `Ver hotel ${hotel.name}`, exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === `/hotels/${hotel.id}`);
  await expect(
    page.getByRole('heading', { name: hotel.name, level: 1, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: hotel.name, level: 1, exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Volver a resultados', exact: true }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/' && url.searchParams.get('page') === '2',
  );
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual(originalParameters);
  await expect(
    page.getByRole('link', { name: `Ver hotel ${hotel.name}`, exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('País', { exact: true })).toHaveValue('Spain');
  await expect(page.getByLabel('Marca', { exact: true })).toHaveValue('aurora');
});

test('un enlace directo inexistente muestra un error recuperable', async ({ page }) => {
  const missingHotel = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/catalog/hotels/99999999',
  );
  await page.goto('/hotels/99999999');
  expect((await missingHotel).status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'No encontramos este hotel', level: 1, exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver todos los hoteles', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/');
  await expect(page.getByRole('link', { name: /^Ver hotel / })).toHaveCount(12);
});

test('la ficha directa en móvil mantiene foto y contenido separados incluso tras recargar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/hotels/hotel-001');
  await expect(
    page.getByRole('heading', { name: 'Aurora Patio Azul', exact: true, level: 1 }),
  ).toBeVisible();
  await page.reload();
  const heading = page.getByRole('heading', { name: 'Aurora Patio Azul', exact: true, level: 1 });
  await expect(heading).toBeVisible();
  const photo = page.getByRole('img', { name: 'Aurora Patio Azul', exact: true });
  await expect(photo).toBeVisible();
  await expect
    .poll(() =>
      photo.evaluate(
        (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true);

  const photoBounds = await photo.boundingBox();
  const headingBounds = await heading.boundingBox();
  const descriptionBounds = await page
    .getByRole('heading', { name: 'Sobre el hotel', exact: true })
    .boundingBox();
  if (!photoBounds || !headingBounds || !descriptionBounds)
    throw new Error('La ficha debe mostrar imagen, nombre y descripción medibles.');
  expect(photoBounds.height).toBeGreaterThan(100);
  expect(headingBounds.y + headingBounds.height).toBeLessThanOrEqual(photoBounds.y + 1);
  expect(descriptionBounds.y).toBeGreaterThanOrEqual(photoBounds.y + photoBounds.height - 1);

  const layout = await page.evaluate((imageBounds) => {
    const main = document.querySelector('main');
    if (!main) throw new Error('Falta el contenido principal del detalle.');
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const overlappingText: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (!text || node.parentElement?.closest('script,style')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const intersects = Array.from(range.getClientRects()).some(
        (rect) =>
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left < imageBounds.x + imageBounds.width - 1 &&
          rect.right > imageBounds.x + 1 &&
          rect.top < imageBounds.y + imageBounds.height - 1 &&
          rect.bottom > imageBounds.y + 1,
      );
      if (intersects) overlappingText.push(text);
    }
    return {
      overlappingText,
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  }, photoBounds);
  expect(layout.overlappingText).toEqual([]);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);

  const description = page.getByRole('region', { name: 'Sobre el hotel', exact: true });
  const expand = description.getByRole('button', {
    name: 'Leer descripción completa',
    exact: true,
  });
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  const initialParagraphs = await description.locator('p').allTextContents();
  expect(initialParagraphs).toHaveLength(2);
  await expand.click();
  const collapse = description.getByRole('button', { name: 'Mostrar menos', exact: true });
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  const completeParagraphs = await description.locator('p').allTextContents();
  expect(completeParagraphs.length).toBeGreaterThan(initialParagraphs.length);
  expect(completeParagraphs.slice(0, 2)).toEqual(initialParagraphs);
  await collapse.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expect(description.locator('p')).toHaveText(initialParagraphs);
  await expect(
    page.getByRole('link', { name: 'Volver a resultados', exact: true }),
  ).toHaveAttribute('href', '/');
});
