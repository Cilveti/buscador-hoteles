import { countryLabel } from './countries';
import type { CatalogHotel } from './types';

/** Detail lookup preserves external identity and unknown country information. */
export function getCatalogHotel(hotels: readonly CatalogHotel[], hotelId: string) {
  const hotel = hotels.find((candidate) => candidate.id === hotelId);
  return hotel
    ? { hotel, countryLabel: hotel.country === null ? null : countryLabel(hotel.country) }
    : null;
}
