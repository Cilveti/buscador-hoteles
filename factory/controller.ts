import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config';
import { designIdFromIssue, readDesign } from './design';
import {
  api,
  comment,
  dispatch,
  number,
  object,
  readTask,
  repoPath,
  string,
  writeTask,
} from './github';
import { cancel, createTask, decide, finishAttempt, hash, recover, startAttempt } from './state';

const temp = process.env.RUNNER_TEMP ?? '/tmp';
const actor = process.env.GITHUB_ACTOR ?? '';
const run = process.env.GITHUB_RUN_ID ?? '';
const operators: readonly string[] = config.operators;

function output(key: string, value: string | number): void {
  if (/[\r\n]/.test(String(value))) throw new Error('Unsafe output');
  const line = `${key}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
  else process.stdout.write(line);
}

function requireRepo(): void {
  if (process.env.GITHUB_REPOSITORY !== config.repository)
    throw new Error('Repository not configured');
}

function admit() {
  requireRepo();
  const trigger = process.env.GITHUB_TRIGGERING_ACTOR ?? actor;
  if (trigger !== actor && !operators.includes(trigger)) return output('admitted', 'false');
  const event = object(JSON.parse(readFileSync(string(process.env.GITHUB_EVENT_PATH), 'utf8')));
  const eventName = process.env.GITHUB_EVENT_NAME;
  const inputs = event.inputs ? object(event.inputs) : {};
  const issue = event.issue ? number(object(event.issue).number) : number(Number(inputs.issue));
  const previous = readTask(issue);
  const data = object(api(repoPath(`issues/${issue}`)));
  if (data.pull_request || data.state !== 'open') return output('admitted', 'false');
  if (!operators.includes(actor)) {
    if (
      eventName !== 'workflow_dispatch' ||
      actor !== 'github-actions[bot]' ||
      previous?.task.status !== 'retry' ||
      inputs.predecessor !== previous.task.activeRun
    )
      return output('admitted', 'false');
  }
  let task = previous?.task;
  if (eventName === 'issue_comment') {
    if (!task) return output('admitted', 'false');
    const message = object(event.comment);
    if (object(message.user).login !== actor || object(message.user).type !== 'User')
      return output('admitted', 'false');
    const body = string(message.body).trim();
    if (body === '/factory cancel') {
      writeTask(cancel(task, actor, operators), previous?.sha);
      comment(issue, 'Factory: **cancelled**. No further candidate may be published.');
      // Cancel the active execution separately; state has already revoked its right to publish.
      if (task.activeRun) {
        const active = object(api(repoPath(`actions/runs/${task.activeRun}`)));
        if (active.status !== 'completed')
          api(repoPath(`actions/runs/${task.activeRun}/cancel`), 'POST');
      }
      return output('admitted', 'false');
    }
    const recovery = /^\/factory retry (\d+)$/.exec(body);
    const decision = /^\/factory (approve|reject) ([a-f0-9-]{36})$/.exec(body);
    if (recovery) {
      const previousRun = string(recovery[1]);
      const oldRun = object(api(repoPath(`actions/runs/${previousRun}`)));
      if (oldRun.status !== 'completed') throw new Error('Wait until the previous run completes');
      // A late publication failure may already have produced a branch/PR. Never silently retry it.
      const branch = `factory/issue-${issue}/attempt-${task.attempts}-${previousRun}`;
      const refs = api(repoPath(`git/matching-refs/heads/${branch}`));
      if (!Array.isArray(refs) || refs.length)
        throw new Error('Inspect the existing candidate before recovery');
      task = recover(task, previousRun, actor, operators, config.limits.attempts);
    } else if (decision) {
      task = decide(
        task,
        {
          id: string(decision[2]),
          approve: decision[1] === 'approve',
          actor,
          commentId: String(message.id),
        },
        operators,
        config.limits.attempts,
      );
    } else return output('admitted', 'false');
    if (task.status !== 'ready') {
      writeTask(task, previous?.sha);
      comment(issue, `Factory: **${task.status}**.`);
      return output('admitted', 'false');
    }
  } else if (!task) {
    if (eventName !== 'issues' || object(event.label).name !== 'factory:ready')
      return output('admitted', 'false');
    const author = string(object(data.user).login);
    if (!operators.includes(author)) throw new Error('Task author not authorized');
    const labels = Array.isArray(data.labels) ? data.labels.map((label) => object(label).name) : [];
    const profiles = (['basic', 'full'] as const).filter((profile) =>
      labels.includes(`factory:${profile}`),
    );
    if (profiles.length !== 1 || !profiles[0])
      throw new Error('Select exactly one permission profile');
    task = createTask({
      issue,
      baseSha: string(process.env.GITHUB_SHA),
      title: string(data.title),
      body: typeof data.body === 'string' ? data.body : '',
      author,
      profile: profiles[0],
      actor,
    });
    const designId = designIdFromIssue(task.specification.body);
    if (labels.includes('factory:visual') && !designId)
      throw new Error('Visual tasks require a design snapshot');
    if (designId)
      task.design = { id: designId, manifestSha: readDesign(process.cwd(), designId).manifestSha };
  }
  if (!task || !['ready', 'retry'].includes(task.status)) return output('admitted', 'false');
  const currentSpecification = {
    title: data.title,
    body: data.body ?? '',
    author: object(data.user).login,
  };
  if (hash(JSON.stringify(currentSpecification)) !== task.specificationSha)
    throw new Error(
      'Issue changed after admission. Create a new task for a changed specification.',
    );
  task = startAttempt(task, run, config.limits.attempts);
  writeTask(task, previous?.sha);
  writeFileSync(join(temp, 'task.json'), JSON.stringify(task));
  output('admitted', 'true');
  output('issue', issue);
  output('base_sha', task.baseSha);
  output('attempt', task.attempts);
  output('profile', task.profile);
  output('model', config.worker.models[task.attempts - 1] ?? config.worker.models[2]);
  output('reviewer', config.worker.reviewer);
  comment(
    issue,
    `Factory: **running**, attempt ${task.attempts}/${config.limits.attempts}, profile **${task.profile}**. [Run](https://github.com/${config.repository}/actions/runs/${run}).`,
  );
}

function finish(): void {
  requireRepo();
  const issue = number(Number(process.env.ISSUE));
  const previous = readTask(issue);
  if (!previous) throw new Error('Missing durable state');
  const result = process.env.RESULT;
  const detail = existsSync(join(temp, 'proposal/decision.json'))
    ? string(object(JSON.parse(readFileSync(join(temp, 'proposal/decision.json'), 'utf8'))).reason)
    : (process.env.DETAIL ?? `Run ${run}`);
  const task = finishAttempt(
    previous.task,
    run,
    result === 'needs-human'
      ? { status: 'needs-human', detail, requestedProfile: 'full' }
      : { status: result === 'passed' || result === 'retry' ? result : 'failed', detail },
    config.limits.attempts,
  );
  if (process.env.PATCH_SHA && process.env.PROPOSAL_ARTIFACT)
    task.proposal = { run, artifact: process.env.PROPOSAL_ARTIFACT, sha: process.env.PATCH_SHA };
  if (process.env.FEEDBACK_ARTIFACT)
    task.feedback = { run, artifact: process.env.FEEDBACK_ARTIFACT };
  writeTask(task, previous.sha);
  if (task.decision) {
    comment(
      issue,
      `Factory: **waiting-human**.\n\n${task.decision.reason}\n\nRequested permission: **full for this frozen task** (dependencies permitted; factory controls remain protected).\n\nSpecification: \`${task.specificationSha}\`. Attempts used: ${task.attempts}/${config.limits.attempts}.\n\nAn authorized human can reply:\n\n\`/factory approve ${task.decision.id}\`\n\nor\n\n\`/factory reject ${task.decision.id}\``,
    );
  } else {
    comment(
      issue,
      `Factory: **${task.status}**. ${detail}\n\n[Evidence](https://github.com/${config.repository}/actions/runs/${run}).`,
    );
  }
  if (task.status === 'retry') dispatch(issue, run);
  output('status', task.status);
}

const command = process.argv[2];
if (command === 'admit') admit();
else if (command === 'finish') finish();
else throw new Error('Unknown controller command');
