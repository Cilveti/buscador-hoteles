import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

const accessSchema = z.object({ version: z.literal(2), token: z.string().regex(/^[a-f0-9]{64}$/) });

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
const params = new URLSearchParams(location.hash.slice(1));
const token = params.get('access') || localStorage.getItem('harness-lab-access');
if (params.has('access')) history.replaceState(null, '', location.pathname + location.search);
const response = await fetch('/api/bootstrap', { headers: token ? { Authorization: 'Bearer ' + token } : {} });
if (response.ok) {
  localStorage.setItem('harness-lab-access', token);
  await import('/entry.js');
} else {
  localStorage.removeItem('harness-lab-access');
  document.getElementById('root').textContent = 'Abre el laboratorio desde su enlace local de acceso.';
}
`;
