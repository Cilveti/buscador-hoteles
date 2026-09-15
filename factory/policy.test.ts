import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { git, validateIndex } from './policy';

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
