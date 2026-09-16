import { afterEach, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { git, validateIndex, verifyUnchangedCheckout } from './policy';
import { hash } from './state';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function checkout() {
  const root = mkdtempSync(join(tmpdir(), 'factory-policy-'));
  roots.push(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.invalid');
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ scripts: { test: 'bun test' }, dependencies: {} }),
  );
  git(root, 'add', '.');
  git(root, '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'base');
  return root;
}

function put(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
  git(root, 'add', '-A');
}

test('real Git index accepts an application patch and rejects a protected workflow', () => {
  const root = checkout();
  put(root, 'apps/web/src/feature.ts', 'export const count = 1;\n');
  expect(validateIndex(root, 'basic', 200_000)).toEqual(['apps/web/src/feature.ts']);
  put(root, '.github/workflows/bypass.yml', 'permissions: write-all\n');
  expect(() => validateIndex(root, 'full', 200_000)).toThrow('Forbidden path');
});

test('real Git index rejects symlinks even under an allowed source path', () => {
  const root = checkout();
  mkdirSync(join(root, 'apps/web/src'), { recursive: true });
  symlinkSync('/tmp', join(root, 'apps/web/src/link.ts'));
  git(root, 'add', '-A');
  expect(() => validateIndex(root, 'full', 200_000)).toThrow('regular files');
});

test('full dependency authority does not grant permission to change package scripts', () => {
  const root = checkout();
  put(root, 'package.json', JSON.stringify({ scripts: { test: 'true' }, dependencies: {} }));
  expect(() => validateIndex(root, 'full', 200_000)).toThrow('Protected manifest field');
});

test('verification rejects changed indexes, unstaged repairs and extra files', () => {
  const root = checkout();
  const source = 'apps/web/src/feature.ts';
  put(root, source, 'export const count = 1;\n');
  const expected = hash(
    execFileSync('git', ['diff', '--cached', '--binary', '--full-index'], { cwd: root }),
  );
  expect(() => verifyUnchangedCheckout(root, expected)).not.toThrow();
  writeFileSync(join(root, 'extra.txt'), 'unexpected');
  expect(() => verifyUnchangedCheckout(root, expected)).toThrow('untracked');
  rmSync(join(root, 'extra.txt'));
  writeFileSync(join(root, source), 'export const count = 2;\n');
  expect(() => verifyUnchangedCheckout(root, expected)).toThrow('unstaged');
  git(root, 'add', '-A');
  expect(() => verifyUnchangedCheckout(root, expected)).toThrow('index changed');
});

test('nested check configuration cannot bypass root protection inside application source', () => {
  for (const name of ['biome.json', 'tsconfig.json', 'tsconfig.build.json', 'eslint.config.ts']) {
    const root = checkout();
    put(root, `apps/web/src/${name}`, JSON.stringify({ linter: { enabled: false } }));
    for (const profile of ['basic', 'full'] as const)
      expect(() => validateIndex(root, profile, 200_000)).toThrow('Forbidden path');
  }
  const root = checkout();
  put(root, 'apps/web/src/catalog-data.json', JSON.stringify({ label: 'Hoteles' }));
  expect(validateIndex(root, 'basic', 200_000)).toEqual(['apps/web/src/catalog-data.json']);
});
