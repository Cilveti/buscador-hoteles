import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import attributes from '../../../../../data/hotels/catalog-attributes.json';
import details from '../../../../../data/hotels/catalog-details.json';
import images from '../../../../../data/hotels/catalog-images.json';
import {
  CatalogAttributeDatasetSchema,
  CatalogHotelSchema,
  CatalogQuerySchema,
  CatalogResponseSchema,
} from '../../../../../packages/contracts/src/catalog';
import { searchCatalog } from '../../../../../packages/core/src/catalog';
import { projectHotels } from './project-hotels';

const SeedRow = z.object({
  hotelId: z.string(),
  name: z.string(),
  sourceRevision: z.string(),
  source: z.object({ url: z.null(), capturedAt: z.iso.datetime() }),
  evidence: z.array(z.object({ kind: z.literal('paragraph'), text: z.string() })),
});

test('el catálogo completo enlaza sus atributos e imágenes y produce una respuesta válida', () => {
  const sources = readFileSync(
    new URL('../../../../../data/hotels/normalized/hotels.jsonl', import.meta.url),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line) => SeedRow.parse(JSON.parse(line)));
  const ids = sources.map((row) => row.hotelId).sort();
  expect(new Set(ids).size).toBe(60);
  const parsed = CatalogAttributeDatasetSchema.parse(attributes);
  for (const rows of [parsed.hotels, details.hotels, images.images]) {
    expect(rows.map((row) => row.hotelId).sort()).toEqual(ids);
  }
  for (const image of images.images) {
    expect(image.url).toMatch(/^\/images\/hotel-[1-6]\.svg$/);
    expect(existsSync(new URL(`../../../public${image.url}`, import.meta.url))).toBe(true);
  }
  const hotels = projectHotels(
    sources.map((row) => ({
      externalHotelId: row.hotelId,
      name: row.name,
      sourceName: row.name,
      sourceUrl: row.source.url,
      sourceDescription: row.evidence.map((item) => item.text).join('\n\n'),
      sourceRevision: row.sourceRevision,
      capturedAt: row.source.capturedAt,
    })),
    details.hotels,
    images.images,
    parsed.hotels,
  );
  const result = CatalogResponseSchema.parse(
    searchCatalog(hotels, CatalogQuerySchema.parse({ pageSize: 24 })),
  );
  expect(result.total).toBe(60);
  const allHotels = z.array(CatalogHotelSchema).parse(hotels);
  expect(new Set(allHotels.map((hotel) => hotel.brand)).size).toBe(5);
  expect(
    allHotels.every(
      (hotel) =>
        hotel.image && hotel.descriptionSource?.kind === 'synthetic' && hotel.sourceUrl === null,
    ),
  ).toBe(true);
});

const demoHotels = CatalogHotelSchema.array().parse(
  JSON.parse(
    readFileSync(new URL('../../../../../data/demo/hotels.json', import.meta.url), 'utf8'),
  ),
);

test('la demo contiene 180 hoteles con nombres únicos, procedencia y URLs de fotos', () => {
  expect(demoHotels).toHaveLength(180);
  expect(new Set(demoHotels.map((hotel) => hotel.id)).size).toBe(180);
  expect(new Set(demoHotels.map((hotel) => hotel.name)).size).toBe(180);
  expect(new Set(demoHotels.map((hotel) => hotel.country)).size).toBeGreaterThan(20);
  for (const hotel of demoHotels) {
    expect(hotel.image?.url).toMatch(
      /^https:\/\/(static-dm\.barcelo\.com|preview3\.assetsadobe\.com)\/is\/image\//u,
    );
    expect(hotel.attributes?.provenance.kind).toBe('observed-public');
    expect(
      [
        hotel.name,
        hotel.description,
        ...(hotel.highlights ?? []),
        ...(hotel.labels ?? []),
        hotel.attributes?.pets.policyText,
      ].join(' '),
    ).not.toMatch(/\bbarcel[oó]\b|occidental|allegro|royal hideaway/iu);
  }
});

test('la demo permite buscar destinos, filtrar, ordenar y recorrer páginas sin repetir hoteles', () => {
  const madrid = searchCatalog(
    demoHotels,
    CatalogQuerySchema.parse({ q: 'Madrid', country: 'Spain' }),
  );
  expect(madrid.total).toBeGreaterThan(0);
  expect(madrid.hotels.every((hotel) => hotel.country === 'Spain')).toBe(true);
  const allIds: string[] = [];
  for (let page = 1; page <= 8; page++) {
    const response = CatalogResponseSchema.parse(
      searchCatalog(demoHotels, CatalogQuerySchema.parse({ page, pageSize: 24, sort: 'rating' })),
    );
    expect(response.total).toBe(180);
    allIds.push(...response.hotels.map((hotel) => hotel.id));
  }
  expect(new Set(allIds).size).toBe(180);
});
