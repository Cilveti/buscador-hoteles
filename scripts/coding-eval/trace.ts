import { z } from 'zod';
import { streamCompactions } from './compactions';

const object = z.record(z.string(), z.unknown());
const record = (value: unknown) => object.safeParse(value).data ?? {};
const string = (value: unknown) => (typeof value === 'string' ? value : '');
const number = (value: unknown) => (typeof value === 'number' ? value : null);
type Command = { event: number; command: string; exitCode: number | null; output: string };
type Skill = { event: number; name: string; kind: 'native' | 'read-command' };
function initialEvidence() {
  return {
    commands: [] as Command[],
    skills: [] as Skill[],
    edits: [] as number[],
    errors: [] as string[],
    usage: {} as Record<string, number>,
    cost: null as number | null,
    finalResponse: '',
    completed: false,
    sessionId: null as string | null,
  };
}
type Evidence = ReturnType<typeof initialEvidence>;
function addUsage(target: Evidence, value: unknown, prefix = '') {
  for (const [key, amount] of Object.entries(record(value))) {
    if (typeof amount === 'number')
      target.usage[prefix + key] = (target.usage[prefix + key] ?? 0) + amount;
  }
}
function codexEvent(e: Record<string, unknown>, index: number, target: Evidence) {
  if (e.type === 'turn.completed') {
    target.completed = true;
    addUsage(target, e.usage);
  }
  if (e.type !== 'item.completed') return;
  const item = record(e.item);
  switch (item.type) {
    case 'agent_message':
      target.finalResponse = string(item.text);
      break;
    case 'file_change':
      if (item.status === 'completed') target.edits.push(index);
      break;
    case 'command_execution':
      target.commands.push({
        event: index,
        command: string(item.command),
        exitCode: number(item.exit_code),
        output: string(item.aggregated_output),
      });
      break;
  }
}
function openCodeTool(part: Record<string, unknown>, index: number, target: Evidence) {
  const state = record(part.state);
  if (state.status !== 'completed') return;
  const input = record(state.input);
  switch (part.tool) {
    case 'skill':
      target.skills.push({ event: index, name: string(input.name), kind: 'native' });
      break;
    case 'edit':
    case 'write':
    case 'apply_patch':
      target.edits.push(index);
      break;
    case 'bash':
      target.commands.push({
        event: index,
        command: string(input.command),
        exitCode: number(record(state.metadata).exit),
        output: string(state.output),
      });
      break;
    case 'read':
      if (/[/\\]skills[/\\].*SKILL\.md/.test(string(input.filePath)))
        target.skills.push({ event: index, name: string(input.filePath), kind: 'read-command' });
      break;
  }
}
function openCodeEvent(e: Record<string, unknown>, index: number, target: Evidence) {
  const part = record(e.part);
  switch (e.type) {
    case 'step_finish': {
      const tokens = record(part.tokens);
      addUsage(target, tokens);
      addUsage(target, tokens.cache, 'cache_');
      const cost = number(part.cost);
      if (cost !== null) target.cost = (target.cost ?? 0) + cost;
      if (part.reason === 'stop') target.completed = true;
      break;
    }
    case 'text':
      target.finalResponse = string(part.text) || target.finalResponse;
      break;
    case 'tool_use':
      openCodeTool(part, index, target);
      break;
  }
}
/** Completed tool events are evidence; command matching remains explicitly heuristic. */
export function analyzeEvents(events: unknown[]) {
  const target = initialEvidence();
  for (const [index, raw] of events.entries()) {
    const e = record(raw);
    target.sessionId = string(e.thread_id) || string(e.sessionID) || target.sessionId;
    if (e.type === 'error' || e.type === 'turn.failed')
      target.errors.push(JSON.stringify(e.error ?? e.message));
    codexEvent(e, index, target);
    openCodeEvent(e, index, target);
  }
  const { commands, edits, skills } = target;
  for (const command of commands) {
    if (
      command.exitCode === 0 &&
      /(?:cat|sed|head|read).*skills\/.*SKILL\.md/.test(command.command)
    )
      skills.push({ event: command.event, name: command.command, kind: 'read-command' });
  }
  const verifyCommands = commands.filter((c) =>
    /\b(?:bun|npm|pnpm)\s+(?:run\s+)?verify\b|scripts\/verification\/verify\.ts/.test(c.command),
  );
  const lastVerify = verifyCommands.at(-1),
    lastEdit = edits.at(-1);
  const afterLastObservedEdit = lastVerify
    ? lastEdit === undefined
      ? null
      : lastVerify.event > lastEdit
    : false;
  return {
    sessionId: target.sessionId,
    compactions: streamCompactions(events),
    completed: target.completed && target.errors.length === 0,
    errors: target.errors,
    finalResponse: target.finalResponse,
    usage: Object.keys(target.usage).length ? target.usage : null,
    reportedCostUsd: target.cost,
    costSource: target.cost === null ? 'unavailable' : 'opencode',
    commands,
    skillLoads: skills,
    observedEditEvents: edits,
    verify: {
      observed: verifyCommands.length > 0,
      calls: verifyCommands,
      lastExitCode: lastVerify?.exitCode ?? null,
      afterLastObservedEdit,
    },
    browserCommands: commands.filter((c) =>
      /playwright|test:eval-browser|eval:browser/.test(c.command),
    ),
    limitations: [
      'Command matching is a heuristic, not proof that every nested check ran.',
      'Shell commands can edit files without a file_change event; afterLastObservedEdit is not proof that the final tree was verified.',
      'No event does not prove a skill was absent from injected context.',
    ],
  };
}
