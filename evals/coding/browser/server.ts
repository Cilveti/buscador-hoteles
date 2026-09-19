import { resolve } from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss from 'postcss';
import { hotels } from './fixtures';
import { candidateModule, candidateWorkspace, projectRoot } from './workspace';

const directory = import.meta.dir;
const output = resolve(process.env.EVAL_BROWSER_OUTPUT ?? '.agent-evals/browser');
const catalog: typeof import('../../../apps/web/src/app/api/catalog/hotels/handler') = await import(
  await candidateModule('apps/web/src/app/api/catalog/hotels/handler.ts')
);
const detail: typeof import('../../../apps/web/src/app/api/catalog/hotels/[hotelId]/handler') =
  await import(await candidateModule('apps/web/src/app/api/catalog/hotels/[hotelId]/handler.ts'));
const searchHandler = catalog.createCatalogHandler(async () => structuredClone(hotels));
const detailHandler = detail.createCatalogHotelHandler(async () => structuredClone(hotels));
const build = await Bun.build({
  entrypoints: [resolve(directory, 'entry.tsx')],
  outdir: resolve(output, 'web'),
  target: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
  tsconfig: resolve(projectRoot, 'apps/web/tsconfig.json'),
  plugins: [
    candidateWorkspace,
    {
      name: 'candidate-ui',
      setup(builder) {
        builder.onResolve({ filter: /^react(?:-dom)?(?:\/|$)/ }, ({ path }) => ({
          path: Bun.resolveSync(path, resolve(projectRoot, 'apps/web')),
        }));
        builder.onResolve(
          {
            filter:
              /^\.\.\/\.\.\/\.\.\/apps\/web\/src\/features\/catalog\/adapters\/catalog-search$/,
          },
          () => ({
            path: resolve(projectRoot, 'apps/web/src/features/catalog/adapters/catalog-search.tsx'),
          }),
        );
        builder.onResolve(
          {
            filter:
              /^\.\.\/\.\.\/\.\.\/apps\/web\/src\/features\/catalog\/adapters\/hotel-detail-page$/,
          },
          () => ({
            path: resolve(
              projectRoot,
              'apps/web/src/features/catalog/adapters/hotel-detail-page.tsx',
            ),
          }),
        );
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
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buscador · Evaluación local</title><link rel="stylesheet" href="/style.css"></head><body><div style="background:#040066;color:white;padding:8px;text-align:center">Evaluación local · Datos sintéticos · Sin servicios externos</div><div id="root"></div><script type="module" src="/entry.js"></script></body></html>';
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.EVAL_BROWSER_PORT ?? 3413),
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health')
      return Response.json({ status: 'coding-eval', projectRoot });
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
console.log(`Candidate catalog: ${server.url} (source: ${projectRoot})`);
