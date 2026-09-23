import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const attribution = z.enum(['candidate', 'baseline', 'infrastructure']);
const verdict = z.enum(['pass', 'fail', 'uncertain']);
const severity = z.enum(['blocking', 'major', 'minor', 'infrastructure']);
const range = z.tuple([z.number().int().min(0).max(10), z.number().int().min(0).max(10)]);

const goldenSchema = z.object({
  schemaVersion: z.literal(1),
  policy: z
    .object({
      promotion: z.object({
        blockingAndMajorRecall: z.number().min(0).max(1),
        allowNewFalsePasses: z.boolean(),
        allowNewBlockingOrMajorFalsePositives: z.boolean(),
        minimumAttributionAccuracy: z.number().min(0).max(1),
        maximumDimensionDelta: z.number().min(0),
      }),
    })
    .optional(),
  cases: z.array(
    z.object({
      id: z.string().min(1),
      split: z.enum(['calibration', 'holdout']),
      lineage: z.string().min(1),
      run: z.string().min(1),
      deliveredCommit: z
        .string()
        .regex(/^[a-f0-9]{40}$/)
        .optional(),
      expected: z.object({
        attribution,
        verdict: verdict.nullable(),
        requiredFindings: z
          .array(
            z.object({
              id: z.string().min(1),
              severity,
              matchTerms: z.array(z.string().min(1)).default([]),
              evidence: z.string().min(1),
            }),
          )
          .default([]),
        forbiddenFindings: z.array(z.string().min(1)).default([]),
        allowedMinorFindings: z.array(z.string().min(1)).default([]),
        dimensionRanges: z.record(z.string(), range).default({}),
      }),
    }),
  ),
});

const resultSchema = z
  .object({
    status: z.string(),
    deliveredCommit: z.string().nullable().optional(),
    error: z.string().optional(),
    judgment: z
      .object({
        verdict,
        findings: z.array(
          z.object({
            severity: z.enum(['blocking', 'major', 'minor']),
            file: z.string(),
            detail: z.string(),
            deterministicCheck: z.string().nullable(),
          }),
        ),
        functionality: z.object({ score: z.number().nullable() }).passthrough(),
        codeQuality: z.object({ score: z.number().nullable() }).passthrough(),
        testQuality: z.object({ score: z.number().nullable() }).passthrough(),
        projectGuidelines: z.object({ score: z.number().nullable() }).passthrough(),
        verificationProcess: z.object({ score: z.number().nullable() }).passthrough(),
        reportAccuracy: z.object({ score: z.number().nullable() }).passthrough(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

type Golden = z.infer<typeof goldenSchema>;
type Result = z.infer<typeof resultSchema>;
type GoldenCase = Golden['cases'][number];

function actualAttribution(result: Result): z.infer<typeof attribution> | 'unknown' {
  if (result.deliveredCommit) return 'candidate';
  if (result.status === 'incomplete' && result.error) return 'infrastructure';
  return 'unknown';
}

function findingText(finding: NonNullable<Result['judgment']>['findings'][number]): string {
  return `${finding.file}\n${finding.detail}\n${finding.deterministicCheck ?? ''}`.toLocaleLowerCase();
}

function dimensionFailures(result: Result, entry: GoldenCase): string[] {
  const failures: string[] = [];
  for (const [dimension, [minimum, maximum]] of Object.entries(entry.expected.dimensionRanges)) {
    const criterion = result.judgment?.[dimension as keyof NonNullable<Result['judgment']>];
    const score =
      typeof criterion === 'object' && criterion !== null && 'score' in criterion
        ? criterion.score
        : null;
    if (typeof score !== 'number' || score < minimum || score > maximum)
      failures.push(`Dimension ${dimension}=${score}; expected ${minimum}..${maximum}`);
  }
  return failures;
}

function evaluateGoldenCase(project: string, entry: GoldenCase) {
  const resultFile = resolve(project, entry.run, 'result.json');
  const failures: string[] = [];
  const manualReview: string[] = [];
  if (!existsSync(resultFile)) {
    return {
      id: entry.id,
      split: entry.split,
      lineage: entry.lineage,
      passed: false,
      failures: [`Missing result: ${resultFile}`],
      manualReview,
      expectedFindings: 0,
      matchedFindings: 0,
      expectedBlockingAndMajorFindings: 0,
      matchedBlockingAndMajorFindings: 0,
      attributionMatched: false,
      verdictMatched: false,
      falsePass: false,
    };
  }

  const result = resultSchema.parse(JSON.parse(readFileSync(resultFile, 'utf8')));
  const observedAttribution = actualAttribution(result);
  if (observedAttribution !== entry.expected.attribution)
    failures.push(`Attribution ${observedAttribution}; expected ${entry.expected.attribution}`);
  if (entry.deliveredCommit && result.deliveredCommit !== entry.deliveredCommit)
    failures.push(`Delivered commit ${result.deliveredCommit}; expected ${entry.deliveredCommit}`);
  const observedVerdict = result.judgment?.verdict ?? null;
  if (observedVerdict !== entry.expected.verdict)
    failures.push(`Verdict ${observedVerdict}; expected ${entry.expected.verdict}`);

  let expectedFindings = 0;
  let matchedFindings = 0;
  let expectedBlockingAndMajorFindings = 0;
  let matchedBlockingAndMajorFindings = 0;
  for (const requirement of entry.expected.requiredFindings) {
    if (entry.expected.attribution === 'infrastructure') {
      manualReview.push(`${requirement.id}: ${requirement.evidence}`);
      continue;
    }
    expectedFindings += 1;
    const blockingOrMajor = ['blocking', 'major'].includes(requirement.severity);
    if (blockingOrMajor) expectedBlockingAndMajorFindings += 1;
    const matched = (result.judgment?.findings ?? []).some(
      (finding) =>
        finding.severity === requirement.severity &&
        requirement.matchTerms.every((term) =>
          findingText(finding).includes(term.toLocaleLowerCase()),
        ),
    );
    if (matched) {
      matchedFindings += 1;
      if (blockingOrMajor) matchedBlockingAndMajorFindings += 1;
    } else failures.push(`Required finding not matched: ${requirement.id}`);
  }

  failures.push(...dimensionFailures(result, entry));
  manualReview.push(...entry.expected.forbiddenFindings.map((item) => `Forbidden: ${item}`));
  return {
    id: entry.id,
    split: entry.split,
    lineage: entry.lineage,
    passed: failures.length === 0,
    failures,
    manualReview,
    expectedFindings,
    matchedFindings,
    expectedBlockingAndMajorFindings,
    matchedBlockingAndMajorFindings,
    attributionMatched: observedAttribution === entry.expected.attribution,
    verdictMatched: observedVerdict === entry.expected.verdict,
    falsePass: entry.expected.verdict === 'fail' && observedVerdict === 'pass',
    observed: {
      attribution: observedAttribution,
      verdict: observedVerdict,
      findingCount: result.judgment?.findings.length ?? 0,
    },
  };
}

export function evaluateJudgeGolden(project: string, goldenFile: string) {
  const golden: Golden = goldenSchema.parse(JSON.parse(readFileSync(goldenFile, 'utf8')));
  const cases = golden.cases.map((entry) => evaluateGoldenCase(project, entry));
  const expectedFindings = cases.reduce((sum, entry) => sum + entry.expectedFindings, 0);
  const matchedFindings = cases.reduce((sum, entry) => sum + entry.matchedFindings, 0);
  const expectedBlockingAndMajorFindings = cases.reduce(
    (sum, entry) => sum + entry.expectedBlockingAndMajorFindings,
    0,
  );
  const matchedBlockingAndMajorFindings = cases.reduce(
    (sum, entry) => sum + entry.matchedBlockingAndMajorFindings,
    0,
  );
  const attributionAccuracy = cases.length
    ? cases.filter((entry) => entry.attributionMatched).length / cases.length
    : null;
  const verdictAccuracy = cases.length
    ? cases.filter((entry) => entry.verdictMatched).length / cases.length
    : null;
  const falsePasses = cases.filter((entry) => entry.falsePass).length;
  const blockingAndMajorRecall = expectedBlockingAndMajorFindings
    ? matchedBlockingAndMajorFindings / expectedBlockingAndMajorFindings
    : null;
  const manualReviewItems = cases.reduce((sum, entry) => sum + entry.manualReview.length, 0);
  const promotionPolicy = golden.policy?.promotion;
  const automatedPromotionGatesPassed = promotionPolicy
    ? blockingAndMajorRecall !== null &&
      blockingAndMajorRecall >= promotionPolicy.blockingAndMajorRecall &&
      attributionAccuracy !== null &&
      attributionAccuracy >= promotionPolicy.minimumAttributionAccuracy &&
      (promotionPolicy.allowNewFalsePasses || falsePasses === 0) &&
      cases.every((entry) => entry.passed)
    : null;
  const splits = Object.fromEntries(
    (['calibration', 'holdout'] as const).map((split) => {
      const selected = cases.filter((entry) => entry.split === split);
      return [
        split,
        { cases: selected.length, passed: selected.filter((entry) => entry.passed).length },
      ];
    }),
  );
  return {
    schemaVersion: 1,
    goldenFile,
    evaluatedAt: new Date().toISOString(),
    passed: cases.every((entry) => entry.passed),
    summary: {
      cases: cases.length,
      passed: cases.filter((entry) => entry.passed).length,
      requiredFindingRecall: expectedFindings ? matchedFindings / expectedFindings : null,
      expectedFindings,
      matchedFindings,
      blockingAndMajorRecall,
      expectedBlockingAndMajorFindings,
      matchedBlockingAndMajorFindings,
      attributionAccuracy,
      verdictAccuracy,
      falsePasses,
      manualReviewItems,
      splits,
    },
    promotion: {
      policy: promotionPolicy ?? null,
      automatedGatesPassed: automatedPromotionGatesPassed,
      manualReviewRequired: manualReviewItems > 0,
      eligible: automatedPromotionGatesPassed === true && manualReviewItems === 0,
    },
    cases,
    limitations: [
      'Finding matching uses curator-provided semantic substrings and severity; it is not an LLM grader.',
      'Forbidden findings remain manual review items until a deterministic false-positive matcher is curated.',
      'Infrastructure attribution is inferred only when the run stopped without a delivery and retained a controller error.',
    ],
  };
}

if (import.meta.main) {
  const project = process.cwd();
  const goldenFile = resolve(
    project,
    process.argv[2] ?? '.agent-evals/judge-golden-20260922/golden.json',
  );
  const evaluation = evaluateJudgeGolden(project, goldenFile);
  console.log(JSON.stringify(evaluation, null, 2));
  if (!evaluation.passed) process.exitCode = 1;
}
