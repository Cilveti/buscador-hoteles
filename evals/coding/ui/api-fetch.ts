/** Keep the private capability on this lab origin; localhost cookies would also reach other ports. */
export function apiFetch(path: string, init: RequestInit = {}) {
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/'))
    throw new Error('La solicitud no pertenece a la API del laboratorio.');
  const headers = new Headers(init.headers);
  const token = localStorage.getItem('harness-lab-access');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers, credentials: 'omit' });
}
