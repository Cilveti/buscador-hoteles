import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkflowApi } from './api';
import { agentId } from './local';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'workflow-observer-')));
  roots.push(project);
  const run = join(project, '.tmp/local-workflows/run-one');
  const worker = join(run, 'round-1/implementation-1');
  const evalRun = join(project, '.agent-evals/campaign/runs/001');
  for (const path of [
    worker,
    evalRun,
    join(project, 'workflows/definitions'),
    join(project, 'docs/workflows/examples'),
  ])
    mkdirSync(path, { recursive: true });
  const spec = {
    id: 'sample',
    title: 'Tarea de ejemplo',
    objective: 'Observar una tarea',
    scope: ['Cambiar copy'],
    outOfScope: [],
    acceptance: [{ id: 'AC1', criterion: 'El copy cambia' }],
    decisions: [],
  };
  writeFileSync(join(project, 'docs/workflows/examples/sample.json'), JSON.stringify(spec));
  writeFileSync(
    join(project, 'workflow.agents.json'),
    JSON.stringify({ default: { harness: 'codex' }, roles: {} }),
  );
  writeFileSync(
    join(project, 'workflows/definitions/delivery.json'),
    JSON.stringify({
      id: 'delivery',
      title: 'Entrega',
      description: 'Workflow completo',
      engine: 'local-workflow',
      stages: ['implementing', 'verifying'],
      launchable: true,
    }),
  );
  writeFileSync(
    join(run, 'state.json'),
    JSON.stringify({
      id: 'run-one',
      project,
      directory: run,
      workspace: project,
      base: '0'.repeat(40),
      mode: 'normal',
      status: 'failed',
      spec,
      plan: null,
      approval: false,
      completedTasks: [],
      attempts: {},
      round: 1,
      maxRounds: 2,
      maxTaskAttempts: 2,
      headed: false,
      message: 'El reviewer encontró un fallo',
      createdAt: '2026-09-23T00:00:00Z',
      updatedAt: '2026-09-23T00:01:00Z',
    }),
  );
  writeFileSync(
    join(run, 'events.jsonl'),
    [
      JSON.stringify({
        at: '2026-09-23T00:00:00Z',
        status: 'implementing',
        message: 'Implementando',
      }),
      JSON.stringify({ at: '2026-09-23T00:01:00Z', status: 'failed', message: 'Falló' }),
    ].join('\n'),
  );
  writeFileSync(
    join(worker, 'agent.json'),
    JSON.stringify({ role: 'implementer', harness: 'codex', model: 'gpt-6-luna' }),
  );
  writeFileSync(
    join(worker, 'agent.log'),
    [
      JSON.stringify({ type: 'thread.started', thread_id: 'session-123' }),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: 'He implementado el cambio.' },
      }),
      JSON.stringify({ type: 'item.completed', item: { type: 'reasoning', text: 'private' } }),
    ].join('\n'),
  );
  writeFileSync(join(worker, 'feedback.md'), 'El check de URL falló; conserva los filtros.');
  writeFileSync(
    join(project, '.agent-evals/campaign/manifest.json'),
    JSON.stringify({ status: 'completed' }),
  );
  writeFileSync(
    join(evalRun, 'result.json'),
    JSON.stringify({
      status: 'evaluated',
      outcome: 'fail',
      score: 4,
      config: {
        task: 'sample',
        candidateKind: 'single-agent',
        harness: 'codex',
        model: 'gpt-6-luna',
      },
    }),
  );
  mkdirSync(join(evalRun, 'candidate-session'));
  writeFileSync(
    join(evalRun, 'candidate-session/events.jsonl'),
    `${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'Candidato único' } })}\n`,
  );
  const token = 'test-token';
  const launched: string[] = [];
  const api = createWorkflowApi(project, token, (directory, approval) =>
    launched.push(`${directory}:${approval}`),
  );
  const request = (path: string, init?: RequestInit) =>
    api(
      new Request(`http://127.0.0.1:3417${path}`, {
        ...init,
        headers: {
          host: '127.0.0.1:3417',
          origin: 'http://127.0.0.1:3417',
          'x-lab-token': token,
          ...init?.headers,
        },
      }),
    );
  return { project, run, worker, request, launched };
}

test('proyecta workflows y evals, incluido candidato único, con fallo y feedback observables', async () => {
  const { project, request, worker } = fixture();
  const list = await (await request('/api/workflows')).json();
  expect(list).toHaveLength(2);
  const localList = await (await request('/api/workflows?source=local')).json();
  expect(localList).toHaveLength(1);
  expect(localList[0].source).toBe('local');
  const evalList = await (await request('/api/workflows?source=evaluation')).json();
  expect(evalList).toHaveLength(1);
  expect(evalList[0].source).toBe('evaluation');
  const local = await (await request('/api/workflows/local:run-one')).json();
  expect(local.status).toBe('failed');
  expect(local.steps.at(-1).status).toBe('failed');
  expect(local.handoffs[0].content).toContain('conserva los filtros');
  expect(local.agents[0].id).toBe(agentId('round-1/implementation-1'));
  const trace = await (
    await request(
      `/api/workflows/local:run-one/agents/${agentId('round-1/implementation-1')}/trace`,
    )
  ).json();
  expect(trace.items.some((item: { body: string }) => item.body.includes('He implementado'))).toBe(
    true,
  );
  expect(JSON.stringify(trace)).not.toContain('private');
  const evaluation = await (await request('/api/workflows/evaluation:campaign:001')).json();
  expect(evaluation.definitionId).toBe('single-agent');
  expect(evaluation.agents).toHaveLength(1);
  expect(evaluation.status).toBe('failed');
  const candidateTrace = await (
    await request('/api/workflows/evaluation:campaign:001/agents/candidate/trace')
  ).json();
  expect(candidateTrace.items[0].body).toBe('Candidato único');
  expect(readFileSync(join(worker, 'feedback.md'), 'utf8')).toContain('URL');
  writeFileSync(
    join(project, '.agent-evals/campaign/runs/001/result.json'),
    JSON.stringify({ status: 'incomplete', error: 'Preflight de Chrome fallido' }),
  );
  const incomplete = await (await request('/api/workflows/evaluation:campaign:001')).json();
  expect(incomplete.status).toBe('failed');
  expect(incomplete.message).toContain('Preflight de Chrome fallido');
});

test('restringe catálogo y rutas, y solo permite aprobar un run realmente en espera', async () => {
  const { request, run, launched } = fixture();
  const catalog = await (await request('/api/workflows/catalog')).json();
  expect(catalog.definitions[0].id).toBe('delivery');
  expect(catalog.specs[0].id).toBe('sample');
  expect(catalog.harnesses).toEqual(['codex']);
  expect(catalog.agentDefaults.default).toEqual({ harness: 'codex' });
  const invalid = await request('/api/workflows', {
    method: 'POST',
    body: JSON.stringify({
      definitionId: 'delivery',
      specPath: '../../etc/passwd',
      agentConfig: { default: { harness: 'codex' } },
    }),
  });
  expect(invalid.status).toBe(400);
  const unavailableHarness = await request('/api/workflows', {
    method: 'POST',
    body: JSON.stringify({
      definitionId: 'delivery',
      specPath: 'docs/workflows/examples/sample.json',
      agentConfig: { default: { harness: 'uninstalled' } },
    }),
  });
  expect(unavailableHarness.status).toBe(400);
  expect((await request('/api/workflows/local:..%2Fescape')).status).toBe(400);
  expect(
    (await request('/api/workflows/local:run-one/approve-plan', { method: 'POST' })).status,
  ).toBe(400);
  const state = JSON.parse(readFileSync(join(run, 'state.json'), 'utf8'));
  state.status = 'waiting-plan';
  writeFileSync(join(run, 'state.json'), JSON.stringify(state));
  expect(
    (await request('/api/workflows/local:run-one/approve-plan', { method: 'POST' })).status,
  ).toBe(202);
  expect(
    (await request('/api/workflows/local:run-one/approve-plan', { method: 'POST' })).status,
  ).toBe(409);
  expect(launched).toEqual([`${run}:true`]);
});

test('stream entrega la instantánea inicial y termina al cancelar', async () => {
  const { request } = fixture();
  const controller = new AbortController();
  const response = await request('/api/workflows/local:run-one/stream', {
    signal: controller.signal,
  });
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  const reader = response.body?.getReader();
  const first = await reader?.read();
  expect(new TextDecoder().decode(first?.value)).toContain('"status":"failed"');
  controller.abort();
  await reader?.cancel();
});
