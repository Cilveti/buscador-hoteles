import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { validateResult } from './model-result';

describe('validated model result', () => {
  test('accepts an implementation or a dependency permission request without granting authority', () => {
    expect(
      validateResult({ status: 'implemented', summary: 'Updated the source' }, 'implementer')
        .status,
    ).toBe('implemented');
    expect(
      validateResult({ status: 'needs-human', summary: 'Requires slugify 1.6.6' }, 'implementer')
        .status,
    ).toBe('needs-human');
  });
  test('rejects prose, missing fields, invented statuses and permission fields', () => {
    for (const value of [
      'The task is complete.',
      {},
      { status: 'approved', summary: 'Done' },
      { status: 'implemented', summary: 'Done', profile: 'full' },
    ]) {
      expect(() => validateResult(value, 'implementer')).toThrow();
    }
  });
  test('does not treat a review verdict as an implementation result', () => {
    expect(() =>
      validateResult({ status: 'pass', summary: 'Fine', findings: [] }, 'implementer'),
    ).toThrow();
  });
  test('rejects contradictory, unbounded or incomplete review findings', () => {
    for (const value of [
      { status: 'pass', summary: 'Fine', findings: [{ path: 'a.ts', reason: 'Bug' }] },
      { status: 'changes-requested', summary: 'Fix it', findings: [{ path: 'a.ts' }] },
      { status: 'pass', summary: 'x'.repeat(4001), findings: [] },
    ])
      expect(() => validateResult(value, 'reviewer')).toThrow();
    expect(
      validateResult(
        { status: 'pass', summary: 'No actionable defects found', findings: [] },
        'reviewer',
      ).status,
    ).toBe('pass');
  });
});

test('the driver rejects a disabled result tool before starting a server or model', () => {
  const result = spawnSync(process.execPath, ['factory/model.ts'], {
    encoding: 'utf8',
    env: {
      RUNNER_TEMP: '/does-not-exist-factory-preflight',
      OPENCODE_MODEL: 'opencode-go/glm-5.3-flash',
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        agent: { build: { permission: { '*': 'deny' } } },
      }),
    },
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('StructuredOutput must be enabled');
});
