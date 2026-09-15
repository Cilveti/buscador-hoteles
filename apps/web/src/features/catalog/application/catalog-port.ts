import type { CatalogQuery, CatalogResponse } from '@hoteles/contracts/catalog';

export type CatalogPort = {
  search(query: CatalogQuery, signal: AbortSignal): Promise<CatalogResponse>;
};
