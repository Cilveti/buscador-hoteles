import { z } from 'zod';

export const regressionTestSchema = z
  .object({
    findingIndex: z.number().int().nonnegative(),
    title: z.string().min(1).max(300),
    requirement: z.string().min(1).max(4000),
    evidence: z.array(z.string().min(1)).min(1).max(20),
    filename: z.string().regex(/^[a-z0-9][a-z0-9-]*\.(?:test|spec)\.ts$/),
    source: z.string().min(1).max(64000),
  })
  .strict();
const regressionTests = z.array(regressionTestSchema).max(5);

const criterion = z
  .object({
    score: z.number().int().min(0).max(10).nullable(),
    explanation: z.string(),
    evidence: z.array(z.string()),
  })
  .strict();
export const judgmentSchema = z
  .object({
    functionality: criterion,
    codeQuality: criterion,
    testQuality: criterion,
    projectGuidelines: criterion,
    verificationProcess: criterion,
    reportAccuracy: criterion,
    findings: z.array(
      z
        .object({
          severity: z.enum(['blocking', 'major', 'minor']),
          file: z.string(),
          detail: z.string(),
          deterministicCheck: z.string().nullable(),
        })
        .strict(),
    ),
    verdict: z.enum(['pass', 'fail', 'uncertain']),
    limitations: z.array(z.string()),
    regressionTests: regressionTests.default([]),
  })
  .strict();
// Historical inputs may omit proposals; new structured outputs must supply the array.
export const judgmentOutputSchema = z.toJSONSchema(judgmentSchema.extend({ regressionTests }));
