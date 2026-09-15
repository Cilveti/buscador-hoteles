import { CatalogCapabilitiesSchema } from '@hoteles/contracts/catalog';
import { type CatalogFacet, type CatalogHotel, searchCatalog } from '@hoteles/core/catalog';

/** JSON Schema is an adapter representation for clients/tools, not a booking API contract. */
export function catalogCapabilities(hotels: readonly CatalogHotel[]) {
  const { facets } = searchCatalog(hotels, { q: '', page: 1, pageSize: 1, sort: 'name' });
  const values = (options: CatalogFacet[] | undefined) =>
    options?.map((option) => option.value) ?? [];
  const selection = (options: CatalogFacet[] | undefined) => ({
    type: 'array',
    items: { type: 'string', enum: values(options) },
    uniqueItems: true,
    maxItems: 20,
  });
  const notVerified = [
    { field: 'checkIn', reason: 'El catálogo no consulta disponibilidad para fechas.' },
    { field: 'checkOut', reason: 'El catálogo no consulta disponibilidad para fechas.' },
    {
      field: 'rooms',
      reason: 'El catálogo no contiene inventario de habitaciones para calcular la ocupación.',
    },
    {
      field: 'maxPrice',
      reason: 'Este catálogo ficticio no ofrece precios ni cotizaciones.',
    },
    {
      field: 'mealPlan',
      reason: 'La temática todo incluido no acredita un régimen reservable para una estancia.',
    },
    { field: 'cancellation', reason: 'La cancelación depende de una tarifa y una estancia.' },
  ].map((item) => ({ ...item, status: 'not-verified' }));
  return CatalogCapabilitiesSchema.parse({
    scope: 'hotel-catalog',
    facets,
    querySchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
      description:
        'Filtros sobre un catálogo de hoteles inventados. No cotiza ni reserva habitaciones.',
      properties: {
        q: {
          type: 'string',
          maxLength: 500,
          description: 'Palabras de nombre o destino; no búsqueda semántica.',
        },
        country: { type: 'string', enum: values(facets.countries) },
        brand: { type: 'string', enum: values(facets.brands) },
        destination: { type: 'string', enum: values(facets.destinations) },
        stars: {
          type: 'integer',
          enum: values(facets.stars).map(Number),
          description: 'Categoría declarada del hotel, distinta de la valoración de huéspedes.',
        },
        minRating: { type: 'number', minimum: 0, maximum: 5 },
        services: {
          ...selection(facets.services),
          description:
            'Todos son necesarios; las menciones con restricciones no cumplen este filtro.',
        },
        themes: {
          ...selection(facets.themes),
          description: 'Todas las temáticas editoriales seleccionadas son necesarias.',
        },
        pets: {
          type: 'string',
          enum: ['unknown', 'allowed', 'conditional', 'not-allowed', 'allowed-or-conditional'],
          description:
            'allowed exige admisión publicada sin condiciones encontradas; allowed-or-conditional incluye condiciones solamente por petición explícita. No acredita la aceptación de un animal concreto.',
        },
        sort: { type: 'string', enum: ['name', 'rating'], default: 'name' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 24, default: 12 },
      },
    },
    coverage: {
      hotels: hotels.length,
      stars: hotels.filter((hotel) => hotel.attributes?.stars != null).length,
      services: hotels.filter((hotel) => hotel.attributes?.services != null).length,
      themes: hotels.filter((hotel) => hotel.attributes?.themes != null).length,
      destinations: hotels.filter((hotel) => hotel.attributes?.destinations != null).length,
      petPolicies: hotels.filter(
        (hotel) => hotel.attributes && hotel.attributes.pets.status !== 'unknown',
      ).length,
      petSourceConflicts: hotels.filter((hotel) => hotel.attributes?.pets.sourceConflict).length,
    },
    notVerified,
    semantics: {
      services: 'all-required-available',
      themes: 'all-required',
      pets: 'exact-status-unless-explicitly-combined',
    },
  });
}
