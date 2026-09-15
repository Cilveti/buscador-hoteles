import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config';
import { api, number, object, parseTask, readTask, repoPath, string } from './github';
import { git, validateIndex } from './policy';
import { hash } from './state';

const temp = process.env.RUNNER_TEMP ?? '/tmp';
const task = parseTask(JSON.parse(readFileSync(join(temp, 'task/task.json'), 'utf8')));
const run = string(process.env.GITHUB_RUN_ID);
const live = readTask(task.issue)?.task;
if (
  live?.status !== 'running' ||
  live.activeRun !== run ||
  live.specificationSha !== task.specificationSha
)
  throw new Error('Publication authority revoked or stale');
if (git(process.cwd(), 'rev-parse', 'HEAD') !== task.baseSha)
  throw new Error('Publication base mismatch');
validateIndex(process.cwd(), task.profile, config.limits.patchBytes);
const patch = execFileSync('git', ['diff', '--cached', '--binary', '--full-index']);
if (hash(patch) !== process.env.PATCH_SHA) throw new Error('Publication patch was not verified');
const branch = `factory/issue-${task.issue}/attempt-${task.attempts}-${run}`;
git(process.cwd(), 'switch', '-c', branch);
git(process.cwd(), 'config', 'user.name', 'github-actions[bot]');
git(process.cwd(), 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git(
  process.cwd(),
  '-c',
  'core.hooksPath=/dev/null',
  'commit',
  '-m',
  `Factory: issue #${task.issue}, attempt ${task.attempts}`,
);
execFileSync('gh', ['auth', 'setup-git'], { stdio: 'pipe' });
git(process.cwd(), 'push', 'origin', branch);
const sha = git(process.cwd(), 'rev-parse', 'HEAD');
const runUrl = `https://github.com/${config.repository}/actions/runs/${run}`;
const pr = object(
  api(repoPath('pulls'), 'POST', {
    title: `Factory: ${task.specification.title}`.slice(0, 240),
    head: branch,
    base: config.baseBranch,
    draft: true,
    body: `Related to #${task.issue}.\n\nAttempt **${task.attempts}/${config.limits.attempts}**, profile **${task.profile}**.\n\nIndependent application checks and model review passed. **SonarQube quality gate is pending.** This draft is not approval to merge.\n\n[Evidence](${runUrl})\n\n- Base: \`${task.baseSha}\`\n- Specification: \`${task.specificationSha}\`\n- Verified patch: \`${process.env.PATCH_SHA}\`\n\nNo merge or deployment was performed.`,
  }),
);
for (const [context, state, description] of [
  ['Factory / acceptance', 'success', 'Isolated unit, E2E, build and model review passed'],
  ['Factory / quality', 'pending', 'Waiting for SonarQube'],
] as const)
  api(repoPath(`statuses/${sha}`), 'POST', { context, state, description, target_url: runUrl });
appendFileSync(
  string(process.env.GITHUB_OUTPUT),
  `pr=${number(pr.number)}\npr_url=${string(pr.html_url)}\nhead_sha=${sha}\nbranch=${branch}\n`,
);
