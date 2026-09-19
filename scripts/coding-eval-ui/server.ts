import { randomBytes } from 'node:crypto';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss from 'postcss';
import { accessBootstrap, createAccessGuard, loadAccess } from './access';
import { createLabApi } from './api';

const project = resolve(import.meta.dir, '../..');
const source = resolve(project, 'evals/coding/ui');
const output = resolve(project, '.agent-evals/ui/web');
mkdirSync(output, { recursive: true });
const build = await Bun.build({
  entrypoints: [resolve(source, 'entry.tsx')],
  outdir: output,
  target: 'browser',
  tsconfig: resolve(source, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'project-ui',
      setup(builder) {
        builder.onResolve({ filter: /^react(?:-dom)?(?:\/|$)/ }, ({ path }) => ({
          path: Bun.resolveSync(path, resolve(project, 'apps/web')),
        }));
        builder.onResolve({ filter: /^@\// }, ({ path }) => ({
          path: Bun.resolveSync(resolve(project, 'apps/web/src', path.slice(2)), project),
        }));
      },
    },
  ],
});
if (!build.success) throw new Error(build.logs.join('\n'));
const cssFile = resolve(source, 'style.css');
const css = await postcss([tailwind({ base: resolve(project, 'apps/web') })]).process(
  await Bun.file(cssFile).text(),
  { from: cssFile },
);
await Bun.write(resolve(output, 'style.css'), css.css);
const api = createLabApi(project, randomBytes(32).toString('hex'), async (configPath, logPath) => {
  const descriptor = openSync(logPath, 'w', 0o600);
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '--no-env-file',
        resolve(project, 'scripts/coding-eval/cli.ts'),
        '--config',
        configPath,
      ],
      { cwd: project, stdin: 'ignore', stdout: descriptor, stderr: descriptor },
    );
    return await child.exited;
  } finally {
    closeSync(descriptor);
  }
});
const port = Number(process.env.EVAL_UI_PORT ?? 3415);
const access = createAccessGuard(loadAccess(resolve(project, '.agent-evals/ui/access.json')));
const html =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Laboratorio de arneses</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/access.js"></script></body></html>';
const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  maxRequestBodySize: 2 * 1024 * 1024,
  async fetch(request) {
    const url = new URL(request.url);
    if (
      url.hostname !== '127.0.0.1' ||
      (request.headers.get('host') && request.headers.get('host') !== url.host)
    )
      return new Response('Solo loopback', { status: 403 });
    let response: Response;
    const denied = await access(request);
    if (denied) response = denied;
    else if (url.pathname.startsWith('/api/')) response = await api(request);
    else if (request.method !== 'GET')
      response = new Response('Method not allowed', { status: 405 });
    else if (url.pathname === '/access.js')
      response = new Response(accessBootstrap, { headers: { 'content-type': 'text/javascript' } });
    else if (url.pathname === '/')
      response = new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    else if (url.pathname === '/entry.js' || url.pathname === '/style.css')
      response = new Response(Bun.file(resolve(output, url.pathname.slice(1))));
    else response = new Response('Not found', { status: 404 });
    if (request.headers.get('cookie')?.includes(`harness_lab_${port}=`))
      response.headers.set(
        'Set-Cookie',
        `harness_lab_${port}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
      );
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
    );
    return response;
  },
});
console.log(`Laboratorio de arneses: ${server.url}`);
console.log('Proceso aislado. Preparar ejecuta checks; Lanzar consume modelos según la receta.');
