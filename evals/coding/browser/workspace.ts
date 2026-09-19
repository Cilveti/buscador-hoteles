import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BunPlugin } from 'bun';

export const projectRoot = resolve(process.env.EVAL_PROJECT_ROOT ?? process.cwd());

/** Resolve workspace exports from the candidate, even when node_modules is shared. */
export const candidateWorkspace: BunPlugin = {
  name: 'candidate-workspace',
  setup(build) {
    build.onResolve({ filter: /^@hoteles\// }, async ({ path }) => {
      const [, name, ...parts] = path.split('/');
      if (!name) throw new Error(`Invalid workspace import: ${path}`);
      const packageRoot = resolve(projectRoot, 'packages', name);
      const manifest: unknown = JSON.parse(
        await readFile(resolve(packageRoot, 'package.json'), 'utf8'),
      );
      if (typeof manifest !== 'object' || manifest === null || !('exports' in manifest))
        throw new Error(`Missing exports: ${name}`);
      const exports = manifest.exports;
      const key = parts.length ? `./${parts.join('/')}` : '.';
      if (typeof exports !== 'object' || exports === null || !(key in exports))
        throw new Error(`Missing export: ${path}`);
      const entry = Reflect.get(exports, key);
      if (typeof entry !== 'string') throw new Error(`Unsupported workspace export: ${path}`);
      return { path: resolve(packageRoot, entry) };
    });
  },
};

/** Runtime Bun resolution can follow shared workspace symlinks; bundle first to pin imports. */
export async function candidateModule(relativePath: string): Promise<string> {
  const output = resolve(process.env.EVAL_BROWSER_OUTPUT ?? '.agent-evals/browser', 'modules');
  const result = await Bun.build({
    entrypoints: [resolve(projectRoot, relativePath)],
    target: 'bun',
    outdir: output,
    naming: '[name]-[hash].mjs',
    plugins: [candidateWorkspace],
  });
  if (!result.success) throw new Error(result.logs.join('\n'));
  const entry = result.outputs.find((file) => file.kind === 'entry-point');
  if (!entry) throw new Error(`No compiled candidate module: ${relativePath}`);
  return pathToFileURL(entry.path).href;
}
