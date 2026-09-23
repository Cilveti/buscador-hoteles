import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
} from 'node:fs';
import { basename, join, relative } from 'node:path';
import { assertPatchApplies } from '../local-workflow/policy';
import { load } from '../local-workflow/run-state';
import type {
  StepStatus,
  WorkflowAgent,
  WorkflowCheck,
  WorkflowHandoff,
  WorkflowRun,
  WorkflowStep,
} from './contracts';

type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
const string = (value: unknown) => (typeof value === 'string' ? value : null);
const number = (value: unknown) => (typeof value === 'number' ? value : null);
const list = (value: unknown) => (Array.isArray(value) ? value : []);
const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
function json(path: string): Json {
  try {
    return object(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return {};
  }
}
function boundedText(path: string, limit = 10_000) {
  try {
    return readFileSync(path, 'utf8').slice(0, limit);
  } catch {
    return '';
  }
}
function files(root: string, depth = 0): string[] {
  if (!existsSync(root) || depth > 6) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'browser' || entry.name === 'app' || entry.name === 'node_modules')
      return [];
    const path = join(root, entry.name);
    return entry.isDirectory() ? files(path, depth + 1) : entry.isFile() ? [path] : [];
  });
}
export function agentId(path: string) {
  return createHash('sha256').update(path).digest('hex').slice(0, 16);
}
function sessionId(log: string): string | null {
  if (!existsSync(log)) return null;
  try {
    // The first CLI event is thread.started; bounded read avoids loading a live trace.
    const descriptor = openSync(log, 'r');
    const buffer = Buffer.alloc(300);
    let length: number;
    try {
      length = readSync(descriptor, buffer, 0, buffer.length, 0);
    } finally {
      closeSync(descriptor);
    }
    const firstLine = buffer.subarray(0, length).toString('utf8').split('\n')[0];
    if (!firstLine) return null;
    const first = JSON.parse(firstLine) as Json;
    return first.type === 'thread.started' ? string(first.thread_id) : null;
  } catch {
    return null;
  }
}
export function localAgents(directory: string, workspace?: string): WorkflowAgent[] {
  return files(directory)
    .filter((path) => basename(path) === 'agent.json')
    .map((path) => {
      const folder = join(path, '..');
      const relativePath = relative(directory, folder);
      const metadata = json(path);
      const timing = json(join(folder, 'timing.json'));
      const log = join(folder, 'agent.log');
      const thread = sessionId(log);
      const persisted = metadata.sessionPersisted === true;
      return {
        id: agentId(relativePath),
        role: string(metadata.role) ?? basename(folder),
        harness: string(metadata.harness) ?? 'unknown',
        model: string(metadata.model),
        status: existsSync(join(folder, 'result.json'))
          ? 'passed'
          : existsSync(join(folder, 'timing.json'))
            ? 'failed'
            : 'running',
        startedAt: string(timing.startedAt) ?? statSync(path).birthtime.toISOString(),
        durationMs: number(timing.durationMs),
        traceAvailable: existsSync(log),
        output: existsSync(join(folder, 'result.json'))
          ? boundedText(join(folder, 'result.json'), 12_000)
          : null,
        sessionId: thread,
        resumeCommand:
          persisted && thread && (!workspace || existsSync(workspace))
            ? `codex${workspace ? ` -C ${shellQuote(workspace)}` : ''} resume ${thread}`
            : null,
      } satisfies WorkflowAgent;
    })
    .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));
}
const phaseTitles: Record<string, string> = {
  research: 'Investigación',
  planning: 'Plan',
  'waiting-plan': 'Aprobación del plan',
  implementing: 'Implementación',
  verifying: 'Verificación',
  reviewing: 'Review',
  qa: 'QA en navegador',
  completed: 'Entrega',
  blocked: 'Bloqueado',
  failed: 'Error',
  exhausted: 'Intentos agotados',
};
function observedStatus(directory: string, raw: string, updatedAt: string): StepStatus {
  const status = stepStatus(raw);
  if (status !== 'running') return status;
  const lock = join(directory, 'running.lock');
  if (existsSync(lock)) {
    const pid = Number(boundedText(lock, 32));
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
        return 'running';
      } catch {
        return 'unknown';
      }
    }
  }
  const age = Date.now() - Date.parse(updatedAt);
  return age < 15_000 ? 'running' : 'unknown';
}
export function stepStatus(status: string): StepStatus {
  if (status === 'completed' || status === 'passed' || status === 'pass') return 'passed';
  if (status === 'failed' || status === 'exhausted' || status === 'fail') return 'failed';
  if (status === 'blocked' || status === 'waiting-plan') return 'blocked';
  if (
    status === 'running' ||
    status === 'research' ||
    status === 'planning' ||
    status === 'implementing' ||
    status === 'verifying' ||
    status === 'reviewing' ||
    status === 'qa'
  )
    return 'running';
  return 'unknown';
}
function localSteps(directory: string, current: string): WorkflowStep[] {
  const lines = boundedText(join(directory, 'events.jsonl'), 2_000_000).split('\n');
  const events = lines.flatMap((line) => {
    try {
      const value = object(JSON.parse(line));
      return typeof value.status === 'string' ? [value] : [];
    } catch {
      return [];
    }
  });
  return events.map((event, index) => {
    const phase = string(event.status) ?? 'unknown';
    const terminal = ['completed', 'failed', 'blocked', 'exhausted', 'waiting-plan'].includes(
      phase,
    );
    return {
      id: `${index}-${phase}`,
      phase,
      title: phaseTitles[phase] ?? phase,
      status: terminal
        ? stepStatus(phase)
        : index === events.length - 1 && current === phase
          ? 'running'
          : 'passed',
      at: string(event.at),
      message: string(event.message) ?? '',
    } satisfies WorkflowStep;
  });
}
function localChecks(directory: string): WorkflowCheck[] {
  return files(directory)
    .filter((path) => basename(path) === 'verification.json')
    .flatMap((path) =>
      list(json(path).checks).map((raw) => {
        const check = object(raw);
        return {
          id: string(check.id) ?? 'check',
          group: relative(directory, join(path, '..')),
          status: stepStatus(string(check.status) ?? ''),
          durationMs: number(check.durationMs),
        } satisfies WorkflowCheck;
      }),
    );
}
function localHandoffs(directory: string): WorkflowHandoff[] {
  return files(directory)
    .flatMap<WorkflowHandoff>((path) => {
      const rel = relative(directory, path);
      if (basename(path) === 'feedback.md')
        return [
          {
            id: rel,
            kind: 'feedback' as const,
            title: `Feedback · ${rel}`,
            content: boundedText(path),
          },
        ];
      if (/\/review\/result\.json$/.test(path)) {
        const value = json(path);
        return [
          {
            id: rel,
            kind: 'review' as const,
            title: `Review · ${string(value.status) ?? 'sin estado'}`,
            content: JSON.stringify(value, null, 2).slice(0, 10_000),
          },
        ];
      }
      if (/\/qa\/qa\.json$/.test(path)) {
        const value = json(path);
        return [
          {
            id: rel,
            kind: 'qa' as const,
            title: `QA · ${value.passed === true ? 'pasó' : 'no pasó'}`,
            content: JSON.stringify(value.results ?? value, null, 2).slice(0, 10_000),
          },
        ];
      }
      return [];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
const patchCache = new Map<string, { stamp: string; status: StepStatus }>();
function deliveryCheck(directory: string, state: ReturnType<typeof load>): WorkflowCheck | null {
  if (state.status !== 'completed') return null;
  const patch = join(directory, 'candidate.patch');
  if (!existsSync(patch))
    return { id: 'patch-applies', group: 'entrega', status: 'failed', durationMs: null };
  if (!existsSync(state.workspace))
    return { id: 'patch-applies', group: 'entrega', status: 'unknown', durationMs: null };
  const metadata = statSync(patch);
  const stamp = `${state.base}:${metadata.size}:${metadata.mtimeMs}`;
  let cached = patchCache.get(directory);
  if (!cached || cached.stamp !== stamp) {
    let status: StepStatus = 'passed';
    try {
      assertPatchApplies(state, readFileSync(patch, 'utf8'));
    } catch {
      status = 'failed';
    }
    cached = { stamp, status };
    patchCache.set(directory, cached);
  }
  return { id: 'patch-applies', group: 'entrega', status: cached.status, durationMs: null };
}
export function localWorkflowRun(directory: string): WorkflowRun {
  const state = load(directory);
  const receipt = deliveryCheck(directory, state);
  const observed = observedStatus(directory, state.status, state.updatedAt);
  const steps = localSteps(directory, state.status);
  if (receipt?.status === 'failed')
    steps.push({
      id: 'delivery-patch',
      phase: 'failed',
      title: 'Entrega verificable',
      status: 'failed',
      at: state.updatedAt,
      message: 'El patch entregado no se aplica al snapshot base.',
    });
  const artifacts: { id: string; label: string; available: boolean }[] = (
    [
      ['spec', 'Especificación', 'spec.json'],
      ['plan', 'Plan', 'plan.md'],
      ['patch', 'Patch entregado', 'candidate.patch'],
      ['result', 'Resultado', 'RESULTADO.md'],
    ] as const
  ).map(([id, label, file]) => ({ id, label, available: existsSync(join(directory, file)) }));
  return {
    ref: `local:${state.id}`,
    source: 'local',
    definitionId: 'delivery',
    title: state.spec.title,
    runId: state.id,
    status: receipt?.status === 'failed' ? 'failed' : observed,
    rawStatus: state.status,
    message:
      receipt?.status === 'failed'
        ? `Entrega inválida: el patch no se aplica al snapshot base. El controlador histórico indicó «completed», pero el artefacto contradice ese estado.`
        : observed === 'unknown'
          ? `Estado sin proceso activo confirmado. Último mensaje: ${state.message}`
          : state.message,
    startedAt: state.createdAt,
    updatedAt: state.updatedAt,
    round: state.round || null,
    score: null,
    agents: localAgents(directory, state.workspace),
    steps,
    checks: [...localChecks(directory), ...(receipt ? [receipt] : [])],
    handoffs: localHandoffs(directory),
    artifacts,
  };
}

export function localWorkflowSummary(directory: string): WorkflowRun {
  const state = load(directory);
  const receipt = deliveryCheck(directory, state);
  const observed = observedStatus(directory, state.status, state.updatedAt);
  return {
    ref: `local:${state.id}`,
    source: 'local',
    definitionId: 'delivery',
    title: state.spec.title,
    runId: state.id,
    status: receipt?.status === 'failed' ? 'failed' : observed,
    rawStatus: state.status,
    message:
      receipt?.status === 'failed'
        ? 'Entrega inválida: el patch no se aplica al snapshot base.'
        : observed === 'unknown'
          ? `Estado sin proceso activo confirmado. Último mensaje: ${state.message}`
          : state.message,
    startedAt: state.createdAt,
    updatedAt: state.updatedAt,
    round: state.round || null,
    score: null,
    agents: [],
    steps: [],
    checks: [],
    handoffs: [],
    artifacts: [],
  };
}

export function localAgentLog(directory: string, id: string): string | null {
  const file = files(directory).find(
    (path) =>
      basename(path) === 'agent.json' && agentId(relative(directory, join(path, '..'))) === id,
  );
  if (!file) return null;
  const log = join(file, '..', 'agent.log');
  return existsSync(log) ? log : null;
}
