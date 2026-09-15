import { expect, test } from 'bun:test';
import { CatalogQuerySchema, CatalogResponseSchema } from './catalog';

test('catalog query parses URL numbers and supplies bounded display defaults', () => {
  expect(CatalogQuerySchema.parse({ minRating: '4.5', page: '2' })).toEqual({
    q: '',
    minRating: 4.5,
    page: 2,
    pageSize: 12,
    sort: 'name',
  });
  for (const input of [
    { pageSize: '25' },
    { page: '0' },
    { minRating: '5.1' },
    { minRating: 'wat' },
    { sort: 'price' },
    { brand: 'made-up' },
  ]) {
    expect(CatalogQuerySchema.safeParse(input).success).toBe(false);
  }
});

test('response projection omits additional admin fields even from a structurally compatible record', () => {
  const result = CatalogResponseSchema.parse({
    hotels: [
      {
        id: '1',
        name: 'Hotel',
        description: null,
        sourceUrl: null,
        location: null,
        country: null,
        brand: null,
        guestRating: null,
        reviewCount: null,
        highlights: null,
        labels: null,
        image: null,
        sourceEvidence: 'private',
        internalState: 'pending',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 12,
    totalPages: 1,
    facets: { countries: [], brands: [] },
  });
  expect(result.hotels[0]).not.toHaveProperty('sourceEvidence');
  expect(result.hotels[0]).not.toHaveProperty('internalState');
});

test('advanced query accepts typed selections and CSV transport without pretending unknown booking fields are verified', () => {
  expect(
    CatalogQuerySchema.parse({
      destination: 'city/madrid',
      stars: '5',
      services: 'wifi-gratis,piscina',
      themes: ['spa'],
      pets: 'conditional',
    }),
  ).toMatchObject({
    destination: 'city/madrid',
    stars: 5,
    services: ['wifi-gratis', 'piscina'],
    themes: ['spa'],
    pets: 'conditional',
  });
  for (const input of [
    { stars: 4.5 },
    { pets: true },
    { services: 'wifi-gratis,,piscina' },
    { checkIn: '2026-09-10' },
  ])
    expect(CatalogQuerySchema.safeParse(input).success).toBe(false);
});
