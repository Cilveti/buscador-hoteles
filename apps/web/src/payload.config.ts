import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { buildConfig } from 'payload';
import { Hotels, Users } from './payload/collections';

const directory = dirname(fileURLToPath(import.meta.url));
const secret = process.env.PAYLOAD_SECRET;
const databaseURL = process.env.DATABASE_URL;
if (!secret || !databaseURL)
  throw new Error('Faltan PAYLOAD_SECRET o DATABASE_URL en el entorno del servidor.');

export default buildConfig({
  secret,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: directory,
      importMapFile: resolve(directory, 'app/(payload)/admin/importMap.ts'),
    },
  },
  collections: [Users, Hotels],
  db: postgresAdapter({
    pool: { connectionString: databaseURL },
    push: process.env.PAYLOAD_SCHEMA_PUSH === 'true',
  }),
  typescript: { outputFile: resolve(directory, 'payload-types.ts') },
});
