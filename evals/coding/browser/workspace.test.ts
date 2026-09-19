import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

test('compila los exports del candidato aunque node_modules apunte a otro checkout', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'coding-eval-workspace-'));
  try {
    const shared = resolve(root, 'shared-node-modules/@hoteles/core');
    const candidate = resolve(root, 'candidate');
    await mkdir(shared, { recursive: true });
    await mkdir(resolve(candidate, 'packages/core'), { recursive: true });
    const manifest = JSON.stringify({
      name: '@hoteles/core',
      type: 'module',
      exports: { './catalog': './catalog.ts' },
    });
    await writeFile(resolve(shared, 'package.json'), manifest);
    await writeFile(resolve(shared, 'catalog.ts'), 'export const source = "controller";');
    await writeFile(resolve(candidate, 'packages/core/package.json'), manifest);
    await writeFile(
      resolve(candidate, 'packages/core/catalog.ts'),
      'export const source = "candidate";',
    );
    await symlink(resolve(root, 'shared-node-modules'), resolve(candidate, 'node_modules'));
    await writeFile(
      resolve(candidate, 'entry.ts'),
      'export { source } from "@hoteles/core/catalog";',
    );
    const script = `import {candidateModule} from ${JSON.stringify(resolve(import.meta.dir, 'workspace.ts'))}; const module = await import(await candidateModule('entry.ts')); console.log(module.source);`;
    const process = Bun.spawn([Bun.which('bun') ?? 'bun', '-e', script], {
      cwd: candidate,
      env: {
        ...Bun.env,
        EVAL_PROJECT_ROOT: candidate,
        EVAL_BROWSER_OUTPUT: resolve(root, 'artifacts'),
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' });
    expect(stdout.trim()).toBe('candidate');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
