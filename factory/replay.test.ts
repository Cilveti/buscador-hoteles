import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTask, hash } from './state';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('review replay rejects failed checks or a substituted patch before a model can run', () => {
  const root = mkdtempSync(join(tmpdir(), 'factory-replay-test-'));
  roots.push(root);
  for (const dir of ['task', 'proposal', 'checks']) mkdirSync(join(root, dir));
  const task = createTask({
    issue: 8,
    baseSha: 'a'.repeat(40),
    title: 'Snapshot',
    body: 'Frozen',
    author: 'owner',
    profile: 'basic',
    actor: 'owner',
  });
  writeFileSync(join(root, 'task/task.json'), JSON.stringify(task));
  writeFileSync(join(root, 'proposal/agent.patch'), 'original patch');
  const evidence = {
    passed: true,
    baseSha: task.baseSha,
    specificationSha: task.specificationSha,
    patchSha: hash('original patch'),
  };
  const execute = () =>
    spawnSync(process.execPath, ['factory/replay.ts', 'prepare'], {
      env: { RUNNER_TEMP: root, GITHUB_OUTPUT: join(root, 'output') },
      encoding: 'utf8',
    });
  writeFileSync(join(root, 'checks/feedback.json'), JSON.stringify(evidence));
  expect(execute().status).toBe(0);
  expect(readFileSync(join(root, 'output'), 'utf8')).toContain(`patch_sha=${evidence.patchSha}`);
  writeFileSync(join(root, 'checks/feedback.json'), JSON.stringify({ ...evidence, passed: false }));
  expect(execute().status).toBe(1);
  writeFileSync(join(root, 'checks/feedback.json'), JSON.stringify(evidence));
  writeFileSync(join(root, 'proposal/agent.patch'), 'substituted patch');
  expect(execute().status).toBe(1);
});

test('an unconfigured actor cannot request a replay or call GitHub', () => {
  const result = spawnSync(process.execPath, ['factory/replay.ts', 'admit'], {
    env: {
      RUNNER_TEMP: '/tmp',
      GITHUB_REPOSITORY: 'Cilveti/buscador-hoteles',
      GITHUB_ACTOR: 'outsider',
      SOURCE_RUN: '1',
    },
    encoding: 'utf8',
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Only a configured operator');
});
