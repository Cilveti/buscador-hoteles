import { type CatalogQuery, CatalogQuerySchema } from '@hoteles/contracts/catalog';

export const initialQuery = CatalogQuerySchema.parse({});

export function readQuery(parameters: URLSearchParams): CatalogQuery {
  const fields = [
    'q',
    'country',
    'brand',
    'minRating',
    'sort',
    'page',
    'pageSize',
    'destination',
    'stars',
    'services',
    'themes',
    'pets',
  ];
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
      (Array.isArray(value) && value.length === 0) ||
      (key === 'sort' && value === 'name') ||
      (key === 'page' && value === 1) ||
      (key === 'pageSize' && value === 12)
    )
      continue;
    parameters.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return parameters.toString();
}

// Explicit undefined values remove optional filters when merged into the current query.
export const clearedFilters = {
  country: undefined,
  brand: undefined,
  minRating: undefined,
  destination: undefined,
  stars: undefined,
  services: undefined,
  themes: undefined,
  pets: undefined,
} satisfies Partial<CatalogQuery>;

export function countFilters(query: CatalogQuery): number {
  return (
    [
      query.country,
      query.brand,
      query.minRating,
      query.destination,
      query.stars,
      query.pets,
    ].filter((value) => value !== undefined && value !== '').length +
    (query.services?.length ?? 0) +
    (query.themes?.length ?? 0)
  );
}
