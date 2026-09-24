import { CatalogResponseSchema } from '@hoteles/contracts/catalog';
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

for (const field of ['services', 'themes'] as const) {
  test(`${field}: limita a 20 selecciones y permite sustituir valores`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort(),
    );
    // Facetas sintéticas ampliadas: comprueba la interacción, no la taxonomía del backend.
    const options = Array.from({ length: 21 }, (_, index) => ({
      value: `${field}-${index + 1}`,
      label: `${field} ${index + 1}`,
      count: 1,
    }));
    await page.route('**/api/catalog/hotels?*', async (route) => {
      const response = await route.fetch();
      const data = CatalogResponseSchema.parse(await response.json());
      await route.fulfill({ json: { ...data, facets: { ...data.facets, [field]: options } } });
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const selected = options.slice(0, 19).map((option) => option.value);
    await page.goto(`/?sort=rating&${field}=${selected.join(',')}`);
    const checkbox = (number: number) =>
      page.getByRole('checkbox', { name: `${field} ${number}`, exact: true });
    await checkbox(20).check();
    await expect(checkbox(20)).toBeChecked();
    await expect(checkbox(21)).toBeDisabled();
    await expect(
      page.getByText('Has seleccionado el máximo de 20 opciones. Quita una para elegir otra.', {
        exact: true,
      }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get(field)?.split(',')).toHaveLength(20);
    await checkbox(1).uncheck();
    await expect(checkbox(21)).toBeEnabled();
    await checkbox(21).check();
    await expect(checkbox(1)).toBeDisabled();
    await expect(checkbox(20)).toBeChecked();
    await expect(checkbox(21)).toBeChecked();
    const parameters = new URL(page.url()).searchParams;
    expect(parameters.get(field)?.split(',')).toEqual([
      ...selected.slice(1),
      `${field}-20`,
      `${field}-21`,
    ]);
    expect(parameters.get('sort')).toBe('rating');
    expect(errors).toEqual([]);
  });
}
