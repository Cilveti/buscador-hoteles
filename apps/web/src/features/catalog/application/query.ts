import { type CatalogQuery, CatalogQuerySchema } from '@hoteles/contracts/catalog';

export const initialQuery = CatalogQuerySchema.parse({});

export function readQuery(parameters: URLSearchParams): CatalogQuery {
  const fields = ['q', 'country', 'brand', 'minRating', 'sort', 'page', 'pageSize'];
  const input = Object.fromEntries(
    fields.flatMap((key) => (parameters.has(key) ? [[key, parameters.get(key)]] : [])),
  );
  const parsed = CatalogQuerySchema.safeParse(input);
  return parsed.success ? parsed.data : initialQuery;
}

export function changeQuery(current: CatalogQuery, patch: Partial<CatalogQuery>): CatalogQuery {
  return CatalogQuerySchema.parse({ ...current, ...patch, page: patch.page ?? 1 });
}

export function serializeQuery(query: CatalogQuery): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (
      value === undefined ||
      value === '' ||
      (key === 'sort' && value === 'name') ||
      (key === 'page' && value === 1) ||
      (key === 'pageSize' && value === 12)
    )
      continue;
    parameters.set(key, String(value));
  }
  return parameters.toString();
}
