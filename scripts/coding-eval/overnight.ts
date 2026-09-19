import { execFileSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, statfsSync } from 'node:fs';
import { freemem, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { configSchema } from './config';
import { effectiveRun } from './reverify';
import { runCampaign } from './runner';
import { hashFile, saveJson } from './workspace';

const planSchema = z.object({
  stopAt: z.string().datetime(),
  frozenInputs: z.record(z.string(), z.string()).default({}),
  cases: z.array(z.object({ name: z.string(), config: configSchema })),
});
const record = z.record(z.string(), z.unknown());
const stateSchema = z.object({
  nextCase: z.number().int().nonnegative(),
  campaigns: z.array(
    z.object({ name: z.string(), path: z.string(), outcomes: z.array(z.unknown()) }),
  ),
});

/** Finite local batch: no orchestration model, one campaign at a time, two candidates per case. */
async function main() {
  const project = resolve(import.meta.dir, '../..');
  const directory = resolve(process.argv[2] ?? '.agent-evals/overnight-20260916');
  const plan = planSchema.parse(JSON.parse(readFileSync(join(directory, 'plan.json'), 'utf8')));
  const lock = join(directory, 'worker.lock');
  const descriptor = openSync(lock, 'wx');
  closeSync(descriptor);
  const stateFile = join(directory, 'state.json');
  const state = existsSync(stateFile)
    ? stateSchema.parse(JSON.parse(readFileSync(stateFile, 'utf8')))
    : { nextCase: 0, campaigns: [] };
  const status = (phase: string, extra: Record<string, unknown> = {}) =>
    saveJson(stateFile, {
      ...state,
      phase,
      pid: process.pid,
      updatedAt: new Date().toISOString(),
      stopAt: plan.stopAt,
      ...extra,
    });
  let peakTreeRssKiB = 0;
  const sampling = setInterval(() => {
    const disk = statfsSync(project);
    const processes = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((line) => {
        const [pid = 0, ppid = 0, rss = 0] = line.trim().split(/\s+/).map(Number);
        return { pid, ppid, rss };
      });
    const ids = new Set([process.pid]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const p of processes)
        if (ids.has(p.ppid) && !ids.has(p.pid)) {
          ids.add(p.pid);
          changed = true;
        }
    }
    const treeRssKiB = processes.filter((p) => ids.has(p.pid)).reduce((sum, p) => sum + p.rss, 0);
    peakTreeRssKiB = Math.max(peakTreeRssKiB, treeRssKiB);
    const resource = {
      sampledAt: new Date().toISOString(),
      freeDiskGiB: (disk.bavail * disk.bsize) / 1024 ** 3,
      workerMemory: process.memoryUsage(),
      treeRssKiB,
      peakTreeRssKiB,
      processes: ids.size,
      freeMemoryBytes: freemem(),
      totalMemoryBytes: totalmem(),
    };
    saveJson(join(directory, 'resources.json'), resource);
    appendFileSync(join(directory, 'resources.jsonl'), JSON.stringify(resource) + '\n');
  }, 30_000);
  try {
    status('starting');
    for (; state.nextCase < plan.cases.length; state.nextCase++) {
      if (existsSync(join(directory, 'pause'))) {
        status('paused');
        return;
      }
      if (Date.now() >= Date.parse(plan.stopAt) - 45 * 60_000) {
        status('deadline', {
          reason: 'Reserve time for current runs and the morning report; no new case launched.',
        });
        return;
      }
      for (const [path, hash] of Object.entries(plan.frozenInputs))
        if (hashFile(join(project, path)) !== hash)
          throw new Error(`Frozen input changed: ${path}; create a new version before continuing`);
      const disk = statfsSync(project);
      if (disk.bavail * disk.bsize < 4 * 1024 ** 3)
        throw new Error('Less than 4 GiB free before provisioning; no candidate launched.');
      const entry = plan.cases[state.nextCase];
      if (!entry) throw new Error('Missing case');
      status('running', { activeCase: entry.name });
      const campaign = await runCampaign(project, entry.config);
      const manifest = record.parse(
        JSON.parse(readFileSync(join(campaign, 'manifest.json'), 'utf8')),
      );
      const outcomes = [];
      for (let i = 1; i <= entry.config.repeats; i++) {
        const run = join(campaign, 'runs', String(i).padStart(3, '0'));
        if (!existsSync(join(run, 'result.json'))) continue;
        const result = effectiveRun(
          run,
          record.parse(JSON.parse(readFileSync(join(run, 'result.json'), 'utf8'))),
        );
        outcomes.push(
          Object.fromEntries(
            [
              'id',
              'status',
              'outcome',
              'score',
              'passed',
              'repositoryChecksPassed',
              'privateAcceptancePassed',
              'candidateTestsPassed',
              'judgeTaskVerdict',
              'evaluationIssues',
              'estimatedApiCostUsd',
            ].map((key) => [key, result[key]]),
          ),
        );
      }
      state.campaigns.push({ name: entry.name, path: campaign, outcomes });
      if (
        manifest.status !== 'completed' ||
        outcomes.some((outcome) => outcome.outcome === 'evaluation_error')
      ) {
        // Preserve the case pointer for explicit orchestration review; never auto-retry a broken context.
        throw new Error(`Infrastructure review required for ${entry.name}: ${campaign}`);
      }
      status('case_completed', { completedCase: entry.name });
    }
    status('completed');
  } catch (error) {
    status('needs_attention', { error: String(error) });
    throw error;
  } finally {
    clearInterval(sampling);
    const { unlinkSync } = await import('node:fs');
    unlinkSync(lock);
  }
}

if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(String(error));
    process.exitCode = 1;
  });
