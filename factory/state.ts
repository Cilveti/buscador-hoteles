import { createHash, randomUUID } from 'node:crypto';

export type Profile = 'basic' | 'full';
export type TaskStatus =
  | 'ready'
  | 'running'
  | 'publishing'
  | 'retry'
  | 'waiting-human'
  | 'review'
  | 'rejected'
  | 'cancelled'
  | 'exhausted'
  | 'failed';

export type Task = {
  schemaVersion: 1;
  issue: number;
  baseSha: string;
  specification: { title: string; body: string; author: string };
  specificationSha: string;
  profile: Profile;
  status: TaskStatus;
  attempts: number;
  activeRun?: string;
  design?: { id: string; manifestSha: string };
  proposal?: { run: string; artifact: string; sha: string };
  feedback?: { run: string; artifact: string };
  decision?: { id: string; reason: string; requestedProfile: Profile; specificationSha: string };
  history: { at: string; event: string; actor: string; detail: string }[];
};

export const hash = (content: string | Buffer) =>
  createHash('sha256').update(content).digest('hex');

export function createTask(input: {
  issue: number;
  baseSha: string;
  title: string;
  body: string;
  author: string;
  profile: Profile;
  actor: string;
}): Task {
  const specification = { title: input.title, body: input.body, author: input.author };
  return {
    schemaVersion: 1,
    issue: input.issue,
    baseSha: input.baseSha,
    specification,
    specificationSha: hash(JSON.stringify(specification)),
    profile: input.profile,
    status: 'ready',
    attempts: 0,
    history: [entry('admitted', input.actor, `profile=${input.profile}; base=${input.baseSha}`)],
  };
}

function entry(event: string, actor: string, detail: string) {
  return { at: new Date().toISOString(), event, actor, detail };
}

/** Reserve the attempt before inference. Duplicate deliveries cannot consume another attempt. */
export function startAttempt(task: Task, run: string, max: number): Task {
  if (!['ready', 'retry'].includes(task.status))
    throw new Error(`Cannot start from ${task.status}`);
  if (task.attempts >= max) throw new Error('Attempt budget exhausted');
  return {
    ...task,
    status: 'running',
    attempts: task.attempts + 1,
    activeRun: run,
    history: [
      ...task.history,
      entry('started', 'controller', `attempt=${task.attempts + 1}; run=${run}`),
    ],
  };
}

export function finishAttempt(
  task: Task,
  run: string,
  result:
    | { status: 'passed' | 'retry' | 'failed'; detail: string }
    | { status: 'needs-human'; detail: string; requestedProfile: Profile },
  max: number,
): Task {
  // A cancellation/decision in another event always wins over a late model response.
  if (!['running', 'publishing'].includes(task.status) || task.activeRun !== run)
    throw new Error('Stale completion');
  const status: TaskStatus =
    result.status === 'needs-human'
      ? 'waiting-human'
      : result.status === 'passed'
        ? 'review'
        : result.status === 'retry'
          ? task.attempts < max
            ? 'retry'
            : 'exhausted'
          : 'failed';
  const next: Task = {
    ...task,
    status,
    history: [...task.history, entry(status, 'controller', result.detail)],
  };
  if (result.status === 'needs-human') {
    next.decision = {
      id: randomUUID(),
      reason: result.detail,
      requestedProfile: result.requestedProfile,
      specificationSha: task.specificationSha,
    };
  }
  return next;
}

/** Caller must authenticate actor; the decision binds this request to the frozen specification. */
export function decide(
  task: Task,
  input: { id: string; approve: boolean; actor: string; commentId: string },
  operators: readonly string[],
  max: number,
): Task {
  if (!operators.includes(input.actor)) throw new Error('Unauthorized decision actor');
  if (task.status !== 'waiting-human' || task.decision?.id !== input.id)
    throw new Error('Decision is absent, stale or already consumed');
  if (task.decision.specificationSha !== task.specificationSha)
    throw new Error('Decision does not match the frozen specification');
  const status = input.approve ? (task.attempts < max ? 'ready' : 'exhausted') : 'rejected';
  const next: Task = {
    ...task,
    profile: input.approve ? task.decision.requestedProfile : task.profile,
    status,
    history: [
      ...task.history,
      entry(
        input.approve ? 'approved' : 'rejected',
        input.actor,
        `${input.id}; comment=${input.commentId}`,
      ),
    ],
  };
  delete next.decision;
  return next;
}

export function cancel(task: Task, actor: string, operators: readonly string[]): Task {
  if (!operators.includes(actor)) throw new Error('Unauthorized cancellation actor');
  if (['publishing', 'review', 'rejected', 'cancelled'].includes(task.status))
    throw new Error('Task is terminal or publication has already been reserved; inspect its draft');
  return {
    ...task,
    status: 'cancelled',
    history: [...task.history, entry('cancelled', actor, 'Operator stopped the task')],
  };
}

/** Caller verifies the old run is completed and has never published a candidate branch. */
export function recover(
  task: Task,
  previousRun: string,
  actor: string,
  operators: readonly string[],
  max: number,
): Task {
  if (!operators.includes(actor)) throw new Error('Unauthorized recovery actor');
  if (
    !['running', 'publishing', 'failed', 'retry'].includes(task.status) ||
    task.activeRun !== previousRun
  )
    throw new Error('Recovery does not match a recoverable run');
  if (task.attempts >= max) throw new Error('Recovery cannot reset the attempt budget');
  return {
    ...task,
    status: 'ready',
    history: [...task.history, entry('recovered', actor, `completed run=${previousRun}`)],
  };
}

/** Persist with compare-and-swap before writing a branch. Cancellation and reservation race once. */
export function reservePublication(task: Task, run: string): Task {
  if (task.status !== 'running' || task.activeRun !== run)
    throw new Error('Publication authority revoked or stale');
  return {
    ...task,
    status: 'publishing',
    history: [...task.history, entry('publishing', 'controller', `run=${run}`)],
  };
}
