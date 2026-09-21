import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateAgents } from './agents';
import { validatePlan } from './contracts';
import { assertCandidateUnchanged, candidatePatch, digest } from './policy';
import { ProcessTimeoutError } from './process';
import { approveSavedPlan, phase, save, type WorkflowState, withRunLock } from './run-state';
import { localStages, type WorkflowStages } from './stages';

type Assignment = { id: string; instructions: string };

function assignmentsForRound(state: WorkflowState): Assignment[] {
  if (!state.plan) throw new Error('Missing implementation plan');
  if (state.mode === 'ralph' && state.round === 1) return state.plan.tasks;
  return [
    {
      id: `implementation-${state.round}`,
      instructions:
        state.round === 1
          ? 'Implement the complete plan.'
          : 'Fix the independent review / QA findings. Keep all acceptance criteria and the existing plan.',
    },
  ];
}

async function preparePlan(state: WorkflowState, stages: WorkflowStages): Promise<boolean> {
  if (state.spec.decisions.length) {
    phase(state, 'blocked', `Decisiones pendientes: ${state.spec.decisions.join('; ')}`);
    return false;
  }
  phase(state, 'verifying', 'Comprobación del entorno antes de llamar a los modelos');
  const baseline = await stages.verify(state, join(state.directory, 'baseline'));
  if (!baseline.passed) {
    phase(
      state,
      'failed',
      'El snapshot base no pasa los checks. Revisa baseline/verification.json; no se ha llamado a los modelos.',
    );
    return false;
  }
  const frozen = digest(candidatePatch(state));
  phase(state, 'research', 'Exploración del producto y de sus comprobaciones');
  const research = await stages.research(state);
  assertCandidateUnchanged(state, frozen);
  phase(state, 'planning', 'Plan de implementación y subtareas');
  state.plan = await stages.plan(state, research);
  assertCandidateUnchanged(state, frozen);
  validatePlan(state.spec, state.plan);
  stages.writePlan(state);
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

/** Retry failed checks or an expired implementer within the same persisted attempt budget. */
async function implementAndVerify(
  state: WorkflowState,
  task: Assignment,
  feedback: string,
  stages: WorkflowStages,
): Promise<boolean> {
  while ((state.attempts[task.id] ?? 0) < state.maxTaskAttempts) {
    const attempt = (state.attempts[task.id] ?? 0) + 1;
    state.attempts[task.id] = attempt;
    const output = join(state.directory, `round-${state.round}`, `${task.id}-${attempt}`);
    phase(
      state,
      'implementing',
      `${task.id} · intento ${attempt}/${state.maxTaskAttempts} · contexto nuevo`,
    );
    let result: Awaited<ReturnType<WorkflowStages['implement']>>;
    try {
      result = await stages.implement(state, { task, feedback, output, attempt });
    } catch (error) {
      if (!(error instanceof ProcessTimeoutError)) throw error;
      candidatePatch(state);
      feedback = [
        feedback,
        error.message,
        'The previous worker timed out without a final delivery. Its partial changes remain in this workspace.',
        `Inspect them and the logs in ${output}; finish the assignment and return the final structured result.`,
        'Reuse successful checks only if they cover the unchanged candidate; never assume timeout means success.',
      ]
        .filter(Boolean)
        .join('\n\n');
      writeFileSync(join(output, 'feedback.md'), feedback);
      continue;
    }
    candidatePatch(state);
    if (result.status === 'blocked' || result.blockers.length) {
      phase(state, 'blocked', `${result.summary}\n${result.blockers.join('\n')}`);
      return false;
    }
    phase(state, 'verifying', 'Lint, tipos, tests y navegador sobre el cambio actual');
    const checks = await stages.verify(state, join(output, 'verification'));
    if (checks.passed) return true;
    feedback = stages.checkFeedback(checks);
    writeFileSync(join(output, 'feedback.md'), feedback);
  }
  phase(
    state,
    'exhausted',
    `Agotados los intentos de ${task.id}. Revisa el feedback; no se amplía el límite automáticamente.`,
  );
  return false;
}

/** Review/QA feedback starts a correction round; Ralph splits only the initial implementation. */
async function runDeliveryLoop(state: WorkflowState, stages: WorkflowStages): Promise<void> {
  let feedback = '';
  for (state.round = 1; state.round <= state.maxRounds; state.round++) {
    for (const task of assignmentsForRound(state)) {
      if (!(await implementAndVerify(state, task, feedback, stages))) return;
      if (state.mode === 'ralph' && state.round === 1) state.completedTasks.push(task.id);
      else state.completedTasks = state.plan?.tasks.map(({ id }) => id) ?? [];
      save(state);
    }
    const roundDirectory = join(state.directory, `round-${state.round}`);
    const patch = candidatePatch(state);
    const frozen = digest(patch);
    writeFileSync(join(roundDirectory, 'candidate.patch'), patch);
    phase(state, 'reviewing', 'El revisor contrasta el cambio con la especificación');
    const review = await stages.review(state, patch, roundDirectory);
    assertCandidateUnchanged(state, frozen);
    if (review.status === 'blocked') {
      phase(state, 'blocked', review.summary);
      return;
    }
    if (review.status !== 'pass' || review.findings.length) {
      feedback = JSON.stringify(review, null, 2);
      continue;
    }
    phase(state, 'qa', 'El agente QA prueba la app y recoge evidencias por criterio');
    const qa = await stages.qa(state, roundDirectory);
    assertCandidateUnchanged(state, frozen);
    if (!qa.passed) {
      feedback = JSON.stringify(qa.results, null, 2);
      continue;
    }
    stages.deliver(state, patch, review, qa);
    phase(
      state,
      'completed',
      'Checks, revisión independiente y QA superados. Cambio aislado listo para inspección.',
    );
    return;
  }
  phase(state, 'exhausted', 'La revisión/QA no pasó dentro del límite de rondas.');
}

/** Entry point: validate/resume → prepare → delivery loop. Side effects live in the stages. */
export async function executeWorkflow(
  state: WorkflowState,
  approvePlan = false,
  stages: WorkflowStages = localStages,
): Promise<WorkflowState> {
  validateAgents(state.agents);
  return withRunLock(state, async () => {
    approveSavedPlan(state, approvePlan);
    try {
      if (!state.plan && !(await preparePlan(state, stages))) return state;
      await runDeliveryLoop(state, stages);
      return state;
    } catch (error) {
      phase(state, 'failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  });
}
