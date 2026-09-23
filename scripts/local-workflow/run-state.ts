import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { createWorktree, git, linkDependencies, snapshot } from '../coding-eval/workspace';
import { type AgentAssignments, assignmentsSchema, validateAgents } from './agents';
import { planSchema, type Specification, specSchema } from './contracts';
import { digest } from './policy';

const stateSchema = z.object({
  id: z.string(),
  project: z.string(),
  directory: z.string(),
  workspace: z.string(),
  base: z.string(),
  mode: z.enum(['normal', 'ralph']),
  agents: assignmentsSchema.optional(),
  status: z.enum([
    'research',
    'planning',
    'waiting-plan',
    'implementing',
    'verifying',
    'reviewing',
    'qa',
    'completed',
    'blocked',
    'failed',
    'exhausted',
  ]),
  spec: specSchema,
  plan: planSchema.nullable(),
  approval: z.boolean(),
  completedTasks: z.array(z.string()),
  attempts: z.record(z.string(), z.number()),
  round: z.number(),
  maxRounds: z.number(),
  maxTaskAttempts: z.number(),
  headed: z.boolean(),
  evaluation: z
    .object({ permissionArgs: z.array(z.string()), browserEndpoint: z.string() })
    .optional(),
  message: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorkflowState = z.infer<typeof stateSchema>;

export function save(state: WorkflowState): void {
  state.updatedAt = new Date().toISOString();
  writeFileSync(join(state.directory, 'state.json'), JSON.stringify(state, null, 2));
  writeFileSync(
    join(state.directory, 'progress.md'),
    `# ${state.spec.title}\n\nEstado: **${state.status}** · ${state.mode}\n\n${state.message}\n\n` +
      (state.plan?.tasks ?? [])
        .map(
          (task) =>
            `- [${state.completedTasks.includes(task.id) ? 'x' : ' '}] ${task.id}: ${task.title}`,
        )
        .join('\n') +
      '\n',
  );
}
export function load(directory: string): WorkflowState {
  const state = stateSchema.parse(JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8')));
  if (resolve(state.directory) !== resolve(directory))
    throw new Error('Run directory differs from recorded state');
  return state;
}
export function phase(
  state: WorkflowState,
  status: WorkflowState['status'],
  message: string,
): void {
  appendFileSync(
    join(state.directory, 'events.jsonl'),
    `${JSON.stringify({ at: new Date().toISOString(), status, message })}\n`,
  );
  state.status = status;
  state.message = message;
  save(state);
  console.log(`${status}: ${message}`);
}

export function createRun(
  project: string,
  spec: Specification,
  options: {
    mode: 'normal' | 'ralph';
    agents: AgentAssignments;
    planReview: boolean;
    headed: boolean;
    maxRounds: number;
    maxTaskAttempts: number;
  },
): WorkflowState {
  validateAgents(options.agents);
  if (!existsSync(join(project, 'node_modules')))
    throw new Error('Install project dependencies first: bun install --frozen-lockfile');
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${spec.id}-${options.mode}`;
  const directory = resolve(project, '.tmp/local-workflows', id);
  mkdirSync(directory, { recursive: true });
  const base = snapshot(project, directory);
  const workspace = resolve(realpathSync(tmpdir()), `hoteles-workflow-${id}`);
  createWorktree(project, workspace, base);
  linkDependencies(project, workspace);
  const state: WorkflowState = {
    id,
    project,
    directory,
    workspace,
    base,
    mode: options.mode,
    agents: structuredClone(options.agents),
    status: 'research',
    spec,
    plan: null,
    approval: options.planReview,
    completedTasks: [],
    attempts: {},
    round: 0,
    maxRounds: options.maxRounds,
    maxTaskAttempts: options.maxTaskAttempts,
    headed: options.headed,
    message: 'Snapshot aislado; no modifica tu checkout ni publica cambios.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(join(directory, 'spec.json'), JSON.stringify(spec, null, 2));
  save(state);
  return state;
}

/** Reuse the coding-eval candidate tree; its private sandbox and browser lease outlive every phase. */
export function createEvaluationRun(
  workspace: string,
  directory: string,
  spec: Specification,
  agents: AgentAssignments,
  evaluation: { permissionArgs: string[]; browserEndpoint: string },
): WorkflowState {
  validateAgents(agents);
  mkdirSync(directory, { recursive: true });
  const now = new Date().toISOString();
  const state: WorkflowState = {
    id: `${spec.id}-${now.replace(/[:.]/g, '-')}`,
    project: workspace,
    directory,
    workspace,
    base: git(workspace, ['rev-parse', 'HEAD']),
    mode: 'normal',
    agents: structuredClone(agents),
    status: 'research',
    spec,
    plan: null,
    approval: false,
    completedTasks: [],
    attempts: {},
    round: 0,
    maxRounds: 2,
    maxTaskAttempts: 2,
    headed: false,
    evaluation,
    message: 'Evaluación aislada del workflow completo.',
    createdAt: now,
    updatedAt: now,
  };
  writeFileSync(join(directory, 'spec.json'), JSON.stringify(spec, null, 2));
  save(state);
  return state;
}

/** A rejected resume must not overwrite the saved status or its attempt counters. */
export function approveSavedPlan(state: WorkflowState, approvePlan: boolean): void {
  if (state.status === 'research') return;
  if (state.status !== 'waiting-plan')
    throw new Error(
      `Cannot resume ${state.status}; inspect the existing run rather than resetting its budget`,
    );
  if (!approvePlan)
    throw new Error('Use resume <run> --approve-plan to approve this concrete plan');
  appendFileSync(
    join(state.directory, 'events.jsonl'),
    `${JSON.stringify({ at: new Date().toISOString(), event: 'plan-approved', actor: 'local-operator', source: 'resume --approve-plan', planSha: digest(JSON.stringify(state.plan)) })}\n`,
  );
  state.approval = false;
  save(state);
}

export async function withRunLock<T>(state: WorkflowState, run: () => Promise<T>): Promise<T> {
  const path = join(state.directory, 'running.lock');
  const descriptor = openSync(path, 'wx', 0o600);
  try {
    writeFileSync(descriptor, String(process.pid));
    return await run();
  } finally {
    closeSync(descriptor);
    unlinkSync(path);
  }
}
