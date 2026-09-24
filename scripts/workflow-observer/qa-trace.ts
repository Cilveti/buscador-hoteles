import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkflowAgent } from './contracts';
import { agentId } from './local';
import { resultText } from './result';
import { type TraceItem, tracePage } from './trace';

type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
const string = (value: unknown) => (typeof value === 'string' ? value : null);
function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    return null;
  }
}
function readText(path: string, limit = 8_000) {
  try {
    return readFileSync(path, 'utf8').slice(0, limit);
  } catch {
    return '';
  }
}
function qaFolders(directory: string) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^round-\d+$/.test(entry.name))
    .map((entry) => ({ relative: `${entry.name}/qa`, path: join(directory, entry.name, 'qa') }))
    .filter(({ path }) => existsSync(path));
}
function steps(path: string) {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^step-\d+$/.test(entry.name))
    .sort((a, b) => Number(a.name.slice(5)) - Number(b.name.slice(5)))
    .map((entry) => ({ number: Number(entry.name.slice(5)), path: join(path, entry.name) }));
}

/** QA is a controller loop of short model calls, not a resumable agent session. */
export function qaSessions(directory: string): WorkflowAgent[] {
  const workflow = object(readJson(join(directory, 'state.json')));
  return qaFolders(directory).flatMap(({ relative, path }) => {
    const calls = steps(path).filter(({ path: step }) => existsSync(join(step, 'agent.json')));
    if (!calls.length) return [];
    const first = calls[0];
    if (!first) return [];
    const metadata = object(readJson(join(first.path, 'agent.json')));
    const report = object(readJson(join(path, 'qa.json')));
    const timings = calls.map(({ path: step }) => object(readJson(join(step, 'timing.json'))));
    const durationMs = timings.reduce((sum, timing) => {
      const duration = timing.durationMs;
      return sum + (typeof duration === 'number' ? duration : 0);
    }, 0);
    return [
      {
        id: agentId(relative),
        role: 'qa',
        harness: string(metadata.harness) ?? 'unknown',
        model: string(metadata.model),
        status: existsSync(join(path, 'qa.json'))
          ? report.passed === true
            ? 'passed'
            : 'failed'
          : workflow.status === 'qa'
            ? 'running'
            : 'unknown',
        startedAt:
          string(timings[0]?.startedAt) ??
          statSync(join(first.path, 'agent.json')).birthtime.toISOString(),
        durationMs: durationMs || null,
        traceAvailable: true,
        output: resultText(join(path, 'qa.json')),
        sessionId: null,
        resumeCommand: null,
      } satisfies WorkflowAgent,
    ];
  });
}

export function qaDirectoryForAgent(directory: string, id: string) {
  return qaFolders(directory).find(({ relative }) => agentId(relative) === id)?.path ?? null;
}

/** Present the observable model decisions and controller actions in their actual order. */
export function qaTraceItems(path: string): TraceItem[] {
  const history = readJson(join(path, 'actions.json'));
  const actions = Array.isArray(history) ? history.map(object) : [];
  const items: TraceItem[] = [];
  const add = (item: Omit<TraceItem, 'index'>) => items.push({ index: items.length, ...item });
  for (const step of steps(path)) {
    const log = join(step.path, 'agent.log');
    if (!existsSync(log)) continue;
    add({ kind: 'lifecycle', title: `Decisión ${step.number + 1}`, body: '', status: null });
    const observation = readText(join(path, `screen-${String(step.number).padStart(2, '0')}.txt`));
    if (observation)
      add({
        kind: 'tool',
        title: 'Controlador · estado del navegador',
        body: observation,
        status: 'completed',
      });
    for (const event of tracePage(log, undefined, 1_000_000).items) {
      if (event.kind === 'lifecycle') continue;
      if (event.kind !== 'message') {
        const { index: _index, ...visible } = event;
        add(visible);
        continue;
      }
      let decision: Json;
      try {
        decision = object(JSON.parse(event.body));
      } catch {
        add({ kind: 'message', title: 'QA', body: event.body, status: event.status });
        continue;
      }
      const rationale = string(decision.rationale);
      if (rationale)
        add({ kind: 'message', title: 'QA · decisión', body: rationale, status: event.status });
      if (decision.action === 'finish')
        add({
          kind: 'message',
          title: 'QA · veredicto',
          body: JSON.stringify(decision.results ?? [], null, 2),
          status: event.status,
        });
    }
    const record = actions[step.number];
    if (record) {
      const action = object(record.action);
      add({
        kind: 'tool',
        title: `Controlador · Playwright · ${string(action.action) ?? 'acción'}`,
        body: JSON.stringify({ action, outcome: record.outcome }, null, 2),
        status: string(record.outcome)?.startsWith('FAILED:') ? 'failed' : 'completed',
      });
    }
  }
  return items;
}

export function qaTracePage(path: string, before?: number) {
  if (before !== undefined) return { items: [], truncated: false, before: null };
  return { items: qaTraceItems(path), truncated: false, before: null };
}
