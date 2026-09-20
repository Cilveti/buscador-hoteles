import { createHash } from 'node:crypto';
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
import { runVerification } from '../verification/verify';
import { callAgent } from './agents';
import {
  implementationSchema,
  planSchema,
  researchSchema,
  reviewSchema,
  type Specification,
  specSchema,
  validatePlan,
} from './contracts';
import { availablePort, runQa } from './qa';

const stateSchema = z.object({
  id: z.string(),
  project: z.string(),
  directory: z.string(),
  workspace: z.string(),
  base: z.string(),
  mode: z.enum(['normal', 'ralph']),
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
function phase(state: WorkflowState, status: WorkflowState['status'], message: string): void {
  appendFileSync(
    join(state.directory, 'events.jsonl'),
    `${JSON.stringify({ at: new Date().toISOString(), status, message })}\n`,
  );
  state.status = status;
  state.message = message;
  save(state);
  console.log(`${status}: ${message}`);
}

/** Scope policy is applied outside the model, before running candidate code or accepting a result. */
export function allowedChange(path: string, status: string): boolean {
  if (!['A', 'M'].includes(status)) return false;
  if (/(?:^|\/)(?:package\.json|[^/]*config[^/]*|\.env[^/]*|AGENTS\.md|CLAUDE\.md)$/.test(path))
    return false;
  if (/^(apps\/web\/src|packages\/(core|contracts|adapters)\/src)\/.*\.(?:tsx?|css)$/.test(path))
    return true;
  return status === 'A' && /^tests\/browser\/[a-z0-9-]+\.spec\.ts$/.test(path);
}

export function candidatePatch(state: Pick<WorkflowState, 'workspace' | 'base'>): string {
  if (git(state.workspace, ['rev-parse', 'HEAD']) !== state.base)
    throw new Error('Worker changed the frozen Git base');
  git(state.workspace, ['add', '-A']);
  const changes = git(state.workspace, [
    'diff',
    '--cached',
    '--name-status',
    '--no-renames',
    '-z',
    state.base,
  ])
    .split('\0')
    .filter(Boolean);
  for (let i = 0; i < changes.length; i += 2) {
    const status = changes[i],
      path = changes[i + 1];
    if (!status || !path || !allowedChange(path, status))
      throw new Error(`Change outside task permissions: ${status} ${path}`);
  }
  const modes = git(state.workspace, ['diff', '--cached', '--raw', '--no-renames', state.base]);
  if (modes.split('\n').some((line) => line && !/^:(?:100644|000000) 100644 /.test(line)))
    throw new Error('Only regular, non-executable source files may change');
  const patch = git(state.workspace, ['diff', '--cached', '--binary', '--full-index', state.base]);
  if (Buffer.byteLength(patch) > 200_000) throw new Error('Patch exceeds 200KB');
  return patch;
}
function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function stable(state: WorkflowState, expected: string): void {
  if (digest(candidatePatch(state)) !== expected)
    throw new Error('Verification/review changed the candidate; refusing stale evidence');
}

export function createRun(
  project: string,
  spec: Specification,
  options: {
    mode: 'normal' | 'ralph';
    planReview: boolean;
    headed: boolean;
    maxRounds: number;
    maxTaskAttempts: number;
  },
): WorkflowState {
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

const stringify = (value: unknown) => JSON.stringify(value, null, 2);
function common(state: WorkflowState): string {
  return (
    `SPECIFICATION (authoritative requirements):\n${stringify(state.spec)}\n` +
    `Read AGENTS.md and docs/architecture.md. This is an isolated candidate workspace. Workers may change product source and colocated tests, and ADD a new tests/browser/*.spec.ts file. Existing tests/browser files, scripts, configuration and dependencies are PROTECTED; never plan edits to those. The external controller executes checks; implementers have no shell. Phase instructions override the orchestration entrypoint: do not invoke abordar-tarea/grill-me/to-spec again.\n`
  );
}

async function prepare(state: WorkflowState): Promise<boolean> {
  if (state.spec.decisions.length) {
    phase(state, 'blocked', `Decisiones pendientes: ${state.spec.decisions.join('; ')}`);
    return false;
  }
  phase(state, 'verifying', 'Comprobación del entorno antes de llamar a los modelos');
  const baselineChecks = await verify(state, join(state.directory, 'baseline'));
  if (!baselineChecks.passed) {
    phase(
      state,
      'failed',
      'El snapshot base no pasa los checks. Revisa baseline/verification.json; no se ha llamado a los modelos.',
    );
    return false;
  }
  phase(state, 'research', 'Exploración del producto y de sus comprobaciones');
  // Two bounded researchers receive separate contexts and never write product files.
  const baseline = digest(candidatePatch(state));
  const research = await Promise.all([
    callAgent(
      {
        provider: 'claude',
        role: 'research-product',
        root: state.workspace,
        output: join(state.directory, 'research-product'),
        prompt:
          common(state) +
          'Read the affected product code. Find existing behavior, reusable patterns and exact files. Identify genuinely missing product decisions; do not treat already specified behavior or reversible implementation choices as blockers. Do not implement or plan unrelated work.',
      },
      researchSchema,
    ),
    callAgent(
      {
        provider: 'claude',
        role: 'research-verification',
        root: state.workspace,
        output: join(state.directory, 'research-verification'),
        prompt:
          common(state) +
          'Read relevant tests and browser fixtures. Identify how each requirement can be observed, coverage gaps and environment limits. Do not implement.',
      },
      researchSchema,
    ),
  ]);
  stable(state, baseline);
  phase(state, 'planning', 'Plan de implementación y subtareas');
  state.plan = await callAgent(
    {
      provider: 'claude',
      role: 'planner',
      root: state.workspace,
      output: join(state.directory, 'plan'),
      prompt:
        common(state) +
        `RESEARCH:\n${stringify(research)}\nCreate a concise implementable plan. Each subtask must be a small vertical increment that leaves checks passing. The criteria array contains ONLY exact IDs such as ["AC1","AC2"], never explanations. Cover every AC ID; do not invent IDs. Usually 1–3 subtasks; separate independently deliverable behaviors rather than code vs tests. Reconcile research doubts against the actual specification and code. Only identify a blocker if an unresolved product decision changes acceptance; choose reversible details yourself. Missing implementation is the purpose of this workflow, NEVER a blocker. Do not reconfirm behavior already stated in acceptance. No code edits.`,
    },
    planSchema,
  );
  stable(state, baseline);
  validatePlan(state.spec, state.plan);
  writeFileSync(
    join(state.directory, 'plan.md'),
    `# Plan\n\n${state.plan.summary}\n\n${state.plan.tasks.map((task) => `## ${task.id}: ${task.title}\n${task.instructions}\n\nCriterios: ${task.criteria.join(', ')}`).join('\n\n')}`,
  );
  if (state.plan.blockers.length) {
    phase(state, 'blocked', state.plan.blockers.join('\n'));
    return false;
  }
  if (state.approval) {
    phase(state, 'waiting-plan', 'Plan listo. Requiere resume --approve-plan.');
    return false;
  }
  save(state);
  return true;
}

async function verify(state: WorkflowState, output: string) {
  phase(state, 'verifying', 'Lint, tipos, tests y navegador sobre el cambio actual');
  const frozen = digest(candidatePatch(state));
  const port = await availablePort();
  const verification = await runVerification({
    root: state.workspace,
    output,
    browser: true,
    timeoutSeconds: 180,
    env: { TEST_BROWSER_PORT: String(port), TEST_BROWSER_OUTPUT: join(output, 'browser') },
  });
  stable(state, frozen);
  return verification;
}

async function implement(
  state: WorkflowState,
  instructions: string,
  key: string,
  feedback: string,
): Promise<boolean> {
  for (let attempt = (state.attempts[key] ?? 0) + 1; attempt <= state.maxTaskAttempts; attempt++) {
    state.attempts[key] = attempt;
    const output = join(state.directory, `round-${state.round}`, `${key}-${attempt}`);
    phase(
      state,
      'implementing',
      `${key} · intento ${attempt}/${state.maxTaskAttempts} · contexto nuevo`,
    );
    const result = await callAgent(
      {
        provider: 'claude',
        role: state.mode === 'ralph' ? 'ralph-implementer' : 'implementer',
        root: state.workspace,
        output: join(output, 'agent'),
        edit: true,
        prompt:
          common(state) +
          `APPROVED SCOPE / PLAN:\n${stringify(state.plan)}\nCURRENT ASSIGNMENT:\n${instructions}\n` +
          `PROGRESS:\n${stringify(state.completedTasks)}\nPREVIOUS FEEDBACK:\n${feedback}\n` +
          'Implement only the assigned work. First inspect the current files: a previous attempt may already have implemented part. Follow .agents/skills/hoteles-testing/SKILL.md and hoteles-hexagonal. You may edit product source and colocated tests, or ADD tests/browser/*.spec.ts; existing external checks/configuration are protected. No dependencies, scripts or changes outside these paths. You have no shell tools: the controller runs verification after your turn and returns actual logs on failure. Never claim you ran checks. For missing product decisions or permissions return blocked. Otherwise implement useful tests and report implemented. Ralph mode: ONE assigned subtask per session, preserve earlier completed work.',
      },
      implementationSchema,
    );
    candidatePatch(state);
    if (result.status === 'blocked' || result.blockers.length) {
      phase(state, 'blocked', `${result.summary}\n${result.blockers.join('\n')}`);
      return false;
    }
    const checks = await verify(state, join(output, 'verification'));
    if (checks.passed) return true;
    feedback = checks.checks
      .filter((check) => check.status !== 'passed')
      .map(
        (check) =>
          `${check.id}: ${check.status}\n${readFileSync(check.stdoutPath, 'utf8').slice(-12000)}\n${readFileSync(check.stderrPath, 'utf8').slice(-8000)}`,
      )
      .join('\n');
    writeFileSync(join(output, 'feedback.md'), feedback);
  }
  phase(
    state,
    'exhausted',
    `Agotados los intentos de ${key}. Revisa el feedback; no se amplía el límite automáticamente.`,
  );
  return false;
}

export async function executeWorkflow(
  state: WorkflowState,
  approvePlan = false,
): Promise<WorkflowState> {
  const lock = join(state.directory, 'running.lock');
  const fd = openSync(lock, 'wx', 0o600);
  writeFileSync(fd, String(process.pid));
  try {
    if (state.status === 'waiting-plan') {
      if (!approvePlan)
        throw new Error('Use resume <run> --approve-plan to approve this concrete plan');
      appendFileSync(
        join(state.directory, 'events.jsonl'),
        `${JSON.stringify({ at: new Date().toISOString(), event: 'plan-approved', actor: 'local-operator', source: 'resume --approve-plan', planSha: digest(JSON.stringify(state.plan)) })}\n`,
      );
      state.approval = false;
      save(state);
    } else if (state.status !== 'research')
      throw new Error(
        `Cannot resume ${state.status}; inspect the existing run rather than resetting its budget`,
      );
    if (!state.plan && !(await prepare(state))) return state;
    const plan = state.plan;
    if (!plan) throw new Error('Missing implementation plan');
    let feedback = '';
    for (state.round = 1; state.round <= state.maxRounds; state.round++) {
      const roundDir = join(state.directory, `round-${state.round}`);
      if (state.mode === 'ralph' && state.round === 1) {
        for (const task of plan.tasks) {
          if (!(await implement(state, task.instructions, task.id, feedback))) return state;
          state.completedTasks.push(task.id);
          save(state);
        }
      } else {
        if (
          !(await implement(
            state,
            state.round === 1
              ? 'Implement the complete plan.'
              : 'Fix the independent review / QA findings. Keep all acceptance criteria and the existing plan.',
            `implementation-${state.round}`,
            feedback,
          ))
        )
          return state;
        state.completedTasks = plan.tasks.map((task) => task.id);
        save(state);
      }
      const patch = candidatePatch(state),
        frozen = digest(patch);
      writeFileSync(join(roundDir, 'candidate.patch'), patch);
      phase(state, 'reviewing', 'Codex revisa el cambio frente a la especificación');
      const review = await callAgent(
        {
          provider: 'codex',
          role: 'adversarial-code-reviewer',
          root: state.workspace,
          output: join(roundDir, 'review'),
          prompt:
            common(state) +
            `Checks passed on SHA256 ${frozen}. Review the actual staged diff below against EVERY acceptance criterion and repository standards. You are independent of the implementer. Inspect related code if needed. Seek actionable bugs, weakened checks, missed cases and architecture issues; do not invent findings to be adversarial. No edits or new workflow. pass requires zero findings. An environment or product ambiguity is blocked, not pass.\nDIFF:\n${patch}`,
        },
        reviewSchema,
      );
      stable(state, frozen);
      if (review.status === 'blocked') {
        phase(state, 'blocked', review.summary);
        return state;
      }
      if (review.status !== 'pass' || review.findings.length) {
        feedback = stringify(review);
        continue;
      }
      phase(state, 'qa', 'Codex prueba la app con navegador y recoge evidencias por criterio');
      const qa = await runQa({
        root: state.workspace,
        output: join(roundDir, 'qa'),
        spec: state.spec,
        headed: state.headed,
      });
      stable(state, frozen);
      if (!qa.passed) {
        feedback = stringify(qa.results);
        continue;
      }
      writeFileSync(join(state.directory, 'candidate.patch'), patch);
      writeFileSync(
        join(state.directory, 'RESULTADO.md'),
        `# ${state.spec.title}\n\nWorkflow **${state.mode}** completado sobre el snapshot ${state.base}.\n\n## Resultado\n${review.summary}\n\n## Evidencias de producto\n` +
          qa.results
            .map(
              (result) =>
                `- **${result.id} — ${result.status}:** ${result.observed}\n${result.evidence.map((file) => `  - [${file}](round-${state.round}/qa/${file})`).join('\n')}`,
            )
            .join('\n') +
          `\n\n[Traza del navegador](round-${state.round}/qa/trace.zip) · [Patch](candidate.patch) · [Plan](plan.md)\n\nRevisión: Codex; implementación: Claude. Checks externos verdes sobre el mismo patch SHA256 ${frozen}.\n\nAlcance de QA: componentes React, handlers HTTP y core con catálogo sintético; no verifica Payload/PostgreSQL ni SSR. No ejecuta Sonar. No ha creado PR, commit del candidato, merge ni despliegue.\n\nWorkspace: ${state.workspace}\n`,
      );
      phase(
        state,
        'completed',
        'Checks, revisión independiente y QA superados. Cambio aislado listo para inspección.',
      );
      return state;
    }
    phase(state, 'exhausted', 'La revisión/QA no pasó dentro del límite de rondas.');
    return state;
  } catch (error) {
    phase(state, 'failed', error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    closeSync(fd);
    unlinkSync(lock);
  }
}
