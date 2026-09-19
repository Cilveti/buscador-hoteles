import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { z } from 'zod';

export function git(
  root: string,
  args: string[],
  options: { env?: Record<string, string>; input?: string } = {},
): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, ...options.env },
    input: options.input,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trimEnd();
}

/** A private index freezes tracked + untracked files, without staging or committing the user's checkout. */
export function snapshot(root: string, output: string, parent = 'HEAD'): string {
  mkdirSync(output, { recursive: true });
  const index = resolve(output, `index-${randomUUID()}`);
  const env = { GIT_INDEX_FILE: index };
  try {
    git(root, ['read-tree', parent], { env });
    git(root, ['add', '-A', '--', '.'], { env });
    const files = git(root, ['ls-files', '-z'], { env }).split('\0').filter(Boolean);
    const secret = files.find(
      (file) => /(?:^|\/)\.env(?:$|\.)/.test(file) && !file.endsWith('.example'),
    );
    if (secret) throw new Error(`Refusing to snapshot environment credentials: ${secret}`);
    const tree = git(root, ['write-tree'], { env });
    return git(
      root,
      [
        '-c',
        'user.name=Agent evaluation',
        '-c',
        'user.email=eval@localhost',
        'commit-tree',
        tree,
        '-p',
        parent,
      ],
      { input: 'Local evaluation snapshot\n' },
    );
  } finally {
    rmSync(index, { force: true });
    rmSync(`${index}.lock`, { force: true });
  }
}

export function createWorktree(project: string, destination: string, commit: string): void {
  mkdirSync(dirname(destination), { recursive: true });
  git(project, ['worktree', 'add', '--detach', destination, commit]);
}

/** External dependencies are shared; workspace packages always resolve inside this worktree. */
export function linkDependencies(project: string, worktree: string, dependencyCopy?: string): void {
  const linkDirectory = (source: string, target: string, scope = '') => {
    if (!existsSync(source)) return;
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      const from = join(source, entry.name),
        to = join(target, entry.name);
      if (dependencyCopy && source !== join(project, 'node_modules'))
        rmSync(to, { recursive: true, force: true });
      if (existsSync(to)) continue;
      if (dependencyCopy && entry.name === '.bin') {
        cpSync(from, to, { recursive: true, verbatimSymlinks: true });
        continue;
      }
      if (entry.name.startsWith('@') && !scope) {
        linkDirectory(from, to, entry.name);
        continue;
      }
      let local =
        scope === '@hoteles' ? join(worktree, 'packages', entry.name) : realpathSync(from);
      if (dependencyCopy && local.startsWith(`${project}/node_modules/`))
        local = join(dependencyCopy, relative(project, local));
      symlinkSync(relative(dirname(to), local), to, 'dir');
    }
  };
  for (const folder of [
    '',
    'apps/web',
    ...readdirSync(join(project, 'packages')).map((name) => `packages/${name}`),
  ]) {
    if (dependencyCopy && folder === '') continue;
    linkDirectory(join(project, folder, 'node_modules'), join(worktree, folder, 'node_modules'));
  }
}

export function provisionSkills(
  worktree: string,
  selected: string[],
  browserSkill: boolean,
): string[] {
  const enabled = new Set(selected);
  if (browserSkill) enabled.add('hoteles-verificar-buscador');
  else enabled.delete('hoteles-verificar-buscador');
  rmSync(join(worktree, 'evals/coding/skill-locales'), { recursive: true, force: true });
  rmSync(join(worktree, '.agents/bitacoras'), { recursive: true, force: true });
  const base = join(worktree, '.agents/skills');
  for (const name of enabled)
    if (!existsSync(join(base, name, 'SKILL.md'))) throw new Error(`Missing skill: ${name}`);
  if (existsSync(base))
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!enabled.has(entry.name))
        rmSync(join(base, entry.name), { recursive: true, force: true });
    }
  return [...enabled].sort();
}

export function changedPaths(project: string, before: string, after: string): string[] {
  return git(project, ['diff', '--name-only', '--no-renames', '-z', before, after])
    .split('\0')
    .filter(Boolean);
}

export function isCheckConfig(path: string): boolean {
  return /(?:^|\/)(?:\.gitignore|package\.json|(?:bun|package|pnpm|yarn)[.-]lock.*|tsconfig[^/]*\.json|biome\.jsonc?|bunfig\.toml|\.dependency-cruiser\.[cm]?js|playwright\.config\.[cm]?[jt]s)$/.test(
    path,
  );
}

export function isReference(path: string): boolean {
  return (
    isCheckConfig(path) ||
    path.startsWith('tests/') ||
    /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    /(?:^|\/)AGENTS\.md$/.test(path) ||
    path.startsWith('.agents/') ||
    path.startsWith('evals/coding/') ||
    path.startsWith('scripts/verification/') ||
    path.startsWith('scripts/coding-eval/')
  );
}

const packageManifest = z.record(z.string(), z.unknown());
const isPackageManifest = (path: string) => /(?:^|\/)package\.json$/.test(path);

/** Keep product manifest fields; only the frozen command table belongs to the verifier. */
function manifestWithReferenceScripts(baseline: string, delivered: string): string {
  try {
    const original = packageManifest.parse(JSON.parse(baseline));
    const candidate = packageManifest.parse(JSON.parse(delivered));
    return `${JSON.stringify({ ...candidate, scripts: original.scripts }, null, 2)}\n`;
  } catch {
    // Invalid candidate JSON is a delivery defect. Do not silently repair it into a pass.
    return delivered;
  }
}

/** Restore frozen checks while retaining candidate product code and package exports/imports. */
export function restoreReferences(
  project: string,
  worktree: string,
  baseline: string,
  candidate: string,
  preserveTests = false,
) {
  const candidatePaths = new Set(
    git(project, ['ls-tree', '-r', '--name-only', '-z', candidate]).split('\0').filter(Boolean),
  );
  const originals = git(project, ['ls-tree', '-r', '--name-only', '-z', baseline])
    .split('\0')
    .filter(Boolean)
    .filter(isReference)
    .filter((path) => !isPackageManifest(path) || candidatePaths.has(path))
    .filter(
      (path) =>
        !preserveTests ||
        isCheckConfig(path) ||
        (!path.startsWith('tests/') && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)),
    );
  const originalSet = new Set(originals);
  const changed = changedPaths(project, baseline, candidate);
  const changes = changed.filter((path) => originalSet.has(path));
  const addedConfigs = changed.filter(
    (path) => !originalSet.has(path) && isCheckConfig(path) && !isPackageManifest(path),
  );
  const manifests = originals.filter(isPackageManifest).map((path) => ({
    path,
    content: manifestWithReferenceScripts(
      git(project, ['show', `${baseline}:${path}`]),
      git(project, ['show', `${candidate}:${path}`]),
    ),
  }));
  for (const path of addedConfigs) rmSync(join(worktree, path), { recursive: true, force: true });
  // Remove a replacement symlink/file ancestor before restoring trusted files.
  for (const path of originals) {
    let parent = dirname(path);
    const ancestors: string[] = [];
    while (parent !== '.') {
      ancestors.unshift(parent);
      parent = dirname(parent);
    }
    for (const dir of ancestors) {
      const target = join(worktree, dir);
      if (
        existsSync(target) &&
        (!lstatSync(target).isDirectory() || lstatSync(target).isSymbolicLink())
      )
        rmSync(target, { recursive: true, force: true });
    }
    rmSync(join(worktree, path), { recursive: true, force: true });
  }
  for (let i = 0; i < originals.length; i += 100)
    git(worktree, [
      'restore',
      `--source=${baseline}`,
      '--worktree',
      '--',
      ...originals.slice(i, i + 100),
    ]);
  for (const manifest of manifests) writeFileSync(join(worktree, manifest.path), manifest.content);
  return [
    ...changes.map((path) => ({
      path,
      restoredForExternalVerification: true,
      addedConfiguration: false,
      ...(isPackageManifest(path) ? { restoredFields: ['scripts'] } : {}),
    })),
    ...addedConfigs.map((path) => ({
      path,
      restoredForExternalVerification: true,
      addedConfiguration: true,
    })),
  ];
}

export function copyEvidenceFile(sourceRoot: string, destination: string, path: string): boolean {
  const from = resolve(sourceRoot, path);
  if (
    relative(sourceRoot, from).startsWith('..') ||
    !existsSync(from) ||
    !lstatSync(from).isFile() ||
    lstatSync(from).isSymbolicLink()
  )
    return false;
  const to = resolve(destination, path);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  return true;
}

export function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
export function saveJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
