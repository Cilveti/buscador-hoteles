import { expect, test } from 'bun:test';
import { type CatalogHotel, CatalogHotelDetailResponseSchema } from '@hoteles/contracts/catalog';
import { createCatalogHotelHandler } from './handler';

const hotel: CatalogHotel = {
  id: '7333',
  name: 'Aurora Patio Azul',
  description: 'Edición pública',
  sourceUrl: null,
  location: 'Málaga, Spain',
  country: 'Spain',
  brand: 'aurora',
  guestRating: 4.6,
  reviewCount: null,
  highlights: [],
  labels: [],
  image: null,
};
const context = (hotelId: string) => ({ params: Promise.resolve({ hotelId }) });
const request = new Request('http://localhost/api/catalog/hotels/7333');

test('returns a validated public hotel detail without administrative fields', async () => {
  const handler = createCatalogHotelHandler(async () => [{ ...hotel, sourceEvidence: 'private' }]);
  const response = await handler(request, context('7333'));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(CatalogHotelDetailResponseSchema.safeParse(body).success).toBe(true);
  expect(body).toEqual({ hotel, countryLabel: 'España' });
});

test('returns 404 for a valid identifier that is absent from the catalog', async () => {
  const handler = createCatalogHotelHandler(async () => [hotel]);
  const response = await handler(request, context('missing-hotel'));
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ error: { code: 'hotel_not_found' } });
});

test('rejects malformed identifiers before loading any data', async () => {
  let reads = 0;
  const handler = createCatalogHotelHandler(async () => {
    reads += 1;
    return [hotel];
  });
  for (const id of ['', '../7333', 'hotel/7333', ' 7333 ', 'a'.repeat(101)]) {
    const response = await handler(request, context(id));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'invalid_hotel_id' } });
  }
  expect(reads).toBe(0);
});

test('conceals internal load failures behind a safe unavailable response', async () => {
  const handler = createCatalogHotelHandler(async () => {
    throw new Error('postgres://private');
  });
  const response = await handler(request, context('7333'));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: {
      code: 'catalog_unavailable',
      message: 'El catálogo no está disponible en este momento.',
    },
  });
});
