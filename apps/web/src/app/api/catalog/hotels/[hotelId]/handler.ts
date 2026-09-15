import { CatalogHotelDetailResponseSchema, CatalogHotelIdSchema } from '@hoteles/contracts/catalog';
import { getCatalogHotel, type LoadCatalog } from '@hoteles/core/catalog';

type HotelRouteContext = { params: Promise<{ hotelId: string }> };
const headers = { 'Cache-Control': 'no-store' };

export function createCatalogHotelHandler(loadCatalog: LoadCatalog) {
  return async function GET(_request: Request, context: HotelRouteContext): Promise<Response> {
    const params = await context.params;
    const hotelId = CatalogHotelIdSchema.safeParse(params.hotelId);
    if (!hotelId.success) {
      return Response.json(
        {
          error: { code: 'invalid_hotel_id', message: 'El identificador del hotel no es válido.' },
        },
        { status: 400, headers },
      );
    }
    try {
      const hotels = await loadCatalog();
      const detail = getCatalogHotel(hotels, hotelId.data);
      if (!detail) {
        return Response.json(
          { error: { code: 'hotel_not_found', message: 'No hemos encontrado este hotel.' } },
          { status: 404, headers },
        );
      }
      return Response.json(CatalogHotelDetailResponseSchema.parse(detail), { headers });
    } catch {
      return Response.json(
        {
          error: {
            code: 'catalog_unavailable',
            message: 'El catálogo no está disponible en este momento.',
          },
        },
        { status: 503, headers },
      );
    }
  };
}
