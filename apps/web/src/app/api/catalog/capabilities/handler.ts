import type { LoadCatalog } from '@hoteles/core/catalog';
import { catalogCapabilities } from '../../../../composition/catalog/capabilities';

export function createCapabilitiesHandler(loadCatalog: LoadCatalog) {
  return async function GET(): Promise<Response> {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      return Response.json(catalogCapabilities(await loadCatalog()), { headers });
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
