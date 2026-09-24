import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { WorkflowAgent } from '../workflow-observer/contracts';
import { localAgentLog, localAgents } from '../workflow-observer/local';
import { qaDirectoryForAgent, qaTraceItems } from '../workflow-observer/qa-trace';
import { archiveTrace } from '../workflow-observer/trace';
import { git, saveJson } from './workspace';

const terminal = new Set(['evaluated', 'completed', 'incomplete', 'baseline_failed', 'prepared']);
const metadata = z
  .object({
    status: z.string().optional(),
    replacement: z.object({ status: z.string() }).passthrough().optional(),
    kind: z.string().optional(),
  })
  .passthrough();
function readMetadata(path: string) {
  const value = metadata.parse(JSON.parse(readFileSync(path, 'utf8')));
  return {
    ...value,
    status:
      value.status ??
      value.replacement?.status ??
      (value.kind === 'candidate-tests-runner-v2'
        ? 'completed'
        : path.endsWith('/error.json')
          ? 'incomplete'
          : 'unknown'),
  };
}
function contained(root: string, path: string) {
  const rel = relative(root, path);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Only finished evaluation directories can be compacted. Never follow links into active workspaces. */
export function compactEvaluation(project: string, directory: string) {
  const logicalBase = resolve(project, '.agent-evals');
  const requested = resolve(directory);
  if (!contained(logicalBase, requested)) throw new Error('Cleanup must stay inside .agent-evals');
  const base = realpathSync(logicalBase);
  const target = join(base, relative(logicalBase, requested));
  let ancestor = base;
  for (const part of relative(base, target).split(sep)) {
    ancestor = join(ancestor, part);
    if (lstatSync(ancestor).isSymbolicLink())
      throw new Error('Cleanup refuses symlink directories');
  }
  const manifest = join(target, 'manifest.json');
  const result = join(target, 'result.json');
  const state = readMetadata(
    existsSync(manifest) ? manifest : existsSync(result) ? result : join(target, 'error.json'),
  );
  if (!terminal.has(state.status)) throw new Error(`Cleanup refuses active state: ${state.status}`);
  const isCampaign = existsSync(manifest);
  const checkInactive = (root: string) => {
    const result = join(root, 'result.json');
    if (existsSync(result) && !terminal.has(readMetadata(result).status))
      throw new Error(`Cleanup refuses active run: ${root}`);
    for (const folder of ['runs', 'reverifications', 'rejudgments']) {
      const children = join(root, folder);
      if (!existsSync(children)) continue;
      for (const entry of readdirSync(children, { withFileTypes: true }))
        if (entry.isDirectory()) checkInactive(join(children, entry.name));
    }
  };
  checkInactive(target);
  const removed: string[] = [];
  const errors: string[] = [];
  const pin = (owner: string, data: Record<string, unknown>) => {
    const id = createHash('sha256').update(relative(base, owner)).digest('hex').slice(0, 24);
    for (const name of ['baselineCommit', 'deliveredCommit', 'variantCommit']) {
      const commit = data[name];
      if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit)) continue;
      git(project, ['update-ref', `refs/coding-evals/${id}/${name}`, commit]);
    }
  };
  const remove = (path: string) => {
    if (!existsSync(path)) return;
    if (realpathSync(path) !== path) throw new Error(`Cleanup refuses linked path: ${path}`);
    rmSync(path, { recursive: true, force: true });
    removed.push(relative(target, path));
  };
  pin(target, state);
  // Registered worktrees include ignored build outputs and dependency copies. Git removes their registration too.
  const worktrees = git(project, ['worktree', 'list', '--porcelain', '-z'])
    .split('\0')
    .filter((row) => row.startsWith('worktree '))
    .map((row) => row.slice(9));
  for (const worktree of worktrees) {
    if (!contained(target, worktree)) continue;
    const name = relative(target, worktree);
    if (
      !/(?:^|\/)(?:candidate|candidate-tests-worktree|verification-worktree|baseline\/worktree)$/.test(
        name,
      )
    )
      continue;
    try {
      if (/\/(?:reverifications|rejudgments)\//.test(`/${name}`)) {
        const owner = resolve(worktree, '..');
        if (
          !existsSync(join(owner, 'result.json')) ||
          !terminal.has(readMetadata(join(owner, 'result.json')).status)
        )
          continue;
      }
      // Pin all run revisions before dropping detached worktree references.
      const run =
        isCampaign && name.startsWith('runs/')
          ? join(target, 'runs', name.split('/')[1] ?? '')
          : target;
      if (existsSync(join(run, 'result.json'))) {
        const runState = readMetadata(join(run, 'result.json'));
        if (!terminal.has(runState.status)) throw new Error('Run still active');
        pin(run, runState);
      }
      if (existsSync(worktree) && realpathSync(worktree) !== worktree)
        throw new Error('Worktree is relocated or linked');
      git(project, ['worktree', 'remove', '--force', worktree]);
      removed.push(name);
    } catch (error) {
      errors.push(`${name}: ${String(error)}`);
    }
  }
  const compactRun = (run: string) => {
    const resultFile = existsSync(join(run, 'result.json'))
      ? join(run, 'result.json')
      : join(run, 'error.json');
    if (!existsSync(resultFile)) return;
    const runState = readMetadata(resultFile);
    if (!terminal.has(runState.status)) return;
    pin(run, runState);
    const archive = join(run, 'trace-archive');
    const traces: (WorkflowAgent & { events: number })[] = [];
    const preserve = (agent: WorkflowAgent, source: string) => {
      if (!existsSync(source)) return;
      mkdirSync(archive, { recursive: true, mode: 0o700 });
      const events = archiveTrace(source, join(archive, `${agent.id}.projected.jsonl`));
      traces.push({ ...agent, traceAvailable: true, resumeCommand: null, events });
    };
    const candidate = join(run, 'candidate-session/events.jsonl');
    preserve(
      {
        id: 'candidate',
        role: 'implementer',
        harness: 'codex',
        model: null,
        status: 'unknown',
        startedAt: null,
        durationMs: null,
        traceAvailable: true,
        output: existsSync(join(run, 'candidate-session/final.txt'))
          ? readFileSync(join(run, 'candidate-session/final.txt'), 'utf8').slice(0, 12_000)
          : null,
        sessionId: null,
        resumeCommand: null,
      },
      candidate,
    );
    const workflow = join(run, 'workflow');
    if (existsSync(workflow))
      for (const agent of localAgents(workflow)) {
        const qa = qaDirectoryForAgent(workflow, agent.id);
        if (qa) {
          mkdirSync(archive, { recursive: true, mode: 0o700 });
          const items = qaTraceItems(qa);
          writeFileSync(
            join(archive, `${agent.id}.projected.jsonl`),
            items.map((item) => JSON.stringify(item)).join('\n') + (items.length ? '\n' : ''),
            { mode: 0o600 },
          );
          traces.push({
            ...agent,
            traceAvailable: true,
            resumeCommand: null,
            events: items.length,
          });
          continue;
        }
        const source = localAgentLog(workflow, agent.id);
        if (source) preserve(agent, source);
      }
    if (traces.length) saveJson(join(archive, 'agents.json'), traces);
    // Final JSON values, prompts, patches, final messages and compaction summaries remain.
    for (const path of [
      'judge-input',
      'browser',
      'candidate-tests/browser',
      'private-acceptance/artifacts',
      'workflow',
      'workflow-candidate-events.jsonl',
    ])
      remove(join(run, path));
    for (const session of ['candidate-session', 'judge-session']) {
      for (const path of ['events.jsonl', 'stdout.log']) remove(join(run, session, path));
    }
    remove(join(run, 'process.json'));
    for (const folder of ['reverifications', 'rejudgments']) {
      if (!existsSync(join(run, folder))) continue;
      for (const entry of readdirSync(join(run, folder), { withFileTypes: true })) {
        if (entry.isDirectory()) compactRun(join(run, folder, entry.name));
      }
    }
    saveJson(join(run, 'retention.json'), {
      policy: 'results-only-v1',
      compactedAt: new Date().toISOString(),
      rejudgeAvailable: false,
    });
  };
  if (isCampaign) {
    const runs = join(target, 'runs');
    if (existsSync(runs))
      for (const entry of readdirSync(runs, { withFileTypes: true })) {
        if (entry.isDirectory()) compactRun(join(runs, entry.name));
      }
    remove(join(target, 'baseline/browser'));
  } else compactRun(target);
  saveJson(join(target, 'retention.json'), {
    policy: 'results-only-v1',
    compactedAt: new Date().toISOString(),
    removed,
    errors,
    rejudgeAvailable: false,
  });
  return { removed, errors };
}

/** Cleanup must not replace a completed score or conceal an infrastructure failure. */
export function finishEvaluationStorage(project: string, directory: string) {
  try {
    return compactEvaluation(project, directory);
  } catch (error) {
    saveJson(join(directory, 'retention-error.json'), { error: String(error) });
    return { removed: [], errors: [String(error)] };
  }
}

export function requireRetainedEvidence(run: string) {
  if (existsSync(join(run, 'retention.json')))
    throw new Error(
      'This evaluation retains final results only; its temporary judge evidence was removed. Start a new evaluation to obtain fresh evidence.',
    );
}
