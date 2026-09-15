import { describe, expect, test } from 'bun:test';
import { allowedPath, validateManifest } from './policy';
import {
  cancel,
  createTask,
  decide,
  finishAttempt,
  recover,
  reservePublication,
  startAttempt,
} from './state';

const initial = () =>
  createTask({
    issue: 7,
    baseSha: 'a'.repeat(40),
    title: 'Filtro',
    body: 'Acceptance',
    author: 'owner',
    profile: 'basic',
    actor: 'owner',
  });

describe('bounded task lifecycle', () => {
  test('a failed check consumes an attempt; the third stops the loop', () => {
    let task = initial();
    for (let n = 1; n <= 3; n++) {
      task = startAttempt(task, String(n), 3);
      task = finishAttempt(task, String(n), { status: 'retry', detail: 'Acceptance failed' }, 3);
      expect(task.status).toBe(n === 3 ? 'exhausted' : 'retry');
    }
    expect(() => startAttempt(task, '4', 3)).toThrow();
  });
  test('duplicate start and stale completion cannot advance the task', () => {
    const task = startAttempt(initial(), '1', 3);
    expect(() => startAttempt(task, '1', 3)).toThrow();
    expect(() => finishAttempt(task, '2', { status: 'passed', detail: '' }, 3)).toThrow();
  });
  test('approval grants requested scope once without resetting the budget', () => {
    const waiting = finishAttempt(
      startAttempt(initial(), '1', 3),
      '1',
      {
        status: 'needs-human',
        detail: 'Need date-fns 4.1.0 in apps/web/package.json',
        requestedProfile: 'full',
      },
      3,
    );
    const decision = {
      id: waiting.decision?.id ?? '',
      approve: true,
      actor: 'owner',
      commentId: '42',
    };
    const approved = decide(waiting, decision, ['owner'], 3);
    expect(approved.profile).toBe('full');
    expect(approved.attempts).toBe(1);
    expect(startAttempt(approved, '2', 3).attempts).toBe(2);
    expect(() => decide(approved, decision, ['owner'], 3)).toThrow();
    expect(() => decide(waiting, { ...decision, actor: 'bot' }, ['owner'], 3)).toThrow();
    expect(() => decide(waiting, { ...decision, id: 'stale' }, ['owner'], 3)).toThrow();
  });
  test('cancellation defeats an in-flight completion', () => {
    const task = cancel(startAttempt(initial(), '1', 3), 'owner', ['owner']);
    expect(() => finishAttempt(task, '1', { status: 'passed', detail: '' }, 3)).toThrow();
  });
  test('recovery requires the matching run and preserves budget and cancellation', () => {
    const running = startAttempt(initial(), '1', 3);
    const ready = recover(running, '1', 'owner', ['owner'], 3);
    expect(startAttempt(ready, '2', 3).attempts).toBe(2);
    expect(() => recover(running, '2', 'owner', ['owner'], 3)).toThrow();
    expect(() => recover(running, '1', 'stranger', ['owner'], 3)).toThrow();
    expect(() =>
      recover(cancel(running, 'owner', ['owner']), '1', 'owner', ['owner'], 3),
    ).toThrow();
    expect(() => recover({ ...running, attempts: 3 }, '1', 'owner', ['owner'], 3)).toThrow();
  });
  test('publication reservation and cancellation cannot both win', () => {
    const running = startAttempt(initial(), '1', 3);
    const publishing = reservePublication(running, '1');
    expect(() => cancel(publishing, 'owner', ['owner'])).toThrow();
    expect(() => reservePublication(cancel(running, 'owner', ['owner']), '1')).toThrow();
    expect(finishAttempt(publishing, '1', { status: 'passed', detail: 'draft' }, 3).status).toBe(
      'review',
    );
  });
});

describe('authority outside the model', () => {
  test('basic cannot add manifests and neither profile can edit gates', () => {
    expect(allowedPath('apps/web/src/app/(site)/page.tsx', 'basic')).toBe(true);
    expect(allowedPath('apps/web/package.json', 'basic')).toBe(false);
    expect(allowedPath('apps/web/package.json', 'full')).toBe(true);
    for (const path of [
      '.github/workflows/factory.yml',
      'factory/config.ts',
      '../escape.ts',
      'apps/web/src/package.json',
      'tests/e2e/catalog.spec.ts',
    ])
      expect(allowedPath(path, 'full')).toBe(false);
  });
  test('full cannot inject scripts or a Git dependency', () => {
    const original = { scripts: { test: 'bun test' }, dependencies: { zod: '4.6.1' } };
    expect(() => validateManifest(original, { ...original, scripts: { test: 'true' } })).toThrow();
    expect(() =>
      validateManifest(original, {
        ...original,
        dependencies: { x: 'git+https://example.test/x' },
      }),
    ).toThrow();
    expect(() =>
      validateManifest(original, {
        ...original,
        dependencies: { zod: '4.6.1', 'date-fns': '4.1.0' },
      }),
    ).not.toThrow();
  });
});
