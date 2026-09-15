import { createHash } from 'node:crypto';
import type { CatalogAttributes, CatalogHotel, HotelBrand } from '@hoteles/core/catalog';
import type { Hotel } from '../../payload-types';

export type EditableHotel = Pick<
  Hotel,
  | 'externalHotelId'
  | 'name'
  | 'sourceName'
  | 'sourceUrl'
  | 'sourceDescription'
  | 'editorialDescription'
  | 'sourceRevision'
  | 'capturedAt'
>;
export type HotelDetails = {
  hotelId: string;
  locationText: string | null;
  ratingText: string | null;
  reviewCountText: string | null;
  highlights: string[] | null;
  labels: string[] | null;
  images: { url: string | null; alt: string | null }[];
};
export type HotelImage = { hotelId: string; url: string; alt: string | null };
export type HotelAttributeRow = {
  hotelId: string;
  brand: HotelBrand | null;
  attributes: CatalogAttributes;
};

function optionalText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function publicUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function guestRating(value: string | null | undefined): number | null {
  const match = value?.trim().match(/^(\d(?:[.,]\d+)?)\s*\/\s*5$/u);
  if (!match?.[1]) return null;
  const rating = Number(match[1].replace(',', '.'));
  return rating >= 0 && rating <= 5 ? rating : null;
}

function reviewCount(value: string | null | undefined): number | null {
  const match = value?.trim().match(/^(\d+|\d{1,3}(?:[., ]\d{3})+)\s+(?:reseñas?|reviews?)$/iu);
  if (!match?.[1]) return null;
  const count = Number(match[1].replace(/[., ]/gu, ''));
  return Number.isSafeInteger(count) ? count : null;
}

/** Payload defines catalog membership; local fixture metadata only enriches matching IDs. */
export function projectHotels(
  rows: readonly EditableHotel[],
  details: readonly HotelDetails[],
  images: readonly HotelImage[],
  attributeRows: readonly HotelAttributeRow[] = [],
): CatalogHotel[] {
  const detailsById = new Map(details.map((detail) => [detail.hotelId, detail]));
  const imagesById = new Map(images.map((image) => [image.hotelId, image]));
  const attributesById = new Map(attributeRows.map((row) => [row.hotelId, row]));
  return rows.map((row) => {
    const detail = detailsById.get(row.externalHotelId);
    const captured = attributesById.get(row.externalHotelId);
    const fallbackImage = imagesById.get(row.externalHotelId);
    const location = optionalText(detail?.locationText);
    const editorial = optionalText(row.editorialDescription);
    const description = editorial ?? optionalText(row.sourceDescription);
    const revision = description ? createHash('sha256').update(description).digest('hex') : null;
    const country = location?.includes(',') ? optionalText(location.split(',').at(-1)) : null;
    const image = [...(detail?.images ?? []), ...(fallbackImage ? [fallbackImage] : [])]
      .map((candidate) => ({
        url: candidate.url?.match(/^\/images\/[a-z0-9-]+\.svg$/u)
          ? candidate.url
          : publicUrl(candidate.url),
        alt: optionalText(candidate.alt),
      }))
      .find((candidate) => candidate.url !== null);
    return {
      id: row.externalHotelId,
      name: row.name,
      description,
      ...(revision
        ? {
            descriptionSource: {
              kind: editorial ? ('editorial' as const) : ('synthetic' as const),
              sourceUrl: editorial ? null : publicUrl(row.sourceUrl),
              sourceRevision: editorial ? revision : row.sourceRevision || revision,
              ...(!editorial && row.capturedAt ? { capturedAt: row.capturedAt } : {}),
            },
          }
        : {}),
      sourceUrl: publicUrl(row.sourceUrl),
      location,
      country,
      brand: captured?.brand ?? null,
      guestRating: guestRating(detail?.ratingText),
      reviewCount: reviewCount(detail?.reviewCountText),
      highlights: detail?.highlights ?? null,
      labels: detail?.labels ?? null,
      image: image?.url ? { url: image.url, alt: image.alt } : null,
      ...(captured ? { attributes: captured.attributes } : {}),
    };
  });
}
