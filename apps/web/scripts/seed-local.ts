import { readFile } from 'node:fs/promises';
import { getPayload } from 'payload';
import { z } from 'zod';
import config from '../src/payload.config';

const environment = z
  .object({
    DATABASE_URL: z.string().url(),
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string().min(16),
  })
  .parse(process.env);
const database = new URL(environment.DATABASE_URL);
if (
  !['127.0.0.1', 'localhost'].includes(database.hostname) ||
  database.port !== '55433' ||
  database.pathname !== '/hoteles'
) {
  throw new Error('Esta utilidad solo admite la base de datos local del buscador determinista.');
}

const HotelSource = z.object({
  hotelId: z.string(),
  name: z.string(),
  sourceRevision: z.string(),
  source: z.object({ url: z.url().nullable(), capturedAt: z.iso.datetime() }),
  evidence: z.array(z.object({ kind: z.string(), text: z.string() }).catchall(z.json())),
  reviews: z.array(z.json()),
});
const lines = (
  await readFile(new URL('../../../data/hotels/normalized/hotels.jsonl', import.meta.url), 'utf8')
)
  .trim()
  .split('\n');
const hotels = lines.map((line) => HotelSource.parse(JSON.parse(line)));
if (hotels.length !== 60 || new Set(hotels.map((hotel) => hotel.hotelId)).size !== 60) {
  throw new Error('El corpus debe contener 60 hoteles únicos antes de importar.');
}

const payload = await getPayload({ config });
try {
  const users = await payload.find({
    collection: 'users',
    where: { email: { equals: environment.ADMIN_EMAIL } },
    limit: 1,
  });
  if (!users.docs.length)
    await payload.create({
      collection: 'users',
      data: {
        email: environment.ADMIN_EMAIL,
        password: environment.ADMIN_PASSWORD,
        name: 'Administrador del catálogo',
      },
    });

  let created = 0;
  let updated = 0;
  for (const hotel of hotels) {
    const existing = await payload.find({
      collection: 'hotels',
      where: { externalHotelId: { equals: hotel.hotelId } },
      limit: 1,
    });
    const data = {
      externalHotelId: hotel.hotelId,
      sourceName: hotel.name,
      sourceUrl: hotel.source.url,
      capturedAt: hotel.source.capturedAt,
      sourceRevision: hotel.sourceRevision,
      sourceDescription: hotel.evidence
        .filter((item) => item.kind === 'paragraph')
        .map((item) => item.text)
        .join('\n\n'),
      sourceEvidence: hotel.evidence,
      sourceReviews: hotel.reviews,
    };
    const previous = existing.docs[0];
    if (previous) {
      if (previous.sourceRevision !== hotel.sourceRevision || previous.sourceName !== hotel.name) {
        await payload.update({ collection: 'hotels', id: previous.id, data });
        updated++;
      }
    } else {
      await payload.create({ collection: 'hotels', data: { ...data, name: hotel.name } });
      created++;
    }
  }
  console.log(
    JSON.stringify({ corpus: hotels.length, created, updated, editorialValuesPreserved: true }),
  );
} finally {
  await payload.destroy();
}
// db-postgres 3.89 retiene su conexión de vigilancia: el CLI termina tras esperar todas las escrituras.
process.exit(0);
