import { expect, test } from 'bun:test';
import type { CatalogHotel } from '@hoteles/contracts/catalog';
import { createCatalogHandler } from './handler';

const hotel: CatalogHotel = {
  id: '7333',
  name: 'Aurora Patio Azul',
  description: 'Editada',
  sourceUrl: null,
  location: 'Málaga, Spain',
  country: 'Spain',
  brand: 'aurora',
  guestRating: 4.6,
  reviewCount: 1234,
  highlights: [],
  labels: [],
  image: null,
};

test('rejects invalid, repeated and unknown query parameters before reading the catalog', async () => {
  let reads = 0;
  const handler = createCatalogHandler(async () => {
    reads += 1;
    return [hotel];
  });
  for (const query of [
    'pageSize=25',
    'page=0',
    'minRating=no',
    'page=1&page=2',
    'include=sourceEvidence',
  ]) {
    const response = await handler(new Request(`http://localhost/api/catalog/hotels?${query}`));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'invalid_query' } });
  }
  expect(reads).toBe(0);
});

test('returns only public fields and observes changed editorial values on the next request', async () => {
  let name = hotel.name;
  const handler = createCatalogHandler(async () => [{ ...hotel, name, sourceEvidence: 'private' }]);
  const request = () => new Request('http://localhost/api/catalog/hotels?q=malaga&minRating=4.5');
  const first = await handler(request());
  expect(first.status).toBe(200);
  expect(first.headers.get('cache-control')).toBe('no-store');
  expect(await first.json()).toEqual({
    hotels: [hotel],
    total: 1,
    page: 1,
    pageSize: 12,
    totalPages: 1,
    facets: {
      countries: [{ value: 'Spain', label: 'España', count: 1 }],
      brands: [{ value: 'aurora', label: 'Aurora', count: 1 }],
      destinations: [],
      stars: [],
      services: [],
      themes: [],
      pets: [{ value: 'unknown', label: 'Política desconocida', count: 1 }],
    },
  });
  name = 'Nuevo nombre';
  expect(await (await handler(request())).json()).toMatchObject({
    hotels: [{ name: 'Nuevo nombre' }],
  });
});

test('reports unavailable data without returning database errors or credentials', async () => {
  const handler = createCatalogHandler(async () => {
    throw new Error('postgres://secret');
  });
  const response = await handler(new Request('http://localhost/api/catalog/hotels'));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: {
      code: 'catalog_unavailable',
      message: 'El catálogo no está disponible en este momento.',
    },
  });
});

test('applies advanced URL filters and keeps conditional pet policies out of strict admission', async () => {
  const withPolicy: CatalogHotel = {
    ...hotel,
    attributes: {
      stars: 5,
      destinations: [{ value: 'city/malaga', label: 'Málaga', level: 'city' }],
      services: [{ value: 'wifi-gratis', label: 'Wifi gratuito', availability: 'available' }],
      themes: [{ value: 'spa', label: 'Spa' }],
      pets: {
        status: 'conditional',
        policyText: 'Bajo petición.',
        sourceUrl: 'https://www.aurora.com/',
        sourceConflict: true,
      },
      adultsOnly: false,
      provenance: {
        kind: 'synthetic',
        sourceUrl: 'https://static-content.aurora.com/',
        capturedAt: '2026-09-10T17:00:00.000Z',
      },
    },
  };
  const handler = createCatalogHandler(async () => [withPolicy]);
  const criteria = 'destination=city%2Fmalaga&stars=5&services=wifi-gratis&themes=spa';
  const strict = await handler(
    new Request(`http://localhost/api/catalog/hotels?${criteria}&pets=allowed`),
  );
  expect(await strict.json()).toMatchObject({ total: 0 });
  const explicit = await handler(
    new Request(`http://localhost/api/catalog/hotels?${criteria}&pets=allowed-or-conditional`),
  );
  expect(await explicit.json()).toMatchObject({
    total: 1,
    hotels: [{ attributes: { pets: { status: 'conditional', policyText: 'Bajo petición.' } } }],
  });
});
