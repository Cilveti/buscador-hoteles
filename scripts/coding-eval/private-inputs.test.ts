import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  acceptanceManifestSchema,
  copyPrivateEvidence,
  freezePrivateInputs,
} from './private-inputs';
import { git } from './workspace';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'private-eval-'));
  folders.push(root);
  const project = join(root, 'project'),
    source = join(root, 'dossier');
  mkdirSync(project);
  mkdirSync(source);
  git(project, ['init', '-q']);
  writeFileSync(join(source, 'dossier.json'), JSON.stringify({ taskId: 'filters', version: 'v1' }));
  mkdirSync(join(source, 'bugs'));
  writeFileSync(join(source, 'bugs/url.md'), 'Privileged bug evidence');
  return { root, project, source };
}

test('freezes privileged inputs with task, version and hashes independently of subsequent source edits', () => {
  const { root, project, source } = fixture();
  const frozen = freezePrivateInputs(
    project,
    'filters',
    'test',
    { judgeDossier: source, privateAcceptance: null },
    join(root, 'frozen'),
  );
  expect(frozen.dossier?.version).toBe('v1');
  expect(frozen.dossier?.files.map((file) => file.path)).toContain('bugs/url.md');
  writeFileSync(join(source, 'bugs/url.md'), 'Changed source');
  if (!frozen.dossier) throw new Error('Missing frozen dossier');
  copyPrivateEvidence(frozen.dossier, join(root, 'packet'));
  expect(readFileSync(join(root, 'packet/bugs/url.md'), 'utf8')).toBe('Privileged bug evidence');
  writeFileSync(join(frozen.dossier.root, 'bugs/url.md'), 'Tampered frozen evidence');
  const dossier = frozen.dossier;
  expect(() => copyPrivateEvidence(dossier, join(root, 'tampered'))).toThrow(
    'Frozen private input changed',
  );
});

test('rejects ignored in-project inputs, other Git repositories, symlinks and a wrong task', () => {
  const { root, project, source } = fixture();
  const freeze = (path: string, name: string) =>
    freezePrivateInputs(
      project,
      'filters',
      name,
      { judgeDossier: path, privateAcceptance: null },
      join(root, name),
    );
  mkdirSync(join(project, '.private'));
  expect(() => freeze(join(project, '.private'), 'inside')).toThrow('outside the project');
  git(source, ['init', '-q']);
  expect(() => freeze(source, 'git')).toThrow('outside Git');
  rmSync(join(source, '.git'), { recursive: true });
  symlinkSync(join(source, 'bugs/url.md'), join(source, 'linked.md'));
  expect(() => freeze(source, 'symlink')).toThrow('symlinks');
  rmSync(join(source, 'linked.md'));
  writeFileSync(
    join(source, 'dossier.json'),
    JSON.stringify({ taskId: 'another-task', version: 'v1' }),
  );
  expect(() => freeze(source, 'wrong')).toThrow('not filters');
});

test('acceptance command cannot bypass its frozen script with an absolute or parent path', () => {
  for (const command of [
    ['bun', '/tmp/source/verify.ts'],
    ['bun', 'run', '../verify.ts'],
    ['bun', 'test', '--config=/tmp/config.ts'],
    ['/tmp/verify.sh'],
  ]) {
    expect(() =>
      acceptanceManifestSchema.parse({ taskId: 'filters', version: 'v1', command }),
    ).toThrow();
  }
  expect(
    acceptanceManifestSchema.parse({
      taskId: 'filters',
      version: 'v1',
      command: ['bun', 'run', './verify.ts'],
    }).command,
  ).toEqual(['bun', 'run', './verify.ts']);
});
