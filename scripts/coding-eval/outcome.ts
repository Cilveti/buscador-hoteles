import { z } from 'zod';

const verification = z.object({
  checks: z
    .array(
      z.object({
        id: z.string(),
        status: z.string(),
        signal: z.string().nullable().optional(),
      }),
    )
    .default([]),
});
const inputs = z.object({
  status: z.string().optional(),
  passed: z.boolean().nullable().optional(),
  repositoryChecksPassed: z.boolean().nullable().optional(),
  taskAcceptancePassed: z.boolean().nullable().optional(),
  privateAcceptancePassed: z.boolean().nullable().optional(),
  candidateTestsPassed: z.boolean().nullable().optional(),
  judgeTaskVerdict: z.string().nullable().optional(),
  judgmentError: z.string().nullable().optional(),
  verification: verification.nullable().optional(),
  candidateTestVerification: verification.nullable().optional(),
  privateAcceptanceVerification: verification.nullable().optional(),
});

/** A failed assertion and a check that could not finish are different outcomes. */
export function evaluationOutcome(value: unknown) {
  const run = inputs.parse(value);
  const checks = [
    run.verification,
    run.candidateTestVerification,
    run.privateAcceptanceVerification,
  ].flatMap((entry) => entry?.checks ?? []);
  const issues = checks
    .filter((check) => ['not_run', 'timed_out'].includes(check.status) || check.signal)
    .map((check) => `${check.id}: ${check.signal ?? check.status}`);
  if (run.judgmentError) issues.push(run.judgmentError);
  if (issues.length || run.status === 'incomplete')
    return { outcome: 'evaluation_error', passed: null, evaluationIssues: issues };
  if (run.status !== 'evaluated')
    return { outcome: run.status ?? 'incomplete', passed: null, evaluationIssues: [] };
  if (run.judgeTaskVerdict === 'uncertain')
    return { outcome: 'incomplete', passed: null, evaluationIssues: [] };
  const gates = [
    run.repositoryChecksPassed,
    run.taskAcceptancePassed,
    run.privateAcceptancePassed,
    run.candidateTestsPassed,
  ];
  const failed = gates.includes(false) || run.judgeTaskVerdict === 'fail';
  if (failed) return { outcome: 'fail', passed: false, evaluationIssues: [] };
  if (run.repositoryChecksPassed === true && run.judgeTaskVerdict === 'pass')
    return { outcome: 'pass', passed: true, evaluationIssues: [] };
  // Old summaries without gate details retain their recorded result; never invent a pass.
  return {
    outcome: run.passed === true ? 'pass' : run.passed === false ? 'fail' : 'incomplete',
    passed: run.passed ?? null,
    evaluationIssues: [],
  };
}
