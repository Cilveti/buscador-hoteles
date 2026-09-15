import { expect, test } from 'bun:test';
import { type EditableHotel, type HotelDetails, projectHotels } from './project-hotels';

const row = {
  externalHotelId: '7333',
  name: 'Retiro editado',
  sourceName: 'Aurora Patio Azul',
  sourceUrl: 'https://hoteles.example/aurora-patio-azul/',
  sourceDescription: 'Descripción importada',
  editorialDescription: 'Descripción editorial',
} satisfies EditableHotel;
const detail: HotelDetails = {
  hotelId: '7333',
  locationText: 'Málaga, Spain',
  ratingText: '4.6/5',
  reviewCountText: '1.234 reseñas',
  highlights: ['Junto a la estación'],
  labels: [],
  images: [{ url: null, alt: 'full' }],
};

test('projects edited content with source identity and lazy image fallback, without leaking admin fields', () => {
  const privateRow = { ...row, sourceEvidence: 'private' };
  const result = projectHotels(
    [privateRow],
    [detail],
    [{ hotelId: '7333', url: '/images/hotel-1.svg', alt: 'Piscina' }],
  );
  expect(result).toEqual([
    {
      id: '7333',
      name: 'Retiro editado',
      description: 'Descripción editorial',
      sourceUrl: row.sourceUrl,
      descriptionSource: { kind: 'editorial', sourceUrl: null, sourceRevision: expect.any(String) },
      location: 'Málaga, Spain',
      country: 'Spain',
      brand: null,
      guestRating: 4.6,
      reviewCount: 1234,
      highlights: ['Junto a la estación'],
      labels: [],
      image: { url: '/images/hotel-1.svg', alt: 'Piscina' },
    },
  ]);
});

test('distinguishes the imported revision from subsequent editorial revisions', () => {
  const imported = {
    ...row,
    editorialDescription: null,
    sourceRevision: 'source-snapshot',
    capturedAt: '2026-09-10T12:00:00.000Z',
  };
  expect(projectHotels([imported], [], [])[0]?.descriptionSource).toEqual({
    kind: 'synthetic',
    sourceUrl: row.sourceUrl,
    sourceRevision: 'source-snapshot',
    capturedAt: imported.capturedAt,
  });
  const before = projectHotels([row], [], [])[0]?.descriptionSource;
  const after = projectHotels([{ ...row, editorialDescription: 'Descripción revisada' }], [], [])[0]
    ?.descriptionSource;
  expect(after).toMatchObject({ kind: 'editorial', sourceUrl: null });
  expect(after?.sourceRevision).not.toBe(before?.sourceRevision);
});

test('preserves unknown facts and falls back to imported description when no editorial value exists', () => {
  const result = projectHotels(
    [{ ...row, editorialDescription: ' ', sourceName: null, sourceUrl: 'javascript:alert(1)' }],
    [],
    [],
  );
  expect(result[0]).toMatchObject({
    description: 'Descripción importada',
    sourceUrl: null,
    country: null,
    brand: null,
    guestRating: null,
    reviewCount: null,
    highlights: null,
    labels: null,
    image: null,
  });
  expect(projectHotels([], [detail], []).length).toBe(0);
});

test('does not confuse stars with guest ratings or infer a country from a lone location', () => {
  const result = projectHotels(
    [row],
    [
      {
        ...detail,
        locationText: 'Málaga',
        ratingText: '5 estrellas',
        reviewCountText: 'sin reseñas',
        images: [{ url: 'data:image/png;base64,x', alt: null }],
      },
    ],
    [],
  );
  expect(result[0]).toMatchObject({
    country: null,
    guestRating: null,
    reviewCount: null,
    image: null,
  });
});

test('no deduce la marca a partir del nombre comercial', () => {
  const rows = [
    { ...row, externalHotelId: '1', sourceName: 'Aurora Patio Azul' },
    { ...row, externalHotelId: '2', sourceName: 'Casa cerca de Brisa' },
  ];
  expect(projectHotels(rows, [], []).map((hotel) => hotel.brand)).toEqual([null, null]);
});
