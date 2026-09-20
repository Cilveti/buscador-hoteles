import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { callAgent, resolveAgents, roleSchema, validateAgents } from './agents';
import { codexCommand } from './codex';
import type { HarnessInvocation, HarnessRegistry } from './harness';

test('all roles inherit a harness; an override replaces only its own role', () => {
  const agents = resolveAgents({
    default: { harness: 'local-demo', model: 'base' },
    roles: { reviewer: { harness: 'other-demo', model: 'review' } },
  });
  expect(agents.implementer).toEqual({ harness: 'local-demo', model: 'base' });
  expect(agents.reviewer).toEqual({ harness: 'other-demo', model: 'review' });
  expect(agents.qa).toEqual(agents.implementer);
  expect(() =>
    resolveAgents({ default: { harness: 'codex' }, roles: { typo: { harness: 'codex' } } }),
  ).toThrow();
  expect(() => validateAgents(agents)).toThrow('not installed');
  expect(() => validateAgents(undefined)).toThrow('Historical run');
});

test('every role uses the adapter contract with validated output, access and evidence inputs', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'workflow-adapters-'));
  const invocations: { harness: string; request: HarnessInvocation }[] = [];
  const registry: HarnessRegistry = Object.fromEntries(
    ['first', 'second'].map((harness) => [
      harness,
      {
        images: true,
        async run(request: HarnessInvocation) {
          invocations.push({ harness, request });
          return { verdict: 'ok' };
        },
      },
    ]),
  );
  const agents = resolveAgents({
    default: { harness: 'first' },
    roles: { reviewer: { harness: 'second' } },
  });
  const resultSchema = z.object({ verdict: z.literal('ok') }).strict();
  try {
    for (const role of roleSchema.options) {
      const result = await callAgent(
        agents,
        {
          role,
          root: directory,
          output: join(directory, role),
          prompt: 'A literal $(command).',
          edit: role === 'implementer',
          images: role === 'qa' ? ['screenshot.png'] : [],
        },
        resultSchema,
        registry,
      );
      expect(result.verdict).toBe('ok');
    }
    expect(invocations.map((item) => item.harness)).toEqual([
      'first',
      'first',
      'first',
      'first',
      'second',
      'first',
    ]);
    expect(invocations.map((item) => item.request.access)).toEqual([
      'read',
      'read',
      'read',
      'write',
      'read',
      'read',
    ]);
    expect(invocations.at(-1)?.request.images).toEqual(['screenshot.png']);
    expect(JSON.parse(readFileSync(join(directory, 'reviewer/agent.json'), 'utf8')).harness).toBe(
      'second',
    );
    await expect(
      callAgent(
        agents,
        {
          role: 'reviewer',
          root: directory,
          output: join(directory, 'forbidden'),
          prompt: '',
          edit: true,
        },
        resultSchema,
        registry,
      ),
    ).rejects.toThrow('Only the implementer');
    const badRegistry: HarnessRegistry = {
      first: { images: true, run: async () => ({ wrong: true }) },
    };
    await expect(
      callAgent(
        resolveAgents({ default: { harness: 'first' } }),
        {
          role: 'planner',
          root: directory,
          output: join(directory, 'invalid'),
          prompt: '',
        },
        resultSchema,
        badRegistry,
      ),
    ).rejects.toThrow();
    expect(() =>
      validateAgents(resolveAgents({ default: { harness: 'text-only' } }), {
        'text-only': { images: false, run: async () => ({}) },
      }),
    ).toThrow('screenshots');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Codex maps editing to workspace-write and preserves readonly for other phases', () => {
  const request: HarnessInvocation = {
    root: '/tmp/candidate',
    prompt: 'Task',
    schemaPath: '/tmp/schema.json',
    resultPath: '/tmp/result.json',
    logPath: '/tmp/agent.log',
    access: 'read',
    images: ['/tmp/image with spaces.png'],
    model: 'chosen-model',
    timeoutMs: 1000,
  };
  const reader = codexCommand(request);
  const writer = codexCommand({ ...request, access: 'write' });
  expect(reader[reader.indexOf('--sandbox') + 1]).toBe('read-only');
  expect(writer[writer.indexOf('--sandbox') + 1]).toBe('workspace-write');
  expect(writer).not.toContain('--dangerously-bypass-approvals-and-sandbox');
  expect(writer[writer.indexOf('--model') + 1]).toBe('chosen-model');
  expect(writer[writer.indexOf('--image') + 1]).toBe('/tmp/image with spaces.png');
  expect(writer.at(-1)).toBe('-');
});
