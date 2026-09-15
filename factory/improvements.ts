import { writeFileSync } from 'node:fs';
import { config } from './config';
import { api, number, object, readTask, repoPath } from './github';

/** Build a reviewable improvement proposal from real task histories. Never changes the harness. */
const issues = process.argv
  .slice(2)
  .filter((arg) => /^\d+$/.test(arg))
  .map((arg) => number(Number(arg)));
if (!issues.length) throw new Error('Usage: bun factory/improvements.ts ISSUE... [--publish]');
const tasks = issues.map((issue) => {
  const state = readTask(issue);
  if (!state) throw new Error(`No factory state for #${issue}`);
  return state.task;
});
const events = tasks.flatMap((task) =>
  task.history
    .filter((event) => ['retry', 'exhausted', 'waiting-human', 'failed'].includes(event.event))
    .map((event) => ({ issue: task.issue, ...event })),
);
const body = [
  '# Harness improvement proposal',
  '',
  '## Observed evidence',
  ...events.map((event) => `- #${event.issue}: **${event.event}**, ${event.detail}`),
  events.length
    ? ''
    : '- No failures recorded in these tasks; do not invent a problem to justify a change.',
  '## Hypothesis and smallest change',
  'An agent should inspect the linked task artifacts, identify a repeated cause and propose ONE change. Preserve policy, checks and human authority. Do not infer a cause from a status alone.',
  '',
  '## Evaluation before adoption',
  '- Freeze baseline commit, task specification, model, permission profile, design and acceptance.',
  '- Replay the triggering case and a successful control case against baseline and proposed harness.',
  '- Record correctness, missed defects, unnecessary escalations, attempts, time and available token usage.',
  '- Report stochastic limitations; one success does not prove general reliability.',
  '- Open a separate PR containing the proposed harness change and the comparison report. Human review decides adoption.',
  '',
  '## Constraints',
  '- No automatic merge, permission expansion, removed acceptance or hidden failing tests.',
  '- Changed assertions and policies require explicit human assessment, even if aggregate metrics improve.',
  '',
  '## Frozen cases',
  ...tasks.map(
    (task) =>
      `- #${task.issue}: base \`${task.baseSha}\`, spec \`${task.specificationSha}\`, attempts ${task.attempts}, status ${task.status}.`,
  ),
].join('\n');
const output = process.env.FACTORY_IMPROVEMENT_OUTPUT ?? '/tmp/factory-improvement.md';
writeFileSync(output, body);
console.log(`Proposal written to ${output}`);
if (process.argv.includes('--publish')) {
  const issue = object(
    api(repoPath('issues'), 'POST', {
      title: `Harness improvement: review tasks ${issues.map((id) => `#${id}`).join(', ')}`,
      body,
      labels: ['factory:improvement'],
    }),
  );
  console.log(issue.html_url);
  console.log(
    `This issue is not factory:ready. Changes to ${config.repository}'s harness require a separate human-reviewed PR.`,
  );
}
