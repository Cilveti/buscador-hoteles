import { resolve } from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss from 'postcss';
import { createCatalogHotelHandler } from '../../apps/web/src/app/api/catalog/hotels/[hotelId]/handler';
import { createCatalogHandler } from '../../apps/web/src/app/api/catalog/hotels/handler';
import { CatalogHotelSchema } from '../../packages/contracts/src/catalog';
import { hotels } from './fixtures';

const directory = import.meta.dir;
const projectRoot = resolve(directory, '../..');
const output = resolve(process.env.TEST_BROWSER_OUTPUT ?? 'test-results/browser');
// Explicit opt-in: automated browser checks retain their small deterministic fixtures.
const demo = process.argv.includes('--demo');
const catalog = demo
  ? CatalogHotelSchema.array().parse(
      await Bun.file(resolve(projectRoot, 'data/demo/hotels.json')).json(),
    )
  : hotels;
const searchHandler = createCatalogHandler(async () => structuredClone(catalog));
const detailHandler = createCatalogHotelHandler(async () => structuredClone(catalog));
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
const banner = demo
  ? `Demo local · ${catalog.length} hoteles · Nombres ficticios · Datos y fotos de una captura de septiembre de 2026`
  : 'Pruebas locales · Datos sintéticos · Sin servicios externos';
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buscador · ${demo ? 'Demo' : 'Pruebas locales'}</title><link rel="stylesheet" href="/style.css"></head><body><div style="background:#040066;color:white;padding:8px;text-align:center">${banner}</div><div id="root"></div><script type="module" src="/entry.js"></script></body></html>`;
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.TEST_BROWSER_PORT ?? 3181),
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health')
      return Response.json({
        status: demo ? 'catalog-demo' : 'catalog-test',
        hotels: catalog.length,
      });
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
console.log(
  `${demo ? 'Demo' : 'Test'} catalog: http://localhost:${server.port} (source: ${projectRoot})`,
);
