import { expect, test } from 'bun:test';
import { getCatalogHotel } from './get-hotel';
import type { CatalogHotel } from './types';

const hotel: CatalogHotel = {
  id: '7333',
  name: 'Aurora Patio Azul',
  description: null,
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

test('selects the exact external identifier and includes a Spanish country label', () => {
  const similarlyNamed = { ...hotel, id: '73331', name: 'Otro hotel' };
  expect(getCatalogHotel([similarlyNamed, hotel], '7333')).toEqual({
    hotel,
    countryLabel: 'España',
  });
  expect(getCatalogHotel([similarlyNamed], '7333')).toBeNull();
});

test('preserves an unknown country in the detail response', () => {
  expect(getCatalogHotel([{ ...hotel, country: null }], '7333')).toMatchObject({
    countryLabel: null,
  });
});
