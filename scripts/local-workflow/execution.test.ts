import { afterEach, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from '../coding-eval/workspace';
import { resolveAgents } from './agents';
import { type Plan, specSchema } from './contracts';
import { ProcessTimeoutError } from './process';
import { load, save, type WorkflowState } from './run-state';
import { localStages, type WorkflowStages } from './stages';
import { executeWorkflow } from './workflow';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'workflow-execution-'));
  roots.push(root);
  const workspace = join(root, 'candidate');
  const directory = join(root, 'run');
  mkdirSync(join(workspace, 'apps/web/src'), { recursive: true });
  mkdirSync(directory);
  writeFileSync(join(workspace, 'apps/web/src/example.ts'), 'export const value = 1;\n');
  git(workspace, ['init', '--quiet']);
  git(workspace, ['add', '-A']);
  git(workspace, [
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@localhost',
    'commit',
    '-qm',
    'base',
  ]);
  const state: WorkflowState = {
    id: 'test',
    project: workspace,
    workspace,
    directory,
    base: git(workspace, ['rev-parse', 'HEAD']),
    mode: 'normal',
    agents: resolveAgents({ default: { harness: 'codex' } }),
    status: 'research',
    spec: specSchema.parse({
      id: 'demo-task',
      title: 'Buscar con teclado',
      objective: 'Recuperar resultados usando el teclado.',
      scope: ['Búsqueda'],
      outOfScope: [],
      decisions: [],
      acceptance: [{ id: 'AC1', criterion: 'Escape borra la consulta.' }],
    }),
    plan: null,
    approval: false,
    completedTasks: [],
    attempts: {},
    round: 0,
    maxRounds: 2,
    maxTaskAttempts: 2,
    headed: false,
    message: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  save(state);
  const calls: string[] = [];
  const inputs: { id: string; feedback: string; completed: string[] }[] = [];
  const plan: Plan = {
    summary: 'Plan',
    blockers: [],
    tasks: [
      { id: 'keyboard', title: 'Teclado', instructions: 'Añadir Escape', criteria: ['AC1'] },
      { id: 'focus', title: 'Foco', instructions: 'Conservar el foco', criteria: ['AC1'] },
    ],
  };
  const stages: WorkflowStages = {
    ...localStages,
    async verify(_state, output) {
      calls.push('verify');
      mkdirSync(output, { recursive: true });
      return {
        schemaVersion: 1,
        root: workspace,
        startedAt: '',
        finishedAt: '',
        timeoutSeconds: 180,
        passed: true,
        checks: [],
      };
    },
    async research() {
      calls.push('research');
      return [{ summary: 'Contexto', files: [], risks: [], blockers: [] }];
    },
    async plan() {
      calls.push('plan');
      return structuredClone(plan);
    },
    async implement(current, input) {
      calls.push('implement');
      mkdirSync(input.output, { recursive: true });
      inputs.push({
        id: input.task.id,
        feedback: input.feedback,
        completed: [...current.completedTasks],
      });
      return { status: 'implemented', summary: 'Hecho', blockers: [] };
    },
    checkFeedback() {
      return 'lint: incorrect imports';
    },
    async review() {
      calls.push('review');
      return { status: 'pass', summary: 'Revisado', findings: [] };
    },
    async qa() {
      calls.push('qa');
      return {
        passed: true,
        results: [
          { id: 'AC1', status: 'pass', observed: 'Consulta vacía', evidence: ['screen-01.png'] },
        ],
        history: [],
        screenshots: ['screen-01.png'],
        requests: [],
        baseURL: 'http://127.0.0.1:1',
        scope: 'test double',
      };
    },
    deliver(...args) {
      calls.push('deliver');
      localStages.deliver(...args);
    },
  };
  return { state, stages, calls, inputs };
}

test('normal flow keeps phase order and writes the delivery on the verified candidate', async () => {
  const { state, stages, calls } = fixture();
  await executeWorkflow(state, false, stages);
  expect(calls).toEqual([
    'verify',
    'research',
    'plan',
    'implement',
    'verify',
    'review',
    'qa',
    'deliver',
  ]);
  expect(load(state.directory).status).toBe('completed');
  expect(readFileSync(join(state.directory, 'RESULTADO.md'), 'utf8')).toContain('Consulta vacía');
  expect(existsSync(join(state.directory, 'running.lock'))).toBe(false);
});

test('pending decisions and a failing baseline stop before any agent', async () => {
  const first = fixture();
  first.state.spec.decisions = ['Elegir comportamiento'];
  await executeWorkflow(first.state, false, first.stages);
  expect(first.state.status).toBe('blocked');
  expect(first.calls).toEqual([]);
  const second = fixture();
  const verify = second.stages.verify;
  second.stages.verify = async (...args) => ({ ...(await verify(...args)), passed: false });
  await executeWorkflow(second.state, false, second.stages);
  expect(second.state.status).toBe('failed');
  expect(second.calls).toEqual(['verify']);
});

test('plan approval survives refusal and resumes without repeating research', async () => {
  const { state, stages, calls } = fixture();
  state.approval = true;
  await executeWorkflow(state, false, stages);
  expect(state.status).toBe('waiting-plan');
  const saved = readFileSync(join(state.directory, 'state.json'), 'utf8');
  await expect(executeWorkflow(state, false, stages)).rejects.toThrow('approve-plan');
  expect(readFileSync(join(state.directory, 'state.json'), 'utf8')).toBe(saved);
  expect(existsSync(join(state.directory, 'running.lock'))).toBe(false);
  calls.length = 0;
  await executeWorkflow(load(state.directory), true, stages);
  expect(calls).toEqual(['implement', 'verify', 'review', 'qa', 'deliver']);
});

test('deterministic failure feeds the next attempt; exhausted attempts never reach review', async () => {
  const { state, stages, inputs, calls } = fixture();
  const verify = stages.verify;
  let checks = 0;
  stages.verify = async (...args) => ({ ...(await verify(...args)), passed: ++checks !== 2 });
  await executeWorkflow(state, false, stages);
  expect(inputs.map(({ feedback }) => feedback)).toEqual(['', 'lint: incorrect imports']);
  expect(state.attempts['implementation-1']).toBe(2);
  expect(state.status).toBe('completed');
  expect(calls.filter((call) => call === 'review')).toHaveLength(1);
  const exhausted = fixture();
  const baseline = exhausted.stages.verify;
  exhausted.stages.verify = async (...args) => ({
    ...(await baseline(...args)),
    passed: args[1].endsWith('baseline'),
  });
  await executeWorkflow(exhausted.state, false, exhausted.stages);
  expect(exhausted.state.status).toBe('exhausted');
  expect(exhausted.inputs).toHaveLength(2);
  expect(exhausted.calls).not.toContain('review');
  await expect(executeWorkflow(exhausted.state, false, exhausted.stages)).rejects.toThrow(
    'Cannot resume',
  );
  expect(exhausted.state.status).toBe('exhausted');
});

test('Ralph verifies each initial task, then corrects review feedback as one assignment', async () => {
  const { state, stages, inputs, calls } = fixture();
  state.mode = 'ralph';
  const review = stages.review;
  let reviews = 0;
  stages.review = async (...args) => ({
    ...(await review(...args)),
    findings:
      ++reviews === 1 ? [{ path: 'example.ts', problem: 'Foco perdido', criterion: 'AC1' }] : [],
  });
  await executeWorkflow(state, false, stages);
  expect(inputs.map(({ id }) => id)).toEqual(['keyboard', 'focus', 'implementation-2']);
  expect(inputs[1]?.completed).toEqual(['keyboard']);
  expect(inputs[2]?.feedback).toContain('Foco perdido');
  expect(calls.filter((call) => call === 'verify')).toHaveLength(4);
  expect(calls.filter((call) => call === 'qa')).toHaveLength(1);
  expect(state.status).toBe('completed');
});

test('QA failures return evidence to implementation and stop at the round limit', async () => {
  const { state, stages, inputs, calls } = fixture();
  const qa = stages.qa;
  stages.qa = async (...args) => ({
    ...(await qa(...args)),
    passed: false,
    results: [
      { id: 'AC1', status: 'fail', observed: 'Escape no borra', evidence: ['screen-01.png'] },
    ],
  });
  await executeWorkflow(state, false, stages);
  expect(state.status).toBe('exhausted');
  expect(inputs).toHaveLength(2);
  expect(inputs[1]?.feedback).toContain('Escape no borra');
  expect(calls).not.toContain('deliver');
});

test('a blocked worker stops without retries; a reviewer cannot invalidate the frozen patch', async () => {
  const blocked = fixture();
  const implement = blocked.stages.implement;
  blocked.stages.implement = async (...args) => ({
    ...(await implement(...args)),
    status: 'blocked',
    blockers: ['Permiso pendiente'],
  });
  await executeWorkflow(blocked.state, false, blocked.stages);
  expect(blocked.state.status).toBe('blocked');
  expect(blocked.inputs).toHaveLength(1);
  expect(blocked.calls).not.toContain('review');
  const changed = fixture();
  const review = changed.stages.review;
  changed.stages.review = async (...args) => {
    writeFileSync(
      join(changed.state.workspace, 'apps/web/src/example.ts'),
      'export const value = 99;\n',
    );
    return review(...args);
  };
  await expect(executeWorkflow(changed.state, false, changed.stages)).rejects.toThrow(
    'stale evidence',
  );
  expect(changed.state.status).toBe('failed');
  expect(changed.calls).not.toContain('qa');
  expect(existsSync(join(changed.state.directory, 'running.lock'))).toBe(false);
});

test('implementer timeout preserves work and consumes a bounded retry before independent checks', async () => {
  const { state, stages, inputs, calls } = fixture();
  const implement = stages.implement;
  stages.implement = async (...args) => {
    const result = await implement(...args);
    const file = join(state.workspace, 'apps/web/src/example.ts');
    if (inputs.length === 1) {
      writeFileSync(file, 'export const value = 2;\n');
      throw new ProcessTimeoutError('codex', join(args[1].output, 'agent.log'));
    }
    expect(readFileSync(file, 'utf8')).toContain('value = 2');
    return result;
  };
  await executeWorkflow(state, false, stages);
  expect(state.status).toBe('completed');
  expect(state.attempts['implementation-1']).toBe(2);
  expect(inputs[1]?.feedback).toContain('partial changes remain');
  expect(calls).toEqual([
    'verify',
    'research',
    'plan',
    'implement',
    'implement',
    'verify',
    'review',
    'qa',
    'deliver',
  ]);
});

test('repeated timeouts exhaust the existing budget without review or delivery', async () => {
  const { state, stages, inputs, calls } = fixture();
  const implement = stages.implement;
  stages.implement = async (...args) => {
    await implement(...args);
    throw new ProcessTimeoutError('codex', join(args[1].output, 'agent.log'));
  };
  await executeWorkflow(state, false, stages);
  expect(state.status).toBe('exhausted');
  expect(inputs).toHaveLength(2);
  expect(calls.filter((call) => call === 'verify')).toHaveLength(1);
  expect(calls).not.toContain('deliver');
  expect(
    readFileSync(join(state.directory, 'round-1/implementation-1-2/feedback.md'), 'utf8'),
  ).toContain('timeout');
});

test('worker errors other than timeouts still fail immediately', async () => {
  const { state, stages, calls } = fixture();
  stages.implement = async () => {
    throw new Error('Invalid worker result');
  };
  await expect(executeWorkflow(state, false, stages)).rejects.toThrow('Invalid worker result');
  expect(state.status).toBe('failed');
  expect(state.attempts['implementation-1']).toBe(1);
  expect(calls).not.toContain('review');
});
