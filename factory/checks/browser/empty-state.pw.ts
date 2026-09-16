import { expect, test } from '@playwright/test';

// Trusted acceptance for hotel-empty-v1: this file is outside the model's editable snapshot.
for (const width of [1280, 360]) {
  test(`estado vacío de Penpot a ${width}px: accesibilidad, presentación y recuperación`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?q=hotel-inexistente-factory-qa');
    const card = page.getByRole('region', {
      name: 'Todavía no hemos encontrado tu hotel',
      exact: true,
    });
    await expect(card).toBeVisible();
    await expect(
      card.getByText('Prueba otro destino o amplía los filtros para descubrir más opciones.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(card).toHaveCSS('border-top-style', 'solid');
    await expect(card).toHaveCSS('border-top-width', '1px');
    await expect(card).toHaveCSS('border-top-left-radius', '12px');
    const reset = card.getByRole('button', { name: 'Ver todos los hoteles', exact: true });
    await expect(reset).toHaveCSS('background-color', 'rgb(23, 106, 121)');
    await expect(card.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await card.scrollIntoViewIfNeeded();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
    await card.screenshot({ path: `/evidence/empty-state-${width}.png` });
    await reset.click();
    await expect(card).toBeHidden();
    await expect(page.getByRole('link', { name: /^Ver hotel / }).first()).toBeVisible();
    await expect(page).toHaveURL((url) => !url.searchParams.has('q'));
  });
}
