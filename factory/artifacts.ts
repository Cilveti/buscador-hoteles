import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { config } from './config';
import { parseTask, string } from './github';
import { hash } from './state';

const temp = process.env.RUNNER_TEMP ?? '/tmp';
const task = parseTask(JSON.parse(readFileSync(join(temp, 'task/task.json'), 'utf8')));

if (process.argv[2] === 'recover') {
  for (const [artifact, folder] of [
    [task.proposal, 'previous'],
    [task.feedback, 'previous-feedback'],
  ] as const) {
    if (!artifact) continue;
    execFileSync(
      'gh',
      [
        'run',
        'download',
        artifact.run,
        '--repo',
        config.repository,
        '--name',
        artifact.artifact,
        '--dir',
        join(temp, folder),
      ],
      { stdio: 'pipe' },
    );
  }
} else if (process.argv[2] === 'report') {
  const patch = join(temp, 'proposal/agent.patch');
  if (hash(readFileSync(patch)) !== process.env.PATCH_SHA)
    throw new Error('Evidence patch mismatch');
  const directory = join(temp, 'evidence');
  mkdirSync(directory, { recursive: true });
  const logs = ['install', 'unit', 'e2e', 'build'].map((phase) => {
    const path = join(directory, `${phase}.log`);
    return {
      phase,
      log: existsSync(path)
        ? stripVTControlCharacters(readFileSync(path, 'utf8')).slice(-6000)
        : 'Phase did not execute',
    };
  });
  const passed = process.env.CHECK_RESULT === 'success';
  const phasesPath = join(directory, 'phases.tsv');
  const phases = existsSync(phasesPath) ? readFileSync(phasesPath, 'utf8') : '';
  const infrastructureFailure = !phases || /\t(125|126|127)\n/.test(phases);
  writeFileSync(
    join(directory, 'feedback.json'),
    JSON.stringify({
      passed,
      baseSha: task.baseSha,
      patchSha: process.env.PATCH_SHA,
      specificationSha: task.specificationSha,
      logs,
    }),
  );
  appendFileSync(
    string(process.env.GITHUB_OUTPUT),
    `status=${passed ? 'passed' : infrastructureFailure ? 'failed' : 'retry'}\n`,
  );
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Verification\n\n${passed ? 'Passed' : 'Failed'} for patch \`${process.env.PATCH_SHA}\`.\n\nSeparate containers: unit checks, real application E2E, build.\n`,
    );
} else throw new Error('Unknown artifact command');
