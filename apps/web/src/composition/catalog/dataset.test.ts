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
