import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { resolveAgents } from '../local-workflow/agents';
import { type Specification, specSchema } from '../local-workflow/contracts';
import { availablePort } from '../local-workflow/qa';
import { createEvaluationRun } from '../local-workflow/run-state';
import { executeWorkflow } from '../local-workflow/workflow';
import type { withEvaluationBrowser } from './browser';
import { codexExecutable } from './codex-executable';
import type { CandidateCheck, EvalConfig } from './config';
import { withCandidateIsolation } from './isolation';
import type { AgentResult } from './runtime';
import { analyzeEvents } from './trace';

function json(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function events(path: string): unknown[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as unknown];
      } catch {
        return [];
      }
    });
}

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  });
}

/** A workflow is one candidate delivery, with phase evidence retained separately from model logs. */
export async function runWorkflowCandidate(options: {
  candidateRoot: string;
  output: string;
  config: EvalConfig;
  specification: Specification;
  browser: typeof withEvaluationBrowser;
  privateReadRoots: string[];
  checks: CandidateCheck[];
}) {
  const { candidateRoot, output, config, specification, browser, privateReadRoots, checks } =
    options;
  const spec = specSchema.parse(specification);
  if (spec.id !== config.task)
    throw new Error(`Workflow spec task mismatch: ${spec.id} != ${config.task}`);
  const workflowDirectory = join(output, 'workflow');
  mkdirSync(workflowDirectory, { recursive: true });
  const started = performance.now();
  let executionError: string | null = null;
  let workflowStatus = 'not_started';
  await browser(
    async (endpoint) =>
      withCandidateIsolation(
        candidateRoot,
        privateReadRoots,
        codexExecutable(),
        async (permissionArgs, isolatedRoot) => {
          const agents = resolveAgents({
            default: {
              harness: 'codex',
              model: config.model,
              reasoningEffort: config.effort,
            },
          });
          const state = createEvaluationRun(isolatedRoot, workflowDirectory, spec, agents, {
            permissionArgs,
            browserEndpoint: endpoint,
          });
          try {
            const result = await executeWorkflow(state);
            workflowStatus = result.status;
          } catch (error) {
            executionError = String(error);
            workflowStatus = state.status;
          }
        },
        {
          checks,
          env: {
            EVAL_BROWSER_WS_ENDPOINT: endpoint,
            EVAL_PROJECT_ROOT: candidateRoot,
            EVAL_BROWSER_PORT: String(await availablePort()),
            EVAL_BROWSER_OUTPUT: join(candidateRoot, '.agent-evals/browser'),
          },
        },
      ),
    undefined,
    privateReadRoots,
  );
  const workerCalls = walk(workflowDirectory)
    .filter((path) => path.endsWith('/agent.log'))
    .map((path) => {
      const agentPath = join(path, '..', 'agent.json');
      const agent = existsSync(agentPath)
        ? (json(agentPath) as { role?: string; model?: string })
        : {};
      const trace = analyzeEvents(events(path));
      const timingPath = join(path, '..', 'timing.json');
      const timing = existsSync(timingPath)
        ? (json(timingPath) as { startedAt: string; durationMs: number })
        : null;
      return {
        role: agent.role ?? basename(join(path, '..')),
        model: agent.model ?? config.model,
        path: path.slice(workflowDirectory.length + 1),
        bytes: statSync(path).size,
        timing,
        completed: trace.completed,
        usage: trace.usage,
        commands: trace.commands.length,
        edits: trace.observedEditEvents.length,
        errors: trace.errors,
      };
    })
    .sort((a, b) => (a.timing?.startedAt ?? '').localeCompare(b.timing?.startedAt ?? ''));
  const usage = Object.fromEntries(
    [...new Set(workerCalls.flatMap((call) => Object.keys(call.usage ?? {})))].map((key) => [
      key,
      workerCalls.reduce((total, call) => total + (call.usage?.[key] ?? 0), 0),
    ]),
  );
  const reviews = walk(workflowDirectory)
    .filter((path) => /\/review\/result\.json$/.test(path))
    .map((path) => ({ path: path.slice(workflowDirectory.length + 1), result: json(path) }));
  const qa = walk(workflowDirectory)
    .filter((path) => /\/qa\/qa\.json$/.test(path))
    .map((path) => {
      const result = json(path) as {
        passed?: boolean;
        results?: unknown;
        requests?: unknown;
        history?: { action: unknown; outcome: string; screenshot: string }[];
      };
      return {
        path: path.slice(workflowDirectory.length + 1),
        passed: result.passed,
        results: result.results,
        requests: result.requests,
        history: result.history?.map(({ action, outcome, screenshot }) => ({
          action,
          outcome,
          screenshot,
        })),
      };
    });
  const qaActions = walk(workflowDirectory)
    .filter((path) => /\/qa\/actions\.json$/.test(path))
    .filter((path) => !existsSync(join(path, '..', 'qa.json')))
    .map((path) => ({
      path: path.slice(workflowDirectory.length + 1),
      actions: (json(path) as { action: unknown; outcome: string; screenshot: string }[]).map(
        ({ action, outcome, screenshot }) => ({ action, outcome, screenshot }),
      ),
    }));
  const verification = walk(workflowDirectory)
    .filter((path) => path.endsWith('/verification.json'))
    .map((path) => {
      const result = json(path) as {
        passed?: boolean;
        checks?: { id: string; status: string; durationMs?: number }[];
      };
      return {
        path: path.slice(workflowDirectory.length + 1),
        passed: result.passed,
        checks: result.checks?.map(({ id, status, durationMs }) => ({ id, status, durationMs })),
      };
    });
  const roundPatches = walk(workflowDirectory)
    .filter((path) => /\/round-[0-9]+\/candidate\.patch$/.test(path))
    .map((path) => ({
      path: path.slice(workflowDirectory.length + 1),
      sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
      bytes: statSync(path).size,
    }));
  const feedback = walk(workflowDirectory)
    .filter((path) => path.endsWith('/feedback.md'))
    .map((path) => ({
      path: path.slice(workflowDirectory.length + 1),
      text: readFileSync(path, 'utf8'),
    }));
  const state = existsSync(join(workflowDirectory, 'state.json'))
    ? (json(join(workflowDirectory, 'state.json')) as {
        round?: number;
        attempts?: unknown;
        message?: string;
      })
    : null;
  const workflowEvents = events(join(workflowDirectory, 'events.jsonl')) as {
    at?: string;
    status?: string;
    message?: string;
  }[];
  const phaseDurations = workflowEvents.flatMap((event, index) => {
    const next = workflowEvents[index + 1];
    if (!event.at || !event.status || !next?.at) return [];
    return [
      {
        phase: event.status,
        message: event.message ?? '',
        durationMs: Date.parse(next.at) - Date.parse(event.at),
      },
    ];
  });
  const workflow = {
    status: workflowStatus,
    error: executionError,
    durationMs: Math.round(performance.now() - started),
    rounds: state?.round ?? null,
    attempts: state?.attempts ?? null,
    message: state?.message ?? null,
    workerCalls,
    reviews,
    qa,
    qaActions,
    verification,
    roundPatches,
    feedback,
    events: workflowEvents,
    phaseDurations,
    scope:
      'Local workflow: research → plan → implement → deterministic verify → review → QA → feedback/repair.',
  };
  const summaryPath = join(output, 'workflow-evidence.json');
  writeFileSync(summaryPath, `${JSON.stringify(workflow, null, 2)}\n`);
  const finalPath = join(output, 'workflow-final.txt');
  const report = join(workflowDirectory, 'RESULTADO.md');
  writeFileSync(
    finalPath,
    existsSync(report)
      ? readFileSync(report, 'utf8')
      : `Workflow ${workflowStatus}. ${executionError ?? state?.message ?? ''}\n`,
  );
  const eventsPath = join(output, 'workflow-candidate-events.jsonl');
  writeFileSync(
    eventsPath,
    `${JSON.stringify({ type: 'turn.completed', usage })}\n${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: `Workflow status: ${workflowStatus}` } })}\n`,
  );
  const candidate: AgentResult = {
    status: executionError === null ? 'completed' : 'failed',
    exitCode: executionError === null ? 0 : 1,
    eventsPath,
    stdoutPath: summaryPath,
    stderrPath: summaryPath,
    finalPath,
    durationMs: workflow.durationMs,
    command: ['local-workflow', 'normal', config.model, config.effort],
  };
  return { candidate, workflow };
}
