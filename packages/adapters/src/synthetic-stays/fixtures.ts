import type { RoomCapacity } from '@hoteles/core/search';

export type SyntheticStayFixtures = Readonly<{
  version: string;
  currency: string;
  exponent: number;
  hotels: readonly Readonly<{
    id: string;
    minimumAdultAge: number;
    roomTypes: readonly Readonly<{
      id: string;
      name: string;
      capacity: RoomCapacity;
      nights: Readonly<Record<string, Readonly<{ inventory: number; totalMinor: number }>>>;
    }>[];
  }>[];
}>;

/** Identidades, inventario y precios inventados para los tests. */
export const syntheticStayFixtures = {
  version: 'synthetic-v1',
  currency: 'EUR',
  exponent: 2,
  hotels: [
    {
      id: 'synthetic-courtyard',
      minimumAdultAge: 13,
      roomTypes: [
        {
          id: 'synthetic-twin',
          name: 'Habitación doble simulada',
          capacity: { maxAdults: 2, maxChildren: 1, maxGuests: 2 },
          nights: {
            '2027-03-27': { inventory: 2, totalMinor: 10001 },
            '2027-03-28': { inventory: 1, totalMinor: 10002 },
          },
        },
        {
          id: 'synthetic-family',
          name: 'Habitación familiar simulada',
          capacity: { maxAdults: 2, maxChildren: 2, maxGuests: 4 },
          nights: {
            '2027-03-27': { inventory: 1, totalMinor: 15000 },
            '2027-03-28': { inventory: 1, totalMinor: 16000 },
          },
        },
      ],
    },
  ],
} satisfies SyntheticStayFixtures;
