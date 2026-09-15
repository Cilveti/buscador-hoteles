import { countryLabel } from './countries';
import type {
  CatalogFacet,
  CatalogHotel,
  CatalogQuery,
  CatalogResponse,
  HotelBrand,
  PetStatus,
} from './types';

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const brandLabels: Record<HotelBrand, string> = {
  aurora: 'Aurora',
  brisa: 'Brisa',
  mirador: 'Mirador',
  natura: 'Natura',
  urbana: 'Urbana',
};
const petLabels: Record<PetStatus, string> = {
  allowed: 'Admisión publicada',
  conditional: 'Con condiciones',
  'not-allowed': 'No se admiten mascotas',
  unknown: 'Política desconocida',
};
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
type Filter = 'country' | 'brand' | 'destination' | 'stars' | 'services' | 'themes' | 'pets';
type Option = { value: string; label: string };

// Public themes can include "adults recommended" hotels. A strict policy needs its own evidence.
function eligibleThemes(hotel: CatalogHotel): readonly Option[] {
  return (
    hotel.attributes?.themes?.filter(
      (theme) => theme.value !== 'adults-only' || hotel.attributes?.adultsOnly === true,
    ) ?? []
  );
}

function facets(
  hotels: readonly CatalogHotel[],
  options: (hotel: CatalogHotel) => readonly Option[],
): CatalogFacet[] {
  const counts = new Map<string, CatalogFacet>();
  for (const hotel of hotels) {
    const distinct = new Map(options(hotel).map((option) => [option.value, option]));
    for (const option of distinct.values()) {
      const existing = counts.get(option.value);
      if (existing) existing.count += 1;
      else counts.set(option.value, { value: option.value, label: option.label, count: 1 });
    }
  }
  return [...counts.values()].sort(
    (a, b) => collator.compare(a.label, b.label) || collator.compare(a.value, b.value),
  );
}

function matches(hotel: CatalogHotel, query: CatalogQuery, omit?: Filter): boolean {
  if (omit !== 'country' && query.country !== undefined && hotel.country !== query.country)
    return false;
  if (omit !== 'brand' && query.brand !== undefined && hotel.brand !== query.brand) return false;
  if (
    omit !== 'destination' &&
    query.destination !== undefined &&
    !hotel.attributes?.destinations?.some((destination) => destination.value === query.destination)
  )
    return false;
  if (omit !== 'stars' && query.stars !== undefined && hotel.attributes?.stars !== query.stars)
    return false;
  if (
    omit !== 'services' &&
    query.services?.some(
      (value) =>
        !hotel.attributes?.services?.some(
          (service) => service.value === value && service.availability === 'available',
        ),
    )
  )
    return false;
  if (
    omit !== 'themes' &&
    query.themes?.some((value) => !eligibleThemes(hotel).some((theme) => theme.value === value))
  )
    return false;
  if (omit !== 'pets' && query.pets !== undefined) {
    const status = hotel.attributes?.pets.status ?? 'unknown';
    if (query.pets === 'allowed-or-conditional') {
      if (status !== 'allowed' && status !== 'conditional') return false;
    } else if (status !== query.pets) return false;
  }
  return true;
}

/** Every facet omits its own filter. Required services are ANDed and must be unconditional. */
export function searchCatalog(
  hotels: readonly CatalogHotel[],
  query: CatalogQuery,
): CatalogResponse {
  const words = normalize(query.q).trim().split(/\s+/u).filter(Boolean);
  const relevant = hotels.filter((hotel) => {
    if (
      query.minRating !== undefined &&
      (hotel.guestRating === null || hotel.guestRating < query.minRating)
    )
      return false;
    const searchable = normalize(
      [
        hotel.name,
        hotel.location,
        hotel.country,
        hotel.country ? countryLabel(hotel.country) : null,
        ...(hotel.attributes?.destinations?.map((destination) => destination.label) ?? []),
      ]
        .filter(Boolean)
        .join(' '),
    );
    return words.every((word) => searchable.includes(word));
  });
  const matching = relevant.filter((hotel) => matches(hotel, query));
  matching.sort((a, b) => {
    if (query.sort === 'rating') {
      const ratingDifference = (b.guestRating ?? -1) - (a.guestRating ?? -1);
      if (ratingDifference !== 0) return ratingDifference;
    }
    return collator.compare(a.name, b.name) || collator.compare(a.id, b.id);
  });
  const without = (filter: Filter) => relevant.filter((hotel) => matches(hotel, query, filter));
  const offset = (query.page - 1) * query.pageSize;
  return {
    hotels: matching.slice(offset, offset + query.pageSize),
    total: matching.length,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(matching.length / query.pageSize),
    facets: {
      countries: facets(without('country'), (hotel) =>
        hotel.country === null
          ? []
          : [{ value: hotel.country, label: countryLabel(hotel.country) }],
      ),
      brands: facets(without('brand'), (hotel) =>
        hotel.brand === null ? [] : [{ value: hotel.brand, label: brandLabels[hotel.brand] }],
      ),
      destinations: facets(without('destination'), (hotel) => hotel.attributes?.destinations ?? []),
      stars: facets(without('stars'), (hotel) =>
        hotel.attributes?.stars == null
          ? []
          : [
              {
                value: String(hotel.attributes.stars),
                label: `${hotel.attributes.stars} estrellas`,
              },
            ],
      ),
      services: facets(
        without('services'),
        (hotel) =>
          hotel.attributes?.services?.filter((service) => service.availability === 'available') ??
          [],
      ),
      themes: facets(without('themes'), eligibleThemes),
      pets: facets(without('pets'), (hotel) => {
        const status = hotel.attributes?.pets.status ?? 'unknown';
        return [{ value: status, label: petLabels[status] }];
      }),
    },
  };
}
