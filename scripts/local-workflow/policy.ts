import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from '../coding-eval/workspace';
import type { WorkflowState } from './run-state';

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
  const patch = git(state.workspace, ['diff', '--cached', '--binary', '--full-index', state.base], {
    trimOutput: false,
  });
  if (Buffer.byteLength(patch) > 200_000) throw new Error('Patch exceeds 200KB');
  return patch;
}
/** Validate the delivered bytes against a clean index at the frozen base, not the edited worktree. */
export function assertPatchApplies(
  state: Pick<WorkflowState, 'workspace' | 'base'>,
  patch: string,
) {
  // A no-op candidate is syntactically applicable; acceptance/review decide if it satisfies the task.
  if (!patch) return;
  const folder = mkdtempSync(join(tmpdir(), 'workflow-patch-check-'));
  const env = { ...process.env, GIT_INDEX_FILE: join(folder, 'index') };
  try {
    execFileSync('git', ['read-tree', state.base], {
      cwd: state.workspace,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    execFileSync('git', ['apply', '--cached', '--check', '-'], {
      cwd: state.workspace,
      env,
      input: patch,
      maxBuffer: 2_000_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw new Error(`Delivered patch does not apply to the frozen base: ${String(error)}`);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function assertCandidateUnchanged(state: WorkflowState, expected: string): void {
  if (digest(candidatePatch(state)) !== expected)
    throw new Error('Verification/review changed the candidate; refusing stale evidence');
}
