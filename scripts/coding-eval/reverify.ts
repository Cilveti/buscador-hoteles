import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { verifyCandidateTests } from './candidate-tests';
import { configSchema, taskSchema } from './config';
import { evaluationOutcome } from './outcome';
import { finishEvaluationStorage } from './retention';
import { qualityScore } from './score';
import { hashFile, saveJson } from './workspace';

const correctionSchema = z.object({
  kind: z.literal('candidate-tests-runner-v2'),
  originalResultSha256: z.string(),
  deliveredCommit: z.string(),
  createdAt: z.string(),
  candidateTestVerification: z
    .object({
      passed: z.boolean(),
      checks: z.array(z.object({ id: z.string(), status: z.string() }).passthrough()),
    })
    .passthrough()
    .nullable(),
});
const deliveryCorrectionSchema = z.object({
  kind: z.literal('delivery-verification-v3'),
  originalResultSha256: z.string(),
  deliveredCommit: z.string(),
  createdAt: z.string(),
  replacement: z
    .object({
      status: z.enum(['evaluated', 'incomplete']),
      scoreScale: z.literal(10),
      verification: z.object({ passed: z.boolean(), checks: z.array(z.unknown()) }).passthrough(),
      candidateTestVerification: correctionSchema.shape.candidateTestVerification,
      judgment: z.record(z.string(), z.unknown()).nullable(),
      judgmentError: z.string().nullable(),
      repositoryChecksPassed: z.boolean(),
      candidateTestsPassed: z.boolean().nullable(),
      judgeTaskVerdict: z.string().nullable(),
    })
    .passthrough(),
});

/** Read a completed correction only when it matches the immutable original delivery. */
export function effectiveRun(
  run: string,
  original: Record<string, unknown>,
): Record<string, unknown> {
  original = {
    ...original,
    score: qualityScore(original.judgment, original.scoreScale === 10 ? 10 : 2),
    scoreScale: original.scoreScale ?? 2,
  };
  const folder = join(run, 'reverifications');
  let current = original;
  if (existsSync(folder)) {
    const originalHash = hashFile(join(run, 'result.json'));
    for (const name of readdirSync(folder).sort()) {
      const file = join(folder, name, 'result.json');
      if (!existsSync(file)) continue;
      const parsed = z
        .union([correctionSchema, deliveryCorrectionSchema])
        .safeParse(JSON.parse(readFileSync(file, 'utf8')));
      if (!parsed.success) continue;
      const revision = parsed.data;
      if (
        revision.originalResultSha256 !== originalHash ||
        revision.deliveredCommit !== original.deliveredCommit
      )
        continue;
      const result: Record<string, unknown> = {
        ...current,
        ...(revision.kind === 'delivery-verification-v3'
          ? revision.replacement
          : {
              candidateTestVerification: revision.candidateTestVerification,
              candidateTestsPassed: revision.candidateTestVerification?.passed ?? null,
            }),
      };
      current = {
        ...result,
        score: qualityScore(result.judgment, result.scoreScale === 10 ? 10 : 2),
        ...evaluationOutcome(result),
        verificationRevision: {
          path: file,
          createdAt: revision.createdAt,
          originalPassed: original.passed,
          kind: revision.kind,
        },
      };
    }
  }
  return { ...current, ...evaluationOutcome(current) };
}

async function availablePort() {
  const server = createServer();
  return new Promise<number>((resolvePort, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else if (address && typeof address !== 'string') resolvePort(address.port);
        else reject(new Error('No port assigned'));
      });
    });
  });
}

/** Re-execute candidate tests on the frozen delivery. No candidate or judge model is called. */
export async function reverifyCandidateTests(project: string, directory: string) {
  const run = resolve(project, directory);
  const original = z
    .object({
      status: z.literal('evaluated'),
      config: configSchema,
      baselineCommit: z.string(),
      deliveredCommit: z.string(),
    })
    .parse(JSON.parse(readFileSync(join(run, 'result.json'), 'utf8')));
  const changed = z
    .object({ changedPaths: z.array(z.string()) })
    .parse(JSON.parse(readFileSync(join(run, 'delivery.json'), 'utf8')));
  const retainedTask = join(run, 'judge-input/task-reference/task.json');
  const campaignInputs = join(dirname(dirname(run)), 'inputs.json');
  const taskPayload: unknown = JSON.parse(
    readFileSync(existsSync(retainedTask) ? retainedTask : campaignInputs, 'utf8'),
  );
  const task = existsSync(retainedTask)
    ? taskSchema.parse(taskPayload)
    : z.object({ task: taskSchema }).parse(taskPayload).task;
  const output = join(
    run,
    'reverifications',
    `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`,
  );
  mkdirSync(output, { recursive: true });
  const provenance = {
    kind: 'candidate-tests-runner-v2',
    originalResultSha256: hashFile(join(run, 'result.json')),
    deliveredCommit: original.deliveredCommit,
    createdAt: new Date().toISOString(),
    originalRun: run,
    reused: ['reference verification', 'private acceptance', 'judge judgment'],
    runnerSha256: hashFile(join(project, 'scripts/coding-eval/candidate-tests.ts')),
  };
  saveJson(join(output, 'provenance.json'), provenance);
  saveJson(join(output, 'result.json'), { ...provenance, status: 'running' });
  try {
    const verification = await verifyCandidateTests({
      project,
      output,
      baseline: original.baselineCommit,
      delivered: original.deliveredCommit,
      candidateRoot: join(run, 'candidate'),
      changed: changed.changedPaths,
      task,
      timeoutSeconds: original.config.checkTimeoutSeconds,
      port: await availablePort(),
    });
    saveJson(join(output, 'result.json'), {
      ...provenance,
      candidateTestVerification: verification,
    });
  } catch (error) {
    saveJson(join(output, 'error.json'), { ...provenance, error: String(error) });
    saveJson(join(output, 'result.json'), {
      ...provenance,
      status: 'incomplete',
      error: String(error),
    });
    throw error;
  } finally {
    finishEvaluationStorage(project, output);
  }
  return output;
}
