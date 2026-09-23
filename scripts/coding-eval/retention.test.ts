import { afterEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluationRun } from '../workflow-observer/evaluation';
import { compactEvaluation } from './retention';
import { createWorktree, git, saveJson } from './workspace';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'eval-retention-')));
  roots.push(root);
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@localhost']);
  git(root, ['config', 'user.name', 'Test']);
  writeFileSync(join(root, 'file.txt'), 'source');
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'baseline']);
  const commit = git(root, ['rev-parse', 'HEAD']);
  const campaign = join(root, '.agent-evals', 'campaign');
  const run = join(campaign, 'runs', '001');
  mkdirSync(run, { recursive: true });
  saveJson(join(campaign, 'manifest.json'), { status: 'completed', baselineCommit: commit });
  saveJson(join(run, 'result.json'), {
    status: 'evaluated',
    deliveredCommit: commit,
    score: 8,
    process: { compactions: { count: null, observedCount: 0, coverage: 'partial' } },
  });
  return { root, campaign, run, commit };
}
test('removes finished worktrees and bulk copies, preserves immutable results, prompts and metrics', () => {
  const { root, campaign, run, commit } = fixture();
  const candidate = join(run, 'candidate');
  createWorktree(root, candidate, commit);
  createWorktree(root, join(campaign, 'baseline/worktree'), commit);
  const other = join(root, 'daily-worktree');
  createWorktree(root, other, commit);
  mkdirSync(join(run, 'judge-input'), { recursive: true });
  writeFileSync(join(run, 'judge-input', 'files.txt'), 'temporary');
  mkdirSync(join(run, 'candidate-session'));
  writeFileSync(
    join(run, 'candidate-session', 'events.jsonl'),
    [
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: 'Evidence kept' },
      }),
      JSON.stringify({ type: 'item.completed', item: { type: 'reasoning', text: 'private' } }),
    ].join('\n'),
  );
  writeFileSync(join(run, 'candidate-session', 'compactions.json'), 'summary');
  writeFileSync(join(run, 'candidate-session', 'collaboration.json'), 'summary');
  writeFileSync(join(run, 'candidate-session', 'final.txt'), 'delivered');
  writeFileSync(join(run, 'candidate.patch'), 'patch');
  const before = readFileSync(join(run, 'result.json'), 'utf8');
  expect(compactEvaluation(root, campaign).errors).toEqual([]);
  expect(existsSync(candidate)).toBe(false);
  expect(existsSync(join(run, 'judge-input'))).toBe(false);
  expect(git(root, ['worktree', 'list'])).not.toContain('/candidate');
  expect(existsSync(other)).toBe(true);
  expect(readFileSync(join(run, 'result.json'), 'utf8')).toBe(before);
  expect(readFileSync(join(run, 'candidate.patch'), 'utf8')).toBe('patch');
  expect(existsSync(join(run, 'candidate-session', 'compactions.json'))).toBe(true);
  expect(readFileSync(join(run, 'trace-archive/candidate.projected.jsonl'), 'utf8')).toContain(
    'Evidence kept',
  );
  expect(readFileSync(join(run, 'trace-archive/candidate.projected.jsonl'), 'utf8')).not.toContain(
    'private',
  );
  expect(evaluationRun('campaign', '001', run).agents[0]?.traceAvailable).toBe(true);
  expect(existsSync(join(run, 'candidate-session', 'collaboration.json'))).toBe(true);
  expect(git(root, ['for-each-ref', '--format=%(objectname)', 'refs/coding-evals'])).toContain(
    commit,
  );
  expect(compactEvaluation(root, campaign).removed).toEqual([]);
});
test('refuses active campaigns, external roots and linked directories', () => {
  const { root, campaign, run } = fixture();
  saveJson(join(campaign, 'manifest.json'), { status: 'running' });
  expect(() => compactEvaluation(root, campaign)).toThrow('active');
  expect(() => compactEvaluation(root, root)).toThrow('inside');
  const link = join(root, '.agent-evals', 'linked');
  symlinkSync(run, link, 'dir');
  expect(() => compactEvaluation(root, link)).toThrow('symlink');
});
test('never removes the worktree of an active run in a completed campaign', () => {
  const { root, campaign, run, commit } = fixture();
  saveJson(join(run, 'result.json'), { status: 'running' });
  createWorktree(root, join(run, 'candidate'), commit);
  expect(() => compactEvaluation(root, campaign)).toThrow('active');
  expect(existsSync(join(run, 'candidate'))).toBe(true);
});
