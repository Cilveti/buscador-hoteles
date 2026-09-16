import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config';
import { api, number, object, parseTask, repoPath, string } from './github';
import { hash } from './state';

const temp = string(process.env.RUNNER_TEMP);
const output = (name: string, value: string) =>
  appendFileSync(string(process.env.GITHUB_OUTPUT), `${name}=${value}\n`);
if (process.argv[2] === 'admit') {
  const operators: readonly string[] = config.operators;
  if (
    process.env.GITHUB_REPOSITORY !== config.repository ||
    !operators.includes(string(process.env.GITHUB_ACTOR)) ||
    !operators.includes(process.env.GITHUB_TRIGGERING_ACTOR ?? string(process.env.GITHUB_ACTOR))
  )
    throw new Error('Only a configured operator can replay a review');
  const run = number(Number(process.env.SOURCE_RUN));
  const source = object(api(repoPath(`actions/runs/${run}`)));
  if (
    source.status !== 'completed' ||
    string(source.path).split('@')[0] !== '.github/workflows/factory.yml'
  )
    throw new Error('Replay requires a completed factory run from this repository');
  output('run', String(run));
} else if (process.argv[2] === 'prepare') {
  const task = parseTask(JSON.parse(readFileSync(join(temp, 'task/task.json'), 'utf8')));
  const checks = object(JSON.parse(readFileSync(join(temp, 'checks/feedback.json'), 'utf8')));
  const patchSha = hash(readFileSync(join(temp, 'proposal/agent.patch')));
  if (
    checks.passed !== true ||
    checks.baseSha !== task.baseSha ||
    checks.specificationSha !== task.specificationSha ||
    checks.patchSha !== patchSha
  )
    throw new Error('Replay requires independently passed checks for this exact task and patch');
  output('base_sha', task.baseSha);
  output('patch_sha', patchSha);
} else throw new Error('Unknown replay command');
