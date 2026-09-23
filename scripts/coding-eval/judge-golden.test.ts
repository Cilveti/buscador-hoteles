import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateJudgeGolden } from './judge-golden';

test('scores verdict, attribution, required findings and dimensions without using judge wording as oracle', () => {
  const root = mkdtempSync(join(tmpdir(), 'judge-golden-'));
  try {
    const run = join(root, '.agent-evals/campaign/runs/001');
    mkdirSync(run, { recursive: true });
    writeFileSync(
      join(run, 'result.json'),
      JSON.stringify({
        status: 'evaluated',
        deliveredCommit: 'a'.repeat(40),
        judgment: {
          verdict: 'fail',
          findings: [
            {
              severity: 'major',
              file: 'query.ts',
              detail: 'Recover merges optional filters through changeQuery.',
              deterministicCheck: 'acceptance failed',
            },
          ],
          functionality: { score: 6 },
          codeQuality: { score: 8 },
          testQuality: { score: 7 },
          projectGuidelines: { score: 8 },
          verificationProcess: { score: 8 },
          reportAccuracy: { score: 8 },
        },
      }),
    );
    const golden = join(root, 'golden.json');
    writeFileSync(
      golden,
      JSON.stringify({
        schemaVersion: 1,
        policy: {
          promotion: {
            blockingAndMajorRecall: 1,
            allowNewFalsePasses: false,
            allowNewBlockingOrMajorFalsePositives: false,
            minimumAttributionAccuracy: 0.95,
            maximumDimensionDelta: 1,
          },
        },
        cases: [
          {
            id: 'bug',
            split: 'holdout',
            lineage: 'one',
            run: '.agent-evals/campaign/runs/001',
            deliveredCommit: 'a'.repeat(40),
            expected: {
              attribution: 'candidate',
              verdict: 'fail',
              requiredFindings: [
                {
                  id: 'recovery',
                  severity: 'major',
                  matchTerms: ['recover', 'changequery'],
                  evidence: 'deterministic acceptance',
                },
              ],
              forbiddenFindings: ['unrelated regression'],
              dimensionRanges: { functionality: [5, 7] },
            },
          },
        ],
      }),
    );
    const result = evaluateJudgeGolden(root, golden);
    expect(result.passed).toBe(true);
    expect(result.summary.requiredFindingRecall).toBe(1);
    expect(result.summary.blockingAndMajorRecall).toBe(1);
    expect(result.summary.attributionAccuracy).toBe(1);
    expect(result.summary.verdictAccuracy).toBe(1);
    expect(result.summary.falsePasses).toBe(0);
    expect(result.summary.manualReviewItems).toBe(1);
    expect(result.promotion).toEqual({
      policy: {
        blockingAndMajorRecall: 1,
        allowNewFalsePasses: false,
        allowNewBlockingOrMajorFalsePositives: false,
        minimumAttributionAccuracy: 0.95,
        maximumDimensionDelta: 1,
      },
      automatedGatesPassed: true,
      manualReviewRequired: true,
      eligible: false,
    });
    expect(result.cases[0]?.observed).toEqual({
      attribution: 'candidate',
      verdict: 'fail',
      findingCount: 1,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('keeps missing findings and wrong verdicts as hard failures', () => {
  const root = mkdtempSync(join(tmpdir(), 'judge-golden-'));
  try {
    const run = join(root, '.agent-evals/campaign/runs/001');
    mkdirSync(run, { recursive: true });
    writeFileSync(
      join(run, 'result.json'),
      JSON.stringify({
        status: 'evaluated',
        deliveredCommit: 'b'.repeat(40),
        judgment: {
          verdict: 'pass',
          findings: [],
          functionality: { score: 9 },
          codeQuality: { score: 9 },
          testQuality: { score: 9 },
          projectGuidelines: { score: 9 },
          verificationProcess: { score: 9 },
          reportAccuracy: { score: 9 },
        },
      }),
    );
    const golden = join(root, 'golden.json');
    writeFileSync(
      golden,
      JSON.stringify({
        schemaVersion: 1,
        cases: [
          {
            id: 'miss',
            split: 'calibration',
            lineage: 'two',
            run: '.agent-evals/campaign/runs/001',
            expected: {
              attribution: 'candidate',
              verdict: 'fail',
              requiredFindings: [
                {
                  id: 'missing',
                  severity: 'major',
                  matchTerms: ['required'],
                  evidence: 'known reproduction',
                },
              ],
            },
          },
        ],
      }),
    );
    const result = evaluateJudgeGolden(root, golden);
    expect(result.passed).toBe(false);
    expect(result.cases[0]?.failures).toContain('Verdict pass; expected fail');
    expect(result.cases[0]?.failures).toContain('Required finding not matched: missing');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
