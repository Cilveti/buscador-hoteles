import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readySpecSchema, specSchema } from './contracts';
import { qaPrompt, taskPrompt } from './prompts';

const examplePath = new URL('../../docs/workflows/examples/escape-search.json', import.meta.url);
const specification = readySpecSchema.parse(JSON.parse(readFileSync(examplePath, 'utf8')));

test('new specifications retain the agreement and each observable scenario after serialization', () => {
  expect(specSchema.parse(JSON.parse(JSON.stringify(specification)))).toEqual(specification);
  expect(specification.acceptance.every((item) => item.scenario?.then)).toBe(true);
  for (const role of [
    'research-product',
    'research-verification',
    'planner',
    'implementer',
    'reviewer',
  ] as const)
    expect(taskPrompt(role, specification)).toContain(JSON.stringify(specification, null, 2));
  expect(
    qaPrompt({
      spec: specification,
      url: '/',
      baseURL: 'http://127.0.0.1:3181',
      screenshot: 'screen-01.png',
      observation: 'Search form',
      history: [],
      remainingActions: 16,
      screenshots: ['screen-01.png'],
    }),
  ).toContain(JSON.stringify(specification));
});

test('v2 rejects incomplete agreements, blank scenarios and unknown scenario fields', () => {
  expect(specSchema.safeParse({ ...specification, context: undefined }).success).toBe(false);
  expect(specSchema.safeParse({ ...specification, verification: undefined }).success).toBe(false);
  expect(specSchema.safeParse({ ...specification, goals: [] }).success).toBe(false);
  const first = specification.acceptance[0];
  if (!first) throw new Error('Example needs an acceptance case');
  for (const scenario of [
    undefined,
    { ...first.scenario, given: '  ' },
    { ...first.scenario, when: '  ' },
    // biome-ignore lint/suspicious/noThenProperty: Exercise a blank Given/When/Then data field.
    { ...first.scenario, then: '' },
    { ...first.scenario, outcome: 'unknown key' },
  ])
    expect(
      specSchema.safeParse({ ...specification, acceptance: [{ ...first, scenario }] }).success,
    ).toBe(false);
});

test('ready rejects pending decisions without breaking historical specs', () => {
  const draft = {
    ...specification,
    decisions: ['Acordar el comportamiento cuando el campo está vacío'],
  };
  expect(specSchema.safeParse(draft).success).toBe(true);
  expect(readySpecSchema.safeParse(draft).success).toBe(false);
  const historical = JSON.parse(
    readFileSync(
      new URL('../../docs/workflows/examples/copy-search.json', import.meta.url),
      'utf8',
    ),
  );
  expect(specSchema.safeParse(historical).success).toBe(true);
  expect(readySpecSchema.safeParse(historical).success).toBe(false);
});

test('validate CLI checks readiness without creating runs or requiring model configuration', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/local-workflow/cli.ts',
      'validate',
      '--spec',
      examplePath.pathname,
      '--agents',
      '/nonexistent/agents.json',
    ],
    { encoding: 'utf8' },
  );
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('3 casos');
  const invalid = spawnSync(
    process.execPath,
    [
      'scripts/local-workflow/cli.ts',
      'validate',
      '--spec',
      'docs/workflows/examples/copy-search.json',
    ],
    { encoding: 'utf8' },
  );
  expect(invalid.status).toBe(1);
});
