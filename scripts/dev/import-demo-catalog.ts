import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { CatalogAttributesSchema, CatalogHotelSchema } from '../../packages/contracts/src/catalog';

/** One-off import of an existing capture; no network calls or image downloads. */
const sourceDirectory = process.argv[2];
if (!sourceDirectory)
  throw new Error('Usage: bun scripts/dev/import-demo-catalog.ts <capture-directory>');
const root = resolve(import.meta.dir, '../..');
const read = (name: string) => Bun.file(resolve(sourceDirectory, name)).json();
const details = z
  .object({
    sourceUrl: z.httpUrl(),
    capturedAt: z.iso.datetime(),
    hotels: z.array(
      z.object({
        hotelId: z.string(),
        locationText: z.string().nullable(),
        ratingText: z.string().nullable(),
        reviewCountText: z.string().nullable(),
        highlights: z.array(z.string()).nullable(),
        labels: z.array(z.string()).nullable(),
      }),
    ),
  })
  .parse(await read('catalog-details.json'));
const images = z
  .object({ images: z.array(z.object({ hotelId: z.string(), url: z.httpUrl() })) })
  .parse(await read('catalog-images.json')).images;
const brands = {
  barcelo: 'aurora',
  occidental: 'brisa',
  allegro: 'natura',
  'royal-hideaway': 'mirador',
  'part-of-barcelo-hotel-group': 'urbana',
} as const;
const attributes = z
  .object({
    hotels: z.array(
      z.object({
        hotelId: z.string(),
        brand: z.enum(Object.keys(brands) as [keyof typeof brands, ...(keyof typeof brands)[]]),
        attributes: CatalogAttributesSchema,
      }),
    ),
  })
  .parse(await read('catalog-attributes.json')).hotels;
const identities = (await Bun.file(resolve(sourceDirectory, 'normalized/hotels.jsonl')).text())
  .trim()
  .split('\n')
  .map((line) =>
    z
      .object({ hotelId: z.string(), name: z.string(), source: z.object({ url: z.httpUrl() }) })
      .parse(JSON.parse(line)),
  );
const suffixes = [
  'Horizonte',
  'Luz',
  'Azahar',
  'Serena',
  'Alameda',
  'Jardín',
  'Cielo',
  'Balcón',
  'Oasis',
  'Duna',
  'Palmera',
  'Terraza',
  'Alba',
  'Patio',
  'Solana',
  'Esencia',
  'Arboleda',
  'Refugio',
];
const usedNames = new Set<string>();
const names = new Map(
  details.hotels.map((hotel, index) => {
    const row = attributes.find((row) => row.hotelId === hotel.hotelId);
    if (!row) throw new Error(`Missing attributes: ${hotel.hotelId}`);
    const brand = brands[row.brand];
    const city = hotel.locationText?.split(',')[0] ?? 'Destino';
    const base = `${brand[0]?.toUpperCase()}${brand.slice(1)} ${city}`;
    let name = `${base} ${suffixes[index % suffixes.length]}`;
    for (let attempt = 1; usedNames.has(name); attempt++) {
      if (attempt >= suffixes.length) throw new Error(`Too many hotels in ${city}`);
      name = `${base} ${suffixes[(index + attempt) % suffixes.length]}`;
    }
    usedNames.add(name);
    return [hotel.hotelId, name];
  }),
);
if (new Set(names.values()).size !== names.size) throw new Error('Duplicate demo names');
const replacements = identities
  .map((hotel) => [hotel.name, names.get(hotel.hotelId) ?? 'el hotel'] as const)
  .sort((a, b) => b[0].length - a[0].length);
function rename(text: string): string {
  let result = text;
  for (const [original, name] of replacements) result = result.replaceAll(original, name);
  return result
    .replace(/\bbarcel[oó]\b/giu, 'Aurora')
    .replace(/royal hideaway/giu, 'Mirador')
    .replace(/occidental/giu, 'Brisa')
    .replace(/allegro/giu, 'Natura')
    .replace(/royal level/giu, 'Premium');
}
const prepared = details.hotels.map((detail) => {
  const image = images.find((image) => image.hotelId === detail.hotelId);
  const original = identities.find((hotel) => hotel.hotelId === detail.hotelId);
  const attributeRow = attributes.find((hotel) => hotel.hotelId === detail.hotelId);
  const name = names.get(detail.hotelId);
  if (!image || !original || !attributeRow || !name)
    throw new Error(`Incomplete hotel: ${detail.hotelId}`);
  const id = `demo-${detail.hotelId}`;
  const photoUrl = new URL(image.url);
  if (!['static-dm.barcelo.com', 'preview3.assetsadobe.com'].includes(photoUrl.hostname))
    throw new Error(`Unexpected image host: ${photoUrl.hostname}`);
  photoUrl.search = new URLSearchParams({
    wid: '960',
    hei: '640',
    fit: 'crop,1',
    qlt: '78',
    fmt: 'webp',
  }).toString();
  const attrs = attributeRow.attributes;
  const themes = attrs.themes
    ?.slice(0, 4)
    .map((theme) => rename(theme.label))
    .join(', ');
  const description = `${name}, en ${detail.locationText}.${attrs.stars ? ` Un hotel de ${attrs.stars} estrellas` : ' Un hotel'}${themes ? ` con propuestas de ${themes.toLocaleLowerCase('es')}` : ' para descubrir el destino'}. Consulta sus características y servicios en esta ficha de demostración.`;
  const rating = detail.ratingText?.match(/^(\d(?:[.,]\d+)?)\/5$/u)?.[1];
  const reviews = detail.reviewCountText?.match(/^([\d., ]+) reseñas?$/u)?.[1];
  const hotel = CatalogHotelSchema.parse({
    id,
    name,
    description,
    sourceUrl: null,
    descriptionSource: {
      kind: 'editorial',
      sourceUrl: null,
      sourceRevision: createHash('sha256').update(description).digest('hex'),
    },
    location: detail.locationText,
    country: detail.locationText?.split(',').at(-1)?.trim() ?? null,
    guestRating: rating ? Number(rating.replace(',', '.')) : null,
    reviewCount: reviews ? Number(reviews.replace(/[., ]/gu, '')) : null,
    highlights: detail.highlights?.map(rename) ?? null,
    labels: detail.labels?.map(rename) ?? null,
    image: { url: photoUrl.href, alt: `Vista del hotel ${name}` },
    brand: brands[attributeRow.brand],
    attributes: {
      ...attrs,
      pets: {
        ...attrs.pets,
        policyText: attrs.pets.policyText ? rename(attrs.pets.policyText) : null,
      },
    },
  });
  return {
    hotel,
    source: {
      hotelId: id,
      originalName: original.name,
      sourceUrl: original.source.url,
      imageSourceUrl: image.url,
      imageUrl: photoUrl.href,
    },
  };
});
const catalog = prepared.map(({ hotel }) => hotel);
const manifest = prepared.map(({ source }) => source);
console.log(`Prepared ${catalog.length} hotels with remote image URLs`);
await Bun.write(resolve(root, 'data/demo/hotels.json'), `${JSON.stringify(catalog, null, 2)}\n`);
await Bun.write(
  resolve(root, 'data/demo/provenance.json'),
  `${JSON.stringify(
    {
      sourceUrl: details.sourceUrl,
      capturedAt: details.capturedAt,
      note: 'Educational snapshot. Names and brands replaced; descriptions rewritten. Original factual attributes and photos retained. Not a current offer, and no image rights transfer is implied.',
      hotels: manifest,
    },
    null,
    2,
  )}\n`,
);
