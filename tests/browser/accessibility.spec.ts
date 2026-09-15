import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Este análisis automático cubre reglas WCAG; no sustituye una revisión manual completa.
test('el catálogo y el detalle no presentan infracciones automáticas de accesibilidad', async ({
  page,
}) => {
  await page.goto('/?q=Málaga');
  const hotel = page.getByRole('link', { name: 'Ver hotel Hotel Demo Málaga', exact: true });
  await expect(hotel).toBeVisible();
  const catalog = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(catalog.violations).toEqual([]);

  await hotel.click();
  await expect(page.getByRole('heading', { name: 'Hotel Demo Málaga', level: 1 })).toBeVisible();
  const detail = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(detail.violations).toEqual([]);
});

test('el buscador se envía con teclado y el panel móvil devuelve el foco al cerrarse', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const query = page.getByRole('textbox', { name: 'Nombre del hotel o destino', exact: true });
  await query.focus();
  await page.keyboard.type('Málaga');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('hotel-card')).toHaveCount(1);
  const openFilters = page.getByRole('button', { name: 'Filtros', exact: true });
  await openFilters.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(openFilters).toBeFocused();
});
