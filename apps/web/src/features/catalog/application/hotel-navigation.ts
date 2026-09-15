import type { CatalogQuery } from '@hoteles/contracts/catalog';
import { readQuery, serializeQuery } from './query';

export function hotelHref(hotelId: string, query: CatalogQuery): string {
  const parameters = serializeQuery(query);
  return `/hotels/${encodeURIComponent(hotelId)}${parameters ? `?${parameters}` : ''}`;
}

/** Rebuild a local catalogue URL from validated search state, including on direct visits. */
export function resultsHref(parameters: URLSearchParams): string {
  const query = serializeQuery(readQuery(parameters));
  return query ? `/?${query}` : '/';
}
