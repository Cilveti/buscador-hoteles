import { execFileSync } from 'node:child_process';
import { config } from './config';
import type { Task } from './state';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected JSON object');
  return value as Record<string, unknown>;
}

export function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected string');
  return value;
}

export function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new Error('Expected positive integer');
  return value;
}

/** Structured stdin keeps task bodies, comments and tokens out of shell interpolation. */
export function api(path: string, method = 'GET', body?: unknown): unknown {
  const args = ['api', path, '--method', method];
  if (body !== undefined) args.push('--input', '-');
  const raw = execFileSync('gh', args, {
    encoding: 'utf8',
    input: body === undefined ? undefined : JSON.stringify(body),
    maxBuffer: 8_000_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return raw.trim() ? JSON.parse(raw) : null;
}

export const repoPath = (suffix: string) => `repos/${config.repository}/${suffix}`;

export function comment(issue: number, body: string): void {
  api(repoPath(`issues/${issue}/comments`), 'POST', { body });
}

export function parseTask(value: unknown): Task {
  const item = object(value);
  const specification = object(item.specification);
  if (item.schemaVersion !== 1 || !['basic', 'full'].includes(string(item.profile)))
    throw new Error('Invalid state schema');
  if (
    !/^[a-f0-9]{40}$/.test(string(item.baseSha)) ||
    !/^[a-f0-9]{64}$/.test(string(item.specificationSha))
  )
    throw new Error('Invalid state hashes');
  number(item.issue);
  for (const key of ['title', 'body', 'author']) string(specification[key]);
  if (
    typeof item.attempts !== 'number' ||
    !Number.isInteger(item.attempts) ||
    item.attempts < 0 ||
    item.attempts > config.limits.attempts
  )
    throw new Error('Invalid attempt count');
  if (
    ![
      'ready',
      'running',
      'publishing',
      'retry',
      'waiting-human',
      'review',
      'rejected',
      'cancelled',
      'exhausted',
      'failed',
    ].includes(string(item.status)) ||
    !Array.isArray(item.history)
  )
    throw new Error('Invalid state');
  // State lives on the controller-owned branch; validate authority-bearing optional fields too.
  if (item.decision) {
    const decision = object(item.decision);
    for (const key of ['id', 'reason', 'specificationSha']) string(decision[key]);
    if (!['basic', 'full'].includes(string(decision.requestedProfile)))
      throw new Error('Invalid requested profile');
  }
  if (item.activeRun !== undefined && !/^\d+$/.test(string(item.activeRun)))
    throw new Error('Invalid run');
  if (item.proposal) {
    const proposal = object(item.proposal);
    if (!/^\d+$/.test(string(proposal.run)) || !/^[a-f0-9]{64}$/.test(string(proposal.sha)))
      throw new Error('Invalid proposal provenance');
    string(proposal.artifact);
  }
  if (item.feedback) {
    const feedback = object(item.feedback);
    if (!/^\d+$/.test(string(feedback.run))) throw new Error('Invalid feedback provenance');
    string(feedback.artifact);
  }
  if (item.design) {
    const design = object(item.design);
    if (
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(string(design.id)) ||
      !/^[a-f0-9]{64}$/.test(string(design.manifestSha))
    )
      throw new Error('Invalid design provenance');
  }
  return item as Task;
}

/** Durable state branch, separate from the candidate and from operator-visible labels. */
export function readTask(issue: number): { task: Task; sha: string } | null {
  try {
    const file = object(api(repoPath(`contents/tasks/${issue}.json?ref=factory-state`)));
    return {
      task: parseTask(JSON.parse(Buffer.from(string(file.content), 'base64').toString())),
      sha: string(file.sha),
    };
  } catch (error) {
    if (error instanceof Error && 'stderr' in error && String(error.stderr).includes('404'))
      return null;
    throw error;
  }
}

export function writeTask(task: Task, previousSha?: string): void {
  api(repoPath(`contents/tasks/${task.issue}.json`), 'PUT', {
    branch: 'factory-state',
    message: `Factory #${task.issue}: ${task.status} (attempt ${task.attempts})`,
    content: Buffer.from(JSON.stringify(task, null, 2)).toString('base64'),
    ...(previousSha ? { sha: previousSha } : {}),
  });
}

export function dispatch(issue: number, predecessor: string): void {
  api(repoPath('actions/workflows/factory.yml/dispatches'), 'POST', {
    ref: process.env.GITHUB_REF_NAME ?? config.baseBranch,
    inputs: { issue: String(issue), predecessor },
  });
}
