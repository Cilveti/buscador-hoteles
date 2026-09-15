import type { CatalogHotelDetailResponse } from '@hoteles/contracts/catalog';

export type HotelDetailPort = {
  findById(hotelId: string, signal: AbortSignal): Promise<CatalogHotelDetailResponse | null>;
};
