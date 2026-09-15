import { CatalogResponseSchema } from '@hoteles/contracts/catalog';
import type { CatalogPort } from '../application/catalog-port';
import { serializeQuery } from '../application/query';

export const httpCatalog: CatalogPort = {
  async search(query, signal) {
    const response = await fetch(`/api/catalog/hotels?${serializeQuery(query)}`, { signal });
    if (!response.ok) throw new Error('No hemos podido cargar los hoteles. Inténtalo de nuevo.');
    return CatalogResponseSchema.parse(await response.json());
  },
};
