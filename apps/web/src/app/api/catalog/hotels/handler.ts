import { CatalogQuerySchema, CatalogResponseSchema } from '@hoteles/contracts/catalog';
import { type LoadCatalog, searchCatalog } from '@hoteles/core/catalog';

const headers = { 'Cache-Control': 'no-store' };

export function createCatalogHandler(loadCatalog: LoadCatalog) {
  return async function GET(request: Request): Promise<Response> {
    const searchParams = new URL(request.url).searchParams;
    for (const key of searchParams.keys()) {
      if (searchParams.getAll(key).length > 1) {
        return Response.json(
          {
            error: {
              code: 'invalid_query',
              message: 'Los parámetros de búsqueda no pueden repetirse.',
            },
          },
          { status: 400, headers },
        );
      }
    }
    const parsed = CatalogQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: 'invalid_query',
            issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
          },
        },
        { status: 400, headers },
      );
    }
    try {
      const hotels = await loadCatalog();
      const response = CatalogResponseSchema.parse(searchCatalog(hotels, parsed.data));
      return Response.json(response, { headers });
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
