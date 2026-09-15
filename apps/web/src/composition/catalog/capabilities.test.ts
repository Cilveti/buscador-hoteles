import { expect, test } from 'bun:test';
import { CatalogCapabilitiesSchema, type CatalogHotel } from '@hoteles/contracts/catalog';
import { catalogCapabilities } from './capabilities';

test('publishes only available source-backed filter values and explicitly excludes unverified booking dimensions', () => {
  const hotels: CatalogHotel[] = [
    {
      id: '1',
      name: 'Hotel',
      country: 'Spain',
      brand: 'aurora',
      sourceUrl: null,
      description: null,
      location: null,
      guestRating: 4.5,
      reviewCount: null,
      highlights: [],
      labels: [],
      image: null,
    },
  ];
  const capabilities = CatalogCapabilitiesSchema.parse(catalogCapabilities(hotels));
  expect(capabilities.coverage).toMatchObject({ hotels: 1, stars: 0, services: 0, petPolicies: 0 });
  expect(capabilities.notVerified.map((item) => item.field)).toEqual([
    'checkIn',
    'checkOut',
    'rooms',
    'maxPrice',
    'mealPlan',
    'cancellation',
  ]);
  expect(capabilities.querySchema).toMatchObject({
    additionalProperties: false,
    properties: {
      country: { enum: ['Spain'] },
      pets: {
        enum: ['unknown', 'allowed', 'conditional', 'not-allowed', 'allowed-or-conditional'],
      },
      services: { type: 'array', items: { enum: [] } },
    },
  });
});
