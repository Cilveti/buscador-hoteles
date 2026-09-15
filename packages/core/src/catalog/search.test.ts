import { describe, expect, test } from 'bun:test';
import { searchCatalog } from './search';
import type { CatalogAttributes, CatalogHotel, CatalogQuery } from './types';

const hotel = (
  id: string,
  name: string,
  country: string | null,
  brand: CatalogHotel['brand'],
  guestRating: number | null,
): CatalogHotel => ({
  id,
  name,
  country,
  brand,
  guestRating,
  location: country === 'Spain' ? 'Málaga, Spain' : country,
  description: null,
  sourceUrl: null,
  reviewCount: null,
  highlights: null,
  labels: null,
  image: null,
});
const hotels = [
  hotel('1', 'Aurora Patio Azul', 'Spain', 'aurora', 4.3),
  hotel('2', 'Mirador Málaga', 'Spain', 'mirador', 4.8),
  hotel('3', 'Aurora México', 'Mexico', 'aurora', 4.8),
  hotel('4', 'Sin puntuación', null, null, null),
];
const query: CatalogQuery = { q: '', page: 1, pageSize: 12, sort: 'name' };

describe('catalog search', () => {
  test('matches unordered words across name and destination without accents or case', () => {
    expect(
      searchCatalog(hotels, { ...query, q: 'MALAGA aurora' }).hotels.map((hotel) => hotel.id),
    ).toEqual(['1']);
    expect(searchCatalog(hotels, { ...query, q: 'espana' }).total).toBe(2);
    expect(searchCatalog(hotels, { ...query, q: 'spain' }).total).toBe(2);
  });
  test('combines country, brand and minimum guest rating without treating missing rating as zero', () => {
    expect(
      searchCatalog(hotels, {
        ...query,
        country: 'Spain',
        brand: 'mirador',
        minRating: 4.5,
      }).hotels.map((hotel) => hotel.id),
    ).toEqual(['2']);
    expect(searchCatalog(hotels, { ...query, minRating: 0 }).total).toBe(3);
  });
  test('sorts rating descending with missing ratings last and deterministic name tie-breaks', () => {
    expect(
      searchCatalog(hotels, { ...query, sort: 'rating' }).hotels.map((hotel) => hotel.id),
    ).toEqual(['3', '2', '1', '4']);
    expect(
      searchCatalog(hotels, { ...query, page: 2, pageSize: 2 }).hotels.map((hotel) => hotel.id),
    ).toEqual(['2', '4']);
    expect(searchCatalog(hotels, { ...query, page: 9 }).hotels).toEqual([]);
  });
  test('facets retain alternatives by omitting their own selected filter', () => {
    const result = searchCatalog(hotels, { ...query, country: 'Spain', brand: 'aurora' });
    expect(result.total).toBe(1);
    expect(result.facets.countries).toEqual([
      { value: 'Spain', label: 'España', count: 1 },
      { value: 'Mexico', label: 'México', count: 1 },
    ]);
    expect(result.facets.brands).toEqual([
      { value: 'aurora', label: 'Aurora', count: 1 },
      { value: 'mirador', label: 'Mirador', count: 1 },
    ]);
  });
});

const attributes: CatalogAttributes = {
  stars: 5,
  destinations: [{ value: 'city/madrid', label: 'Madrid', level: 'city' }],
  themes: [{ value: 'spa', label: 'Spa' }],
  services: [
    { value: 'wifi-gratis', label: 'Wifi gratuito', availability: 'available' },
    { value: 'piscina', label: 'Piscina con cargo', availability: 'conditional' },
  ],
  pets: {
    status: 'allowed',
    policyText: 'Se admiten mascotas.',
    sourceUrl: 'https://hoteles.example/',
    sourceConflict: false,
  },
  adultsOnly: false,
  provenance: {
    kind: 'synthetic',
    sourceUrl: 'https://images.example/',
    capturedAt: '2026-09-10T17:00:00.000Z',
  },
};
const advancedHotels: CatalogHotel[] = [
  { ...hotel('a', 'Hotel A', 'Spain', 'aurora', 4.5), attributes },
  {
    ...hotel('b', 'Hotel B', 'Spain', 'aurora', 4.5),
    attributes: {
      ...attributes,
      stars: 4,
      services: [
        { value: 'wifi-gratis', label: 'Wifi gratuito', availability: 'available' },
        { value: 'piscina', label: 'Piscina', availability: 'available' },
      ],
      pets: { ...attributes.pets, status: 'conditional' },
    },
  },
  hotel('c', 'Sin datos', 'Spain', null, null),
];

test('advanced filters combine exact destination, hotel stars and every required declared service', () => {
  expect(
    searchCatalog(advancedHotels, {
      ...query,
      destination: 'city/madrid',
      stars: 4,
      services: ['wifi-gratis', 'piscina'],
      themes: ['spa'],
    }).hotels.map((h) => h.id),
  ).toEqual(['b']);
  expect(
    searchCatalog(advancedHotels, { ...query, services: ['piscina'] }).hotels.map((h) => h.id),
  ).toEqual(['b']);
  expect(searchCatalog(advancedHotels, { ...query, stars: 3 }).total).toBe(0);
});

test('pet admission never silently includes conditions or unknown policies', () => {
  expect(
    searchCatalog(advancedHotels, { ...query, pets: 'allowed' }).hotels.map((h) => h.id),
  ).toEqual(['a']);
  expect(
    searchCatalog(advancedHotels, { ...query, pets: 'allowed-or-conditional' }).hotels.map(
      (h) => h.id,
    ),
  ).toEqual(['a', 'b']);
  expect(
    searchCatalog(advancedHotels, { ...query, pets: 'unknown' }).hotels.map((h) => h.id),
  ).toEqual(['c']);
});

test('advanced facets count hotels once, preserve alternatives, and exclude conditional services', () => {
  const result = searchCatalog(advancedHotels, { ...query, services: ['piscina'], stars: 4 });
  expect(result.facets.services).toEqual([
    { value: 'piscina', label: 'Piscina', count: 1 },
    { value: 'wifi-gratis', label: 'Wifi gratuito', count: 1 },
  ]);
  expect(result.facets.pets).toEqual([
    { value: 'conditional', label: 'Con condiciones', count: 1 },
  ]);
});

test('solo adultos exige una política confirmada, aunque hoteles recomendados para adultos compartan la etiqueta', () => {
  const labeled: CatalogHotel[] = [true, false, null].map((adultsOnly, index) => ({
    ...hotel(String(index), `Hotel ${index}`, 'Spain', 'aurora', 4),
    attributes: {
      ...attributes,
      adultsOnly,
      themes: [
        { value: 'adults-only', label: 'Solo adultos' },
        { value: 'playa', label: 'Playa' },
      ],
    },
  }));
  const result = searchCatalog(labeled, { ...query, themes: ['adults-only', 'playa'] });
  expect(result.hotels.map((item) => item.id)).toEqual(['0']);
  expect(result.facets.themes?.find((item) => item.value === 'adults-only')?.count).toBe(1);
  expect(searchCatalog(labeled, { ...query, themes: ['playa'] }).total).toBe(3);
});
