import { afterEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { judgmentSchema, regressionTestSchema } from './judge';
import { collectRegressionTests } from './regressions';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'private-regressions-'));
  roots.push(root);
  const output = join(root, 'run');
  const packet = join(output, 'packet');
  const privateRoot = join(root, 'private');
  mkdirSync(packet, { recursive: true });
  writeFileSync(join(packet, 'TASK.md'), 'Save locally, reporting failed writes.');
  writeFileSync(join(output, 'delivery.json'), JSON.stringify({ deliveredCommit: 'abc123' }));
  const criterion = { score: 5, explanation: 'Evidence', evidence: ['file.ts'] };
  const judgment = judgmentSchema.parse({
    functionality: criterion,
    codeQuality: criterion,
    testQuality: criterion,
    projectGuidelines: criterion,
    verificationProcess: criterion,
    reportAccuracy: criterion,
    findings: [
      {
        severity: 'major',
        file: 'file.ts',
        detail: 'Failed write announced as success',
        deterministicCheck: null,
      },
    ],
    verdict: 'fail',
    limitations: [],
    regressionTests: [
      {
        findingIndex: 0,
        title: 'Write failure',
        requirement: 'Report failed writes',
        evidence: ['file.ts'],
        filename: 'write-failure.spec.ts',
        source: 'throw new Error("must never execute during collection");',
      },
    ],
  });
  return { output, packet, privateRoot, judgment, taskId: 'saved-searches' };
}

test('stores code privately without executing it, with provenance and separate specification versions', () => {
  const input = fixture();
  const [stored] = collectRegressionTests(input, input.privateRoot);
  if (!stored) throw new Error('Missing proposal');
  expect(readFileSync(join(stored.folder, stored.filename), 'utf8')).toContain(
    'must never execute',
  );
  expect(JSON.parse(readFileSync(join(stored.folder, 'proposal.json'), 'utf8')).status).toBe(
    'pending-validation',
  );
  const observation = readdirSync(join(stored.folder, 'observations'))[0];
  if (!observation) throw new Error('Missing provenance');
  expect(
    JSON.parse(readFileSync(join(stored.folder, 'observations', observation), 'utf8'))
      .deliveredCommit,
  ).toBe('abc123');
  expect(existsSync(join(input.packet, stored.filename))).toBe(false);
  writeFileSync(join(stored.folder, 'proposal.json'), '{"status":"validated"}');
  expect(collectRegressionTests(input, input.privateRoot)[0]?.id).toBe(stored.id);
  expect(JSON.parse(readFileSync(join(stored.folder, 'proposal.json'), 'utf8')).status).toBe(
    'validated',
  );
  writeFileSync(join(input.packet, 'TASK.md'), 'Different requirement');
  expect(collectRegressionTests(input, input.privateRoot)[0]?.id).not.toBe(stored.id);
});

test('rejects path traversal and orphan findings; historical judgments remain readable', () => {
  const input = fixture();
  const proposal = input.judgment.regressionTests[0];
  expect(
    regressionTestSchema.safeParse({ ...proposal, filename: '../escape.spec.ts' }).success,
  ).toBe(false);
  if (!proposal) throw new Error('Missing fixture');
  proposal.findingIndex = 50;
  expect(() => collectRegressionTests(input, input.privateRoot)).toThrow('missing finding');
  expect(existsSync(join(input.privateRoot, 'saved-searches'))).toBe(false);
  const { regressionTests: _proposals, ...legacy } = input.judgment;
  expect(judgmentSchema.parse(legacy).regressionTests).toEqual([]);
});
