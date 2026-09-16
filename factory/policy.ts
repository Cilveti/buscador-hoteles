import { execFileSync } from 'node:child_process';
import { hash, type Profile } from './state';

export const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 4_000_000 }).trimEnd();

const manifest =
  /^(package\.json|apps\/web\/package\.json|packages\/(core|contracts|adapters)\/package\.json)$/;

// Dependency permission must not change the direct declarations of known verification tools.
const protectedDependencies = new Set([
  '@biomejs/biome',
  'typescript',
  '@playwright/test',
  'playwright',
  'dependency-cruiser',
  '@axe-core/playwright',
  '@types/bun',
  '@stryker-mutator/core',
  'tsx',
]);

export function allowedPath(path: string, profile: Profile): boolean {
  if (!/^[a-zA-Z0-9_./()[\]-]+$/.test(path)) return false;
  if (path.split('/').some((part) => !part || part.startsWith('.'))) return false;
  if (path === 'bun.lock' || manifest.test(path)) return profile === 'full';
  if (path.endsWith('/package.json') || path.endsWith('/bun.lock')) return false;
  // Nested configuration can change the checks even when the root config is protected.
  if (
    /(^|\/)(biome\.jsonc?|tsconfig(?:\.[a-zA-Z0-9_-]+)?\.json|eslint\.config\.[cm]?[jt]s)$/.test(
      path,
    )
  )
    return false;
  return /^(apps\/web\/src|packages\/(core|contracts|adapters)\/src)\/.+\.(ts|tsx|css|json)$/.test(
    path,
  );
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected a manifest object');
  return value as Record<string, unknown>;
}

/** Full allows registry dependency declarations, not scripts, configuration or arbitrary Git URLs. */
export function validateManifest(before: unknown, after: unknown): void {
  const oldManifest = record(before);
  const newManifest = record(after);
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies'];
  for (const key of new Set([...Object.keys(oldManifest), ...Object.keys(newManifest)])) {
    if (!sections.includes(key)) {
      if (JSON.stringify(oldManifest[key]) !== JSON.stringify(newManifest[key]))
        throw new Error(`Protected manifest field: ${key}`);
      continue;
    }
    const previous = record(oldManifest[key] ?? {});
    const next = record(newManifest[key] ?? {});
    for (const name of protectedDependencies) {
      if (previous[name] !== next[name])
        throw new Error(`Protected verification dependency: ${name}`);
    }
    for (const [name, version] of Object.entries(next)) {
      if (version === previous[name]) continue;
      if (!/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(name))
        throw new Error('Invalid dependency name');
      if (
        typeof version !== 'string' ||
        !/^[~^]?[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(version)
      )
        throw new Error(`Use a concrete registry version for ${name}`);
    }
  }
}

export function validateIndex(cwd: string, profile: Profile, maxBytes: number): string[] {
  const paths = git(cwd, 'diff', '--cached', '--name-only', '-z').split('\0').filter(Boolean);
  for (const path of paths) {
    if (!allowedPath(path, profile)) throw new Error(`Forbidden path: ${path}`);
    if (git(cwd, 'ls-files', '-s', '--', path).split(' ')[0] !== '100644')
      throw new Error(`Only regular files are allowed: ${path}`);
    if (manifest.test(path))
      validateManifest(
        JSON.parse(git(cwd, 'show', `HEAD:${path}`)),
        JSON.parse(git(cwd, 'show', `:${path}`)),
      );
  }
  const statuses = git(cwd, 'diff', '--cached', '--name-status', '--no-renames');
  if (
    statuses
      .split('\n')
      .filter(Boolean)
      .some((line) => !/^[AM]\t/.test(line))
  )
    throw new Error('Deletes and renames are not permitted');
  if (
    git(cwd, 'diff', '--cached', '--numstat')
      .split('\n')
      .some((line) => line.startsWith('-\t'))
  )
    throw new Error('Binary patches are not permitted');
  git(cwd, 'diff', '--cached', '--check');
  if (Buffer.byteLength(git(cwd, 'diff', '--cached', '--binary', '--full-index')) > maxBytes)
    throw new Error('Patch size limit exceeded');
  return paths;
}

/** Run outside the candidate containers: the verified checkout must still hold the original patch. */
export function verifyUnchangedCheckout(cwd: string, expectedHash: string): void {
  const patch = execFileSync('git', ['diff', '--cached', '--binary', '--full-index'], { cwd });
  if (hash(patch) !== expectedHash) throw new Error('Candidate index changed during verification');
  if (git(cwd, 'diff', '--name-only')) throw new Error('Candidate has unstaged mutations');
  if (git(cwd, 'ls-files', '--others', '--exclude-standard'))
    throw new Error('Candidate has unexpected untracked files');
}
