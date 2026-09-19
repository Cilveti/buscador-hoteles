import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { runVerification } from '../verification/verify';
import { withEvaluationBrowser } from './browser';
import { configSchema } from './config';
import { loadPricing } from './cost';
import { bundleMetadata, copyPrivateEvidence, freezePrivateInputs } from './private-inputs';
import { finishEvaluationStorage, requireRetainedEvidence } from './retention';
import { judgeDelivery } from './runner';
import { runAgent } from './runtime';
import { qualityScore } from './score';
import { git, hashFile, saveJson } from './workspace';

/** New evidence + a new judge session; original delivery, packet, verdict and costs remain immutable. */
export async function rejudgeRun(
  project: string,
  runDirectory: string,
  judgeDossier: string,
  agent: typeof runAgent = runAgent,
) {
  const run = resolve(project, runDirectory);
  requireRetainedEvidence(run);
  const original = z
    .object({ config: configSchema })
    .parse(JSON.parse(readFileSync(join(run, 'result.json'), 'utf8')));
  const oldPacket = join(run, 'judge-input');
  if (!existsSync(oldPacket)) throw new Error('Run has no preserved judge-input packet.');
  const id = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`;
  const output = join(run, 'rejudgments', id);
  const privateInputs = freezePrivateInputs(project, original.config.task, `rejudge-${id}`, {
    judgeDossier,
    privateAcceptance: null,
  });
  mkdirSync(output, { recursive: true });
  saveJson(join(output, 'private-inputs.json'), privateInputs);
  const packet = join(output, 'judge-input');
  cpSync(oldPacket, packet, { recursive: true, filter: (source) => basename(source) !== '.git' });
  rmSync(join(packet, 'judge-dossier'), { recursive: true, force: true });
  if (privateInputs.dossier)
    copyPrivateEvidence(privateInputs.dossier, join(packet, 'judge-dossier'));
  const experimentPath = join(packet, 'experiment.json');
  const experiment = z
    .record(z.string(), z.unknown())
    .parse(JSON.parse(readFileSync(experimentPath, 'utf8')));
  saveJson(experimentPath, { ...experiment, judgeDossier: bundleMetadata(privateInputs.dossier) });
  git(packet, ['init', '-q']);
  // Use current rubric to understand dossiers; freeze it and retain the historical rubric hash.
  const judgePrompt = readFileSync(join(project, 'evals/coding/prompts/judge.md'), 'utf8');
  writeFileSync(join(output, 'judge-prompt.md'), judgePrompt);
  const campaign = dirname(dirname(run));
  const provenance = {
    originalRun: run,
    originalJudgmentSha256: existsSync(join(run, 'judgment.json'))
      ? hashFile(join(run, 'judgment.json'))
      : null,
    judgePromptSha256: hashFile(join(output, 'judge-prompt.md')),
    originalJudgePromptSha256: existsSync(join(campaign, 'judge-prompt.md'))
      ? hashFile(join(campaign, 'judge-prompt.md'))
      : null,
    judgeDossier: bundleMetadata(privateInputs.dossier),
    verification: 'preserved; no candidate or checks rerun',
  };
  const pricing = loadPricing(project);
  saveJson(join(output, 'pricing.json'), pricing);
  saveJson(join(output, 'result.json'), { ...provenance, status: 'running' });
  try {
    const result = await judgeDelivery(
      {
        output,
        config: original.config,
        judgePrompt,
        pricing,
        dependencies: { agent, verify: runVerification, browser: withEvaluationBrowser },
      },
      packet,
    );
    saveJson(join(output, 'result.json'), {
      ...provenance,
      status: result.judged.status === 'completed' && result.judgment ? 'evaluated' : 'incomplete',
      judgment: result.judgment,
      scoreScale: 10,
      score: qualityScore(result.judgment, 10),
      judgmentError: result.judgmentError,
      judgeExecution: result.judged,
      judgeProcess: result.judgeProcess,
      estimatedApiCostUsd: result.judgeProcess.estimatedApiCostUsd,
    });
  } catch (error) {
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
