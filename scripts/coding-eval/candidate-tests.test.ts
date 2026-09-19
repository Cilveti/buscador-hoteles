import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { candidateTestChecks } from './candidate-tests';
import { taskSchema } from './config';
import { evaluationOutcome } from './outcome';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const task = taskSchema.parse({
  id: 'filters',
  title: 'Filters',
  description: 'Fixture',
  browser: true,
  expectedSkills: [],
});
function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'candidate-test-routing-'));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}
test('mixed delivery routes unit, product Playwright and eval Playwright to separate runners', () => {
  const files = {
    'apps/web/query.test.ts': "import { test } from 'bun:test';",
    'tests/browser/catalog.spec.ts': "import { test } from '@playwright/test';",
    'evals/coding/browser/search.spec.ts': "import { test } from '@playwright/test';",
    'evals/coding/browser/workspace.test.ts': "import { test } from 'bun:test';",
  };
  const root = fixture(files);
  expect(candidateTestChecks(root, [...Object.keys(files), 'deleted.test.ts'], task)).toEqual([
    {
      id: 'candidate-tests',
      command: [
        'bun',
        'test',
        './apps/web/query.test.ts',
        './evals/coding/browser/workspace.test.ts',
      ],
    },
    { id: 'candidate-product-browser-tests', command: ['bun', 'run', 'test:browser'] },
    { id: 'candidate-browser-tests', command: ['bun', 'run', 'test:eval-browser'] },
  ]);
});
test('browser-only delivery still runs, unsupported Playwright never silently passes', () => {
  const root = fixture({
    'tests/browser/catalog.spec.ts': '',
    'other/custom.spec.ts': "import { test } from '@playwright/test';",
  });
  expect(candidateTestChecks(root, ['tests/browser/catalog.spec.ts'], task)).toEqual([
    { id: 'candidate-product-browser-tests', command: ['bun', 'run', 'test:browser'] },
  ]);
  expect(() => candidateTestChecks(root, ['other/custom.spec.ts'], task)).toThrow(
    'Unknown Playwright',
  );
});
test('a changed acceptance suite needs a configured public runner; e2e never touches the everyday database', () => {
  const paths = [
    'evals/coding/tasks/filters/acceptance.browser.spec.ts',
    'tests/e2e/admin.spec.ts',
  ];
  const root = fixture(Object.fromEntries(paths.map((path) => [path, ''])));
  expect(() => candidateTestChecks(root, paths, task)).toThrow('No public acceptance runner');
  expect(() => candidateTestChecks(root, ['tests/e2e/admin.spec.ts'], task)).toThrow(
    'isolated runner',
  );
});
const completed = {
  status: 'evaluated',
  repositoryChecksPassed: true,
  candidateTestsPassed: true,
  privateAcceptancePassed: true,
  judgeTaskVerdict: 'pass',
};
test('a genuine failed assertion remains a failed evaluation even when the judge approves', () => {
  expect(
    evaluationOutcome({
      ...completed,
      candidateTestsPassed: false,
      candidateTestVerification: {
        checks: [{ id: 'candidate-tests', status: 'failed', signal: null }],
      },
    }),
  ).toMatchObject({ outcome: 'fail', passed: false });
  expect(evaluationOutcome(completed)).toMatchObject({ outcome: 'pass', passed: true });
  expect(evaluationOutcome({ ...completed, privateAcceptancePassed: false })).toMatchObject({
    outcome: 'fail',
    passed: false,
  });
});
test.each(['not_run', 'timed_out'])(
  'uncompleted check %s is an evaluator error, never an assertion failure or success',
  (status) => {
    expect(
      evaluationOutcome({
        ...completed,
        candidateTestsPassed: false,
        candidateTestVerification: { checks: [{ id: 'candidate-tests', status }] },
      }),
    ).toMatchObject({
      outcome: 'evaluation_error',
      passed: null,
      evaluationIssues: [`candidate-tests: ${status}`],
    });
  },
);
test('crashed checks, missing judgment and incomplete runs never turn green', () => {
  expect(
    evaluationOutcome({
      ...completed,
      verification: { checks: [{ id: 'types', status: 'failed', signal: 'SIGABRT' }] },
    }).outcome,
  ).toBe('evaluation_error');
  expect(
    evaluationOutcome({ ...completed, judgmentError: 'Invalid judge output' }).passed,
  ).toBeNull();
  expect(evaluationOutcome({ ...completed, status: 'incomplete' }).passed).toBeNull();
});

test('quality score preserves historical scales and requires evidence for all dimensions', async () => {
  const { qualityScore, scoreWeights } = await import('./score');
  const all = (score: number) =>
    Object.fromEntries(Object.keys(scoreWeights).map((key) => [key, { score }]));
  expect(qualityScore(all(2), 2)).toBe(10);
  expect(qualityScore(all(8), 10)).toBe(8);
  expect(qualityScore({ ...all(10), functionality: { score: 0 } }, 10)).toBe(6.5);
  expect(qualityScore({ ...all(10), testQuality: { score: null } }, 10)).toBeNull();
  expect(
    evaluationOutcome({ ...completed, judgeTaskVerdict: 'uncertain', passed: false }),
  ).toMatchObject({ outcome: 'incomplete', passed: null });
});
