import { afterEach, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './policy';
import { createTask, hash, startAttempt } from './state';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('worker serialization binds a real patch to a hash without executing candidate code', () => {
  const temp = mkdtempSync(join(tmpdir(), 'factory-worker-'));
  roots.push(temp);
  const candidate = join(temp, 'candidate');
  mkdirSync(join(temp, 'task'));
  mkdirSync(join(candidate, 'apps/web/src'), { recursive: true });
  git(candidate, 'init', '-q');
  git(candidate, 'config', 'user.name', 'Test');
  git(candidate, 'config', 'user.email', 'test@example.invalid');
  writeFileSync(join(candidate, 'apps/web/src/example.ts'), 'export const version = 1;\n');
  git(candidate, 'add', '.');
  git(candidate, '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'base');
  const task = startAttempt(
    createTask({
      issue: 1,
      baseSha: 'a'.repeat(40),
      title: 'Test fixture',
      body: 'Change version',
      author: 'owner',
      profile: 'basic',
      actor: 'owner',
    }),
    '1',
    3,
  );
  writeFileSync(join(temp, 'task/task.json'), JSON.stringify(task));
  writeFileSync(join(candidate, 'apps/web/src/example.ts'), 'export const version = 2;\n');
  writeFileSync(
    join(temp, 'worker-result.json'),
    JSON.stringify({ status: 'implemented', summary: 'Test fixture response, not a model run' }),
  );
  const output = join(temp, 'output');
  execFileSync('bun', ['factory/worker.ts', 'serialize'], {
    env: { ...process.env, RUNNER_TEMP: temp, GITHUB_OUTPUT: output },
  });
  const patch = readFileSync(join(temp, 'agent.patch'));
  expect(patch.toString()).toContain('+export const version = 2;');
  expect(readFileSync(output, 'utf8')).toContain(`patch_sha=${hash(patch)}`);
  expect(readFileSync(output, 'utf8')).toContain('status=generated');
  writeFileSync(join(candidate, 'apps/web/src/package.json'), '{}');
  expect(() =>
    execFileSync('bun', ['factory/worker.ts', 'serialize'], {
      env: { ...process.env, RUNNER_TEMP: temp, GITHUB_OUTPUT: output },
      stdio: 'pipe',
    }),
  ).toThrow();
});
