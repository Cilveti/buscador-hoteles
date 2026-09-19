import { randomUUID } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { z } from 'zod';
import { runVerification } from '../verification/verify';
import { withEvaluationBrowser } from './browser';
import { verifyCandidateTests } from './candidate-tests';
import { configSchema, JUDGE, taskSchema } from './config';
import { loadPricing } from './cost';
import { finishEvaluationStorage, requireRetainedEvidence } from './retention';
import { checksFor, judgeDelivery, packetVerification } from './runner';
import { runAgent } from './runtime';
import {
  createWorktree,
  git,
  hashFile,
  linkDependencies,
  restoreReferences,
  saveJson,
} from './workspace';

async function freePort() {
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('') });
  const port = server.port;
  server.stop(true);
  if (!port) throw new Error('No verification port assigned');
  return port;
}

/** Recheck the immutable delivery and give the judge corrected evidence. No candidate is rerun. */
export async function reverifyDelivery(project: string, directory: string) {
  const run = resolve(project, directory);
  requireRetainedEvidence(run);
  const original = z
    .object({
      status: z.literal('evaluated'),
      config: configSchema,
      baselineCommit: z.string(),
      deliveredCommit: z.string(),
    })
    .parse(JSON.parse(readFileSync(join(run, 'result.json'), 'utf8')));
  const delivery = z
    .object({ changedPaths: z.array(z.string()) })
    .parse(JSON.parse(readFileSync(join(run, 'delivery.json'), 'utf8')));
  const task = taskSchema.parse(
    JSON.parse(readFileSync(join(run, 'judge-input/task-reference/task.json'), 'utf8')),
  );
  const output = join(
    run,
    'reverifications',
    `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`,
  );
  mkdirSync(output, { recursive: true });
  const provenance = {
    kind: 'delivery-verification-v3',
    originalResultSha256: hashFile(join(run, 'result.json')),
    deliveredCommit: original.deliveredCommit,
    originalRun: run,
    createdAt: new Date().toISOString(),
    reason:
      'Recheck the frozen delivery with the current reference restoration, including complete test support files.',
    runnerSha256: hashFile(join(project, 'scripts/coding-eval/workspace.ts')),
  };
  saveJson(join(output, 'provenance.json'), provenance);
  saveJson(join(output, 'result.json'), { ...provenance, status: 'running' });
  try {
    const root = join(output, 'verification-worktree');
    createWorktree(project, root, original.deliveredCommit);
    const referenceChanges = restoreReferences(
      project,
      root,
      original.baselineCommit,
      original.deliveredCommit,
    ).filter((change) => delivery.changedPaths.includes(change.path));
    linkDependencies(project, root);
    const verification = await runVerification({
      root,
      output: join(output, 'verification'),
      timeoutSeconds: original.config.checkTimeoutSeconds,
      checks: checksFor(task),
      env: {
        EVAL_BROWSER_PORT: String(await freePort()),
        EVAL_BROWSER_OUTPUT: join(output, 'browser'),
        EVAL_PROJECT_ROOT: root,
      },
    });
    const candidateTestVerification = await verifyCandidateTests({
      project,
      output,
      baseline: original.baselineCommit,
      delivered: original.deliveredCommit,
      candidateRoot: join(run, 'candidate'),
      changed: delivery.changedPaths,
      task,
      timeoutSeconds: original.config.checkTimeoutSeconds,
      port: await freePort(),
    });
    const packet = join(output, 'judge-input');
    cpSync(join(run, 'judge-input'), packet, {
      recursive: true,
      filter: (source) => basename(source) !== '.git',
    });
    let privateAcceptanceVerification = null;
    const privateRoot = join(packet, 'private-acceptance');
    if (existsSync(join(privateRoot, 'acceptance.json'))) {
      const bundle = z
        .object({ command: z.tuple([z.string()]).rest(z.string()) })
        .parse(JSON.parse(readFileSync(join(privateRoot, 'acceptance.json'), 'utf8')));
      symlinkSync(join(project, 'node_modules'), join(privateRoot, 'node_modules'), 'dir');
      try {
        privateAcceptanceVerification = await runVerification({
          root: privateRoot,
          output: join(output, 'private-acceptance'),
          timeoutSeconds: original.config.checkTimeoutSeconds,
          checks: [{ id: 'private-acceptance', command: bundle.command }],
          env: {
            EVAL_BROWSER_PORT: String(await freePort()),
            EVAL_BROWSER_OUTPUT: join(output, 'private-acceptance/artifacts'),
            EVAL_PROJECT_ROOT: root,
          },
        });
      } finally {
        rmSync(join(privateRoot, 'node_modules'));
      }
      rmSync(join(packet, 'private-acceptance-artifacts'), { recursive: true, force: true });
      if (existsSync(join(output, 'private-acceptance/artifacts')))
        cpSync(
          join(output, 'private-acceptance/artifacts'),
          join(packet, 'private-acceptance-artifacts'),
          { recursive: true },
        );
      saveJson(
        join(packet, 'private-acceptance.json'),
        packetVerification(packet, 'private', privateAcceptanceVerification),
      );
    }
    saveJson(
      join(packet, 'verification-after.json'),
      packetVerification(packet, 'after', verification),
    );
    saveJson(
      join(packet, 'candidate-tests.json'),
      candidateTestVerification
        ? packetVerification(packet, 'candidate-tests', candidateTestVerification)
        : null,
    );
    saveJson(join(packet, 'reference-changes.json'), referenceChanges);
    saveJson(join(packet, 'evaluation-correction.json'), {
      ...provenance,
      instruction:
        'Judge this corrected evidence. Reference tests and their support files are restored together. Package exports/imports and other product metadata remain as delivered; only package scripts are restored. Do not penalize the candidate for historical evaluator restoration errors. Existing candidate tests and their helpers also run separately from restored reference tests.',
    });
    const judgePrompt = readFileSync(join(project, 'evals/coding/prompts/judge.md'), 'utf8');
    writeFileSync(join(output, 'judge-prompt.md'), judgePrompt);
    git(packet, ['init', '-q']);
    const acceptance = verification.checks.find((check) => check.id === 'acceptance');
    const judged = await judgeDelivery(
      {
        output,
        config: original.config,
        judgePrompt,
        pricing: loadPricing(project),
        dependencies: { agent: runAgent, verify: runVerification, browser: withEvaluationBrowser },
      },
      packet,
    );
    const replacement = {
      status: judged.judged.status === 'completed' && judged.judgment ? 'evaluated' : 'incomplete',
      verification,
      candidateTestVerification,
      privateAcceptanceVerification,
      repositoryChecksPassed: verification.checks
        .filter((check) => check.id !== 'acceptance')
        .every((check) => check.status === 'passed'),
      taskAcceptancePassed: acceptance ? acceptance.status === 'passed' : null,
      candidateTestsPassed: candidateTestVerification?.passed ?? null,
      privateAcceptancePassed: privateAcceptanceVerification?.passed ?? null,
      judgment: judged.judgment,
      judgmentError: judged.judgmentError,
      judgeTaskVerdict: judged.judgment?.verdict ?? null,
      judge: JUDGE,
      scoreScale: 10,
      judgeExecution: judged.judged,
      judgeProcess: judged.judgeProcess,
      referenceChanges,
    };
    saveJson(join(output, 'result.json'), {
      ...provenance,
      replacement,
      estimatedApiCostUsd: judged.judgeProcess.estimatedApiCostUsd,
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
