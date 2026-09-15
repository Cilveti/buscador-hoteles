import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';

const target = '.env.local';
let content = await readFile(target, 'utf8').catch((error: unknown) => {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return '';
  throw error;
});

/** Conserva los valores locales existentes para que repetir setup no cambie las credenciales. */
function ensure(name: string, fallback: () => string): string {
  const line = new RegExp(`^${name}=(.*)$`, 'm');
  const existing = content.match(line);
  const value = existing?.[1]?.trim();
  if (value) return value;
  const generated = fallback();
  if (existing) content = content.replace(line, `${name}=${generated}`);
  else content += `${content.endsWith('\n') ? '' : '\n'}${name}=${generated}\n`;
  return generated;
}

const password = ensure('HOTELES_POSTGRES_PASSWORD', () => randomBytes(24).toString('hex'));
const database = ensure(
  'DATABASE_URL',
  () => `postgresql://hoteles:${encodeURIComponent(password)}@127.0.0.1:55433/hoteles`,
);
const url = new URL(database);
if (url.hostname !== '127.0.0.1' || url.port !== '55433' || url.pathname !== '/hoteles') {
  throw new Error('DATABASE_URL debe apuntar a la base local exclusiva: 127.0.0.1:55433/hoteles.');
}
ensure('PAYLOAD_SECRET', () => randomBytes(32).toString('hex'));
ensure('ADMIN_EMAIL', () => 'admin@buscador-hoteles.test');
ensure('ADMIN_PASSWORD', () => randomBytes(24).toString('hex'));
await writeFile(target, content, { mode: 0o600 });
await chmod(target, 0o600);
console.log(
  'Entorno preparado en .env.local. Credenciales nuevas para este proyecto; no se muestran en la salida.',
);
