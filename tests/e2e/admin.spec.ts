import { type APIResponse, expect, test } from '@playwright/test';
import { loginAdmin } from '../../scripts/browser/navigation';

async function documentId(response: APIResponse) {
  expect(response.ok()).toBe(true);
  const value: unknown = await response.json();
  if (
    typeof value !== 'object' ||
    value === null ||
    !('doc' in value) ||
    typeof value.doc !== 'object' ||
    value.doc === null ||
    !('id' in value.doc) ||
    typeof value.doc.id !== 'number'
  ) {
    throw new Error('La API administrativa no ha devuelto la identidad del documento.');
  }
  return value.doc.id;
}

test('el catálogo administrativo requiere autenticación', async ({ request }) => {
  const response = await request.get('/api/hotels');
  expect(response.status()).toBe(403);
});

test('editar el contenido del hotel desde Payload conserva los cambios tras recargar', async ({
  page,
}) => {
  await loginAdmin(page);
  const identifier = `e2e-${crypto.randomUUID()}`;
  const hotelId = await documentId(
    await page.request.post('/api/hotels', {
      data: {
        externalHotelId: identifier,
        name: 'Hotel de prueba del arnés',
        sourceUrl: 'https://example.test/hotel',
      },
    }),
  );
  try {
    const forgedIdentity = await page.request.patch(`/api/hotels/${hotelId}`, {
      data: { externalHotelId: 'invalid-replacement' },
    });
    expect(forgedIdentity.ok()).toBe(true);
    expect(await forgedIdentity.text()).toContain(identifier);
    await page.goto(`/admin/collections/hotels/${hotelId}`);
    await page
      .getByLabel('Descripción editorial', { exact: true })
      .fill('Patio tranquilo para leer. Contenido sintético del test.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Updated successfully.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Descripción editorial', { exact: true })).toHaveValue(
      'Patio tranquilo para leer. Contenido sintético del test.',
    );
  } finally {
    expect((await page.request.delete(`/api/hotels/${hotelId}`)).ok()).toBe(true);
  }
});
