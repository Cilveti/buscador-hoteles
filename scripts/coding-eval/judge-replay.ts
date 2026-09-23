import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { z } from 'zod';
import { runVerification } from '../verification/verify';
import { withEvaluationBrowser } from './browser';
import { configSchema } from './config';
import { loadPricing } from './cost';
import { finishEvaluationStorage } from './retention';
import { compactProcessSummary, judgeDelivery } from './runner';
import { runAgent } from './runtime';
import { qualityScore } from './score';
import { git, hashFile, saveJson } from './workspace';

const corpusSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      sourceRun: z.string(),
      packetMode: z.literal('full'),
      packetManifestSha256: z.string(),
      sourceOutcome: z.record(z.string(), z.unknown()),
    }),
  ),
});

function compactPacket(source: string, target: string) {
  cpSync(source, target, {
    recursive: true,
    filter: (path) => basename(path) !== '.git',
  });
  const processPath = join(target, 'process.json');
  if (!existsSync(processPath)) throw new Error(`Missing process evidence: ${processPath}`);
  const processEvidence = JSON.parse(readFileSync(processPath, 'utf8'));
  saveJson(join(target, 'process-summary.json'), compactProcessSummary(processEvidence, target));
  rmSync(processPath);
  const experimentPath = join(target, 'experiment.json');
  const experiment = z
    .record(z.string(), z.unknown())
    .parse(JSON.parse(readFileSync(experimentPath, 'utf8')));
  saveJson(experimentPath, { ...experiment, judgePacketMode: 'compact' });
  const originalManifestPath = join(target, 'packet-manifest.json');
  const originalManifestSha256 = hashFile(originalManifestPath);
  const originalManifest = z
    .record(z.string(), z.unknown())
    .parse(JSON.parse(readFileSync(originalManifestPath, 'utf8')));
  saveJson(originalManifestPath, {
    ...originalManifest,
    mode: 'compact',
    replayConversion: {
      originalManifestSha256,
      removed: ['process.json'],
      regenerated: ['process-summary.json'],
    },
  });
  git(target, ['init', '-q']);
}

async function replay(
  project: string,
  corpus: string,
  outputRoot: string,
  entry: z.infer<typeof corpusSchema>['entries'][number],
  mode: 'full' | 'compact',
) {
  const sourceRun = resolve(project, entry.sourceRun);
  const sourcePacket = join(corpus, entry.id);
  const output = join(outputRoot, entry.id);
  const packet = join(output, 'judge-input');
  mkdirSync(output, { recursive: true });
  const original = z
    .object({ config: configSchema })
    .parse(JSON.parse(readFileSync(join(sourceRun, 'result.json'), 'utf8')));
  if (mode === 'compact') compactPacket(sourcePacket, packet);
  else {
    cpSync(sourcePacket, packet, {
      recursive: true,
      filter: (path) => basename(path) !== '.git',
    });
    git(packet, ['init', '-q']);
  }
  const judgePrompt = readFileSync(join(project, 'evals/coding/prompts/judge.md'), 'utf8');
  const pricing = loadPricing(project);
  saveJson(join(output, 'provenance.json'), {
    sourceRun: entry.sourceRun,
    sourcePacket: entry.id,
    sourcePacketManifestSha256: entry.packetManifestSha256,
    sourceOutcome: entry.sourceOutcome,
    judgePacketMode: mode,
    judgePromptSha256: hashFile(join(project, 'evals/coding/prompts/judge.md')),
  });
  saveJson(join(output, 'result.json'), { status: 'running', sourceRun: entry.sourceRun });
  try {
    const result = await judgeDelivery(
      {
        output,
        config: { ...original.config, judgePacketMode: mode },
        judgePrompt,
        pricing,
        dependencies: { agent: runAgent, verify: runVerification, browser: withEvaluationBrowser },
      },
      packet,
    );
    saveJson(join(output, 'result.json'), {
      status: result.judged.status === 'completed' && result.judgment ? 'evaluated' : 'incomplete',
      sourceRun: entry.sourceRun,
      sourceOutcome: entry.sourceOutcome,
      judgment: result.judgment,
      judgmentError: result.judgmentError,
      scoreScale: 10,
      score: qualityScore(result.judgment, 10),
      judgeExecution: result.judged,
      judgeProcess: result.judgeProcess,
      estimatedApiCostUsd: result.judgeProcess.estimatedApiCostUsd,
    });
    return output;
  } finally {
    finishEvaluationStorage(project, output);
  }
}

if (import.meta.main) {
  const [corpusArgument, outputArgument, modeArgument = 'compact', ...selectedIds] =
    process.argv.slice(2);
  if (!corpusArgument || !outputArgument)
    throw new Error(
      'Usage: bun judge-replay.ts CORPUS_DIR OUTPUT_DIR [full|compact] [ENTRY_ID...]',
    );
  const mode = z.enum(['full', 'compact']).parse(modeArgument);
  const project = process.cwd();
  const corpus = resolve(project, corpusArgument);
  const output = resolve(project, outputArgument);
  const manifest = corpusSchema.parse(
    JSON.parse(readFileSync(join(corpus, 'manifest.json'), 'utf8')),
  );
  const entries = selectedIds.length
    ? manifest.entries.filter(({ id }) => selectedIds.includes(id))
    : manifest.entries;
  if (!entries.length) throw new Error('No corpus entries selected.');
  mkdirSync(output, { recursive: true });
  saveJson(join(output, 'manifest.json'), {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    corpus: corpusArgument,
    packetMode: mode,
    entries: entries.map(({ id, sourceRun }) => ({ id, sourceRun })),
  });
  const results = await Promise.all(
    entries.map((entry) => replay(project, corpus, output, entry, mode)),
  );
  saveJson(join(output, 'manifest.json'), {
    schemaVersion: 1,
    startedAt: JSON.parse(readFileSync(join(output, 'manifest.json'), 'utf8')).startedAt,
    finishedAt: new Date().toISOString(),
    corpus: corpusArgument,
    packetMode: mode,
    results,
  });
}
