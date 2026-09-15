import { resolve } from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss from 'postcss';
import { createCatalogHotelHandler } from '../../apps/web/src/app/api/catalog/hotels/[hotelId]/handler';
import { createCatalogHandler } from '../../apps/web/src/app/api/catalog/hotels/handler';
import { hotels } from './fixtures';

const directory = import.meta.dir;
const projectRoot = resolve(directory, '../..');
const output = resolve(process.env.TEST_BROWSER_OUTPUT ?? 'test-results/browser');
const searchHandler = createCatalogHandler(async () => structuredClone(hotels));
const detailHandler = createCatalogHotelHandler(async () => structuredClone(hotels));
const build = await Bun.build({
  entrypoints: [resolve(directory, 'entry.tsx')],
  outdir: resolve(output, 'web'),
  target: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
  tsconfig: resolve(projectRoot, 'apps/web/tsconfig.json'),
  plugins: [
    {
      name: 'catalog-test-ui',
      setup(builder) {
        builder.onResolve({ filter: /^react(?:-dom)?(?:\/|$)/ }, ({ path }) => ({
          path: Bun.resolveSync(path, resolve(projectRoot, 'apps/web')),
        }));
        builder.onResolve({ filter: /^next\/link$/ }, () => ({
          path: resolve(directory, 'link.tsx'),
        }));
        builder.onResolve({ filter: /^@\// }, ({ path }) => ({
          path: Bun.resolveSync(resolve(projectRoot, 'apps/web/src', path.slice(2)), projectRoot),
        }));
      },
    },
  ],
});
if (!build.success) throw new Error(build.logs.join('\n'));
const styles = resolve(projectRoot, 'apps/web/src/app/(frontend)/styles.css');
const source = (await Bun.file(styles).text()).replace(/@import "@fontsource[^;]+;/g, '');
const css = await postcss([tailwind({ base: resolve(projectRoot, 'apps/web/src') })]).process(
  source,
  { from: styles },
);
await Bun.write(resolve(output, 'web/style.css'), css.css);
const html =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buscador · Pruebas locales</title><link rel="stylesheet" href="/style.css"></head><body><div style="background:#040066;color:white;padding:8px;text-align:center">Pruebas locales · Datos sintéticos · Sin servicios externos</div><div id="root"></div><script type="module" src="/entry.js"></script></body></html>';
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.TEST_BROWSER_PORT ?? 3181),
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return Response.json({ status: 'catalog-test' });
    if (url.pathname === '/api/catalog/hotels') return searchHandler(request);
    const id = url.pathname.match(/^\/api\/catalog\/hotels\/([^/]+)$/)?.[1];
    if (id)
      return detailHandler(request, {
        params: Promise.resolve({ hotelId: decodeURIComponent(id) }),
      });
    if (url.pathname === '/style.css' || url.pathname === '/entry.js')
      return new Response(Bun.file(resolve(output, 'web', url.pathname.slice(1))));
    if (url.pathname === '/' || /^\/hotels\/[^/]+$/.test(url.pathname))
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    return new Response('Not found in isolated catalog harness', { status: 404 });
  },
});
console.log(`Test catalog: ${server.url} (source: ${projectRoot})`);
