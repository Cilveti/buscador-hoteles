import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config';
import { api, number, object, parseTask, readTask, repoPath, string, writeTask } from './github';
import { git, validateIndex } from './policy';
import { publicationEvidence, pullRequestBody } from './presentation';
import { hash, reservePublication } from './state';

const temp = process.env.RUNNER_TEMP ?? '/tmp';
const task = parseTask(JSON.parse(readFileSync(join(temp, 'task/task.json'), 'utf8')));
const run = string(process.env.GITHUB_RUN_ID);
const state = readTask(task.issue);
const live = state?.task;
if (
  live?.status !== 'running' ||
  live.activeRun !== run ||
  live.specificationSha !== task.specificationSha
)
  throw new Error('Publication authority revoked or stale');
if (git(process.cwd(), 'rev-parse', 'HEAD') !== task.baseSha)
  throw new Error('Publication base mismatch');
const paths = validateIndex(process.cwd(), task.profile, config.limits.patchBytes);
const patch = execFileSync('git', ['diff', '--cached', '--binary', '--full-index']);
if (hash(patch) !== process.env.PATCH_SHA) throw new Error('Publication patch was not verified');
const evidence = publicationEvidence(
  task,
  string(process.env.PATCH_SHA),
  JSON.parse(readFileSync(join(temp, 'proposal/proposal.json'), 'utf8')),
  JSON.parse(readFileSync(join(temp, 'review/feedback.json'), 'utf8')),
);
if (!state) throw new Error('Missing publication state');
writeTask(reservePublication(state.task, run), state.sha);
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
  `Resolver #${task.issue}: ${task.specification.title.slice(0, 100)}`,
);
execFileSync('gh', ['auth', 'setup-git'], { stdio: 'pipe' });
git(process.cwd(), 'push', 'origin', branch);
const sha = git(process.cwd(), 'rev-parse', 'HEAD');
const runUrl = `https://github.com/${config.repository}/actions/runs/${run}`;
const pr = object(
  api(repoPath('pulls'), 'POST', {
    title: task.specification.title.replace(/^\[Factory\]\s*/i, '').slice(0, 240),
    head: branch,
    base: config.baseBranch,
    draft: true,
    body: pullRequestBody({
      task,
      patchSha: string(process.env.PATCH_SHA),
      runUrl,
      paths,
      ...evidence,
    }),
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
