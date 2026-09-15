import { CatalogHotelDetailResponseSchema } from '@hoteles/contracts/catalog';
import type { HotelDetailPort } from '../application/hotel-detail-port';

export const httpHotelDetail: HotelDetailPort = {
  async findById(hotelId, signal) {
    const response = await fetch(`/api/catalog/hotels/${encodeURIComponent(hotelId)}`, { signal });
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) throw new Error('No hemos podido cargar este hotel.');
    return CatalogHotelDetailResponseSchema.parse(await response.json());
  },
};
