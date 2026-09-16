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
import { prose, taskOutcome } from './presentation';
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
  const manualRecovery =
    eventName === 'workflow_dispatch' &&
    typeof inputs.recover_run === 'string' &&
    inputs.recover_run !== '';
  if (eventName === 'issue_comment' || manualRecovery) {
    if (!task) return output('admitted', 'false');
    const message = eventName === 'issue_comment' ? object(event.comment) : null;
    if (message && (object(message.user).login !== actor || object(message.user).type !== 'User'))
      return output('admitted', 'false');
    if (manualRecovery && (!operators.includes(actor) || !/^\d+$/.test(string(inputs.recover_run))))
      throw new Error('Invalid operator recovery');
    const body = message ? string(message.body).trim() : `/factory retry ${inputs.recover_run}`;
    if (body === '/factory cancel') {
      writeTask(cancel(task, actor, operators), previous?.sha);
      comment(
        issue,
        '## Tarea cancelada\n\nEl agente ya no puede publicar una propuesta para esta ejecución.',
      );
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
      task = recover(
        task,
        previousRun,
        actor,
        operators,
        config.limits.attempts,
        string(process.env.GITHUB_SHA),
      );
    } else if (decision) {
      task = decide(
        task,
        {
          id: string(decision[2]),
          approve: decision[1] === 'approve',
          actor,
          commentId: String(message?.id),
        },
        operators,
        config.limits.attempts,
      );
    } else return output('admitted', 'false');
    if (task.status !== 'ready') {
      writeTask(task, previous?.sha);
      comment(
        issue,
        taskOutcome(task, `https://github.com/${config.repository}/actions/runs/${run}`, ''),
      );
      return output('admitted', 'false');
    }
  } else if (!task) {
    if (
      !(
        (eventName === 'issues' && object(event.label).name === 'factory:ready') ||
        (eventName === 'workflow_dispatch' && operators.includes(actor))
      )
    )
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
  output('worker_sha', task.workerSha ?? task.baseSha);
  output('attempt', task.attempts);
  output('profile', task.profile);
  output('model', config.worker.models[task.attempts - 1] ?? config.worker.models[2]);
  output('reviewer', config.worker.reviewer);
  comment(
    issue,
    `## Trabajo iniciado\n\nIntento **${task.attempts}/${config.limits.attempts}**, permisos **${task.profile === 'basic' ? 'básicos: código y tests' : 'dependencias autorizadas'}**. El agente prepara una propuesta; después CI levantará la aplicación y comprobará el resultado.\n\n[Seguir la ejecución](https://github.com/${config.repository}/actions/runs/${run}).`,
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
      `## Necesito tu decisión para continuar

${prose(task.decision.reason)}

Se solicita permiso para modificar dependencias **solo en esta tarea**. Los workflows, comprobaciones y secretos siguen protegidos. El runner ya ha terminado; la espera no consume minutos.

Un operador autorizado puede responder con uno de estos comandos:

\`/factory approve ${task.decision.id}\`

\`/factory reject ${task.decision.id}\`

Intentos usados: **${task.attempts}/${config.limits.attempts}**. Aprobar no reinicia ese contador.`,
    );
  } else {
    comment(
      issue,
      taskOutcome(task, `https://github.com/${config.repository}/actions/runs/${run}`, detail),
    );
  }
  if (task.status === 'retry') dispatch(issue, run);
  output('status', task.status);
}

const command = process.argv[2];
if (command === 'admit') admit();
else if (command === 'finish') finish();
else throw new Error('Unknown controller command');
