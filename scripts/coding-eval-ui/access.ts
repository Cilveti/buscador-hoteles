import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

const accessSchema = z.object({ version: z.literal(2), token: z.string().regex(/^[a-f0-9]{64}$/) });

export function isLocalLabHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/** Controller-only capability. Version 2 rotates the former cookie credential. */
export function loadAccess(file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const parsed = existsSync(file)
    ? accessSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
    : null;
  const access = parsed?.success
    ? parsed.data
    : { version: 2, token: randomBytes(32).toString('hex') };
  if (!parsed?.success) writeFileSync(file, JSON.stringify(access), { mode: 0o600 });
  chmodSync(file, 0o600);
  return access.token;
}

/** Authentication is explicit, scoped by the client to this origin; cookies cross localhost ports. */
export function createAccessGuard(token: string) {
  return (request: Request): Response | null => {
    if (!new URL(request.url).pathname.startsWith('/api/')) return null;
    const authorization = request.headers.get('authorization');
    const value = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    const matches =
      typeof value === 'string' &&
      /^[a-f0-9]{64}$/.test(value) &&
      timingSafeEqual(Buffer.from(value), Buffer.from(token));
    return matches ? null : Response.json({ error: 'Sesión local requerida.' }, { status: 403 });
  };
}

// Persisted per origin (including port), never automatically sent to another localhost server.
export const accessBootstrap = `
addEventListener('hashchange', () => {
  if (new URLSearchParams(location.hash.slice(1)).has('access')) location.reload();
});
const params = new URLSearchParams(location.hash.slice(1));
const token = params.get('access') || localStorage.getItem('harness-lab-access');
if (params.has('access')) history.replaceState(null, '', location.pathname + location.search);
if (location.hostname === '127.0.0.1') {
  const target = new URL(location.href);
  target.hostname = 'localhost';
  target.hash = token ? 'access=' + encodeURIComponent(token) : '';
  location.replace(target.href);
} else if (!token && !sessionStorage.getItem('harness-lab-legacy-checked')) {
  // localStorage is per hostname. Recover an existing authorization once before asking again.
  sessionStorage.setItem('harness-lab-legacy-checked', '1');
  const previous = new URL(location.href);
  previous.hostname = '127.0.0.1';
  previous.hash = '';
  location.replace(previous.href);
} else {
  const response = await fetch('/api/bootstrap', { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  if (response.ok) {
    localStorage.setItem('harness-lab-access', token);
    await import('/entry.js');
  } else if (response.status === 403) {
    localStorage.removeItem('harness-lab-access');
    document.getElementById('root').textContent = 'Este navegador aún no tiene acceso. Abre una vez el enlace local de autorización; después podrás entrar directamente en ' + location.origin + ' o guardarlo en favoritos. La autorización protege los resultados privados de los agentes evaluados.';
  } else {
    document.getElementById('root').textContent = 'No se pudo cargar el laboratorio. Recarga la página para reintentar; tu acceso sigue guardado.';
  }
}
`;
