import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectCodexCollaboration } from './codex-rollout';

const roots: string[] = [];

function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'codex-rollout-summary-'));
  roots.push(home);
  const sessions = join(home, 'sessions/2026/09/22');
  mkdirSync(sessions, { recursive: true });
  const write = (threadId: string, rows: unknown[]) => {
    writeFileSync(
      join(sessions, `rollout-fixture-${threadId}.jsonl`),
      `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    );
  };
  return { home, write };
}

const meta = (threadId: string, parentThreadId: string | null = null, cliVersion = '0.154.0') => ({
  type: 'session_meta',
  payload: {
    id: threadId,
    parent_thread_id: parentThreadId,
    cli_version: cliVersion,
    base_instructions: 'SECRET_PROMPT_MUST_NOT_SURVIVE',
    future_field: { tolerated: true },
  },
});
const start = (turnId: string) => ({
  type: 'event_msg',
  payload: { type: 'task_started', turn_id: turnId, started_at: 100 },
});
const context = (turnId: string, model: string) => ({
  type: 'turn_context',
  payload: { turn_id: turnId, model, future_field: true },
});
const usage = (threadId: string, turnId: string, responseId: string, inputTokens = 10) => ({
  type: 'token_usage_record',
  payload: {
    response_id: responseId,
    thread_id: threadId,
    turn_id: turnId,
    usage: {
      input_tokens: inputTokens,
      cached_input_tokens: 2,
      cache_write_input_tokens: 1,
      output_tokens: 3,
      reasoning_output_tokens: 1,
      total_tokens: inputTokens + 3,
    },
    future_field: 'accepted',
  },
});
const complete = (turnId: string, durationMs: number) => ({
  type: 'event_msg',
  payload: {
    type: 'task_complete',
    turn_id: turnId,
    started_at: 100,
    completed_at: 101,
    duration_ms: durationMs,
    last_agent_message: 'SECRET_OUTPUT_MUST_NOT_SURVIVE',
  },
});
const command = (
  threadId: string,
  turnId: string,
  itemId: string,
  value: string,
  exitCode: number | null,
) => ({
  type: 'event_msg',
  payload: {
    type: 'item_completed',
    thread_id: threadId,
    turn_id: turnId,
    item: {
      id: itemId,
      type: 'command_execution',
      command: value,
      exit_code: exitCode,
      aggregated_output: 'SECRET_COMMAND_OUTPUT_MUST_NOT_SURVIVE',
    },
  },
});
const compacted = (threadId?: string, window = 1) => ({
  type: 'compacted',
  timestamp: `2026-09-22T00:00:0${window}Z`,
  payload: {
    window_number: window,
    message: 'SECRET_COMPACTION_MUST_NOT_SURVIVE',
    ...(threadId ? { latest_token_usage_record: { thread_id: threadId } } : {}),
  },
});

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('summarizes a nested parent/child tree with terminal state, wall time and heuristic signals', () => {
  const f = fixture();
  f.write('root', [
    meta('root'),
    start('turn-root'),
    context('turn-root', 'gpt-5.6-luna'),
    usage('root', 'turn-root', 'response-root'),
    command('root', 'turn-root', 'verify', 'bun run verify', 0),
    command('root', 'turn-root', 'browser', 'bun run test:eval-browser', 1),
    complete('turn-root', 1000),
  ]);
  f.write('child', [
    meta('child', 'root'),
    start('turn-child'),
    context('turn-child', 'gpt-5.6-luna'),
    usage('child', 'turn-child', 'response-child'),
    complete('turn-child', 600),
  ]);
  f.write('grandchild', [
    meta('grandchild', 'child'),
    start('turn-grandchild'),
    context('turn-grandchild', 'gpt-5.6-luna'),
    usage('grandchild', 'turn-grandchild', 'response-grandchild'),
    complete('turn-grandchild', 400),
  ]);

  const result = collectCodexCollaboration(f.home, 'root');
  expect(result.coverage).toBe('complete');
  expect(result.totals.threadCount).toBe(3);
  expect(result.totals.subagentCount).toBe(2);
  expect(result.totals.wallTimeMs).toBe(2000);
  expect(
    result.threads.map(({ threadId, parentThreadId, depth }) => ({
      threadId,
      parentThreadId,
      depth,
    })),
  ).toEqual([
    { threadId: 'root', parentThreadId: null, depth: 0 },
    { threadId: 'child', parentThreadId: 'root', depth: 1 },
    { threadId: 'grandchild', parentThreadId: 'child', depth: 2 },
  ]);
  expect(result.threads[0]?.signals.verify.successfulCalls).toBe(1);
  expect(result.threads[0]?.signals.browser.failedCalls).toBe(1);
  expect(JSON.stringify(result)).not.toContain('SECRET_');
});

test('deduplicates usage by response_id/model and separates inherited compactions', () => {
  const f = fixture();
  const rootUsage = usage('root', 'turn-root', 'response-root', 10);
  const rootCompaction = compacted(undefined, 1);
  f.write('root', [
    meta('root'),
    start('turn-root'),
    context('turn-root', 'gpt-5.6-luna'),
    rootUsage,
    rootCompaction,
    complete('turn-root', 100),
  ]);
  const childUsage = usage('child', 'turn-child', 'response-child', 20);
  f.write('child', [
    meta('child', 'root'),
    rootUsage,
    rootCompaction,
    start('turn-child'),
    context('turn-child', 'gpt-5.6-luna'),
    childUsage,
    childUsage,
    compacted(undefined, 2),
    complete('turn-child', 200),
  ]);

  const result = collectCodexCollaboration(f.home, 'root');
  expect(result.totals.uniqueUsageResponses).toBe(2);
  expect(result.totals.duplicateUsageRecords).toBe(2);
  expect(result.totals.usage?.input_tokens).toBe(30);
  expect(result.compactions.root?.observedCount).toBe(1);
  expect(result.compactions.subagents[0]?.compactions.observedCount).toBe(1);
  expect(result.compactions.observedTotal).toBe(2);
});

test('keeps the same response id distinct across models and marks an incomplete child partial', () => {
  const f = fixture();
  f.write('root', [
    meta('root'),
    start('turn-root'),
    context('turn-root', 'gpt-5.6-luna'),
    usage('root', 'turn-root', 'shared-response', 10),
    complete('turn-root', 100),
  ]);
  f.write('child', [
    meta('child', 'root'),
    start('turn-child'),
    context('turn-child', 'gpt-5.6-sol'),
    usage('child', 'turn-child', 'shared-response', 20),
  ]);

  const result = collectCodexCollaboration(f.home, 'root');
  expect(result.coverage).toBe('partial');
  expect(result.totals.uniqueUsageResponses).toBe(2);
  expect(result.totals.usageByModel.map(({ model }) => model)).toEqual([
    'gpt-5.6-luna',
    'gpt-5.6-sol',
  ]);
  expect(result.threads.find(({ threadId }) => threadId === 'child')?.state).toBe('incomplete');
  expect(result.threads.find(({ threadId }) => threadId === 'child')?.wallTimeMs).toBeNull();
});

test('CLI alpha evidence remains partial even with a terminal, well-formed rollout', () => {
  const f = fixture();
  f.write('root', [
    meta('root', null, '0.154.0-alpha.6.2'),
    start('turn-root'),
    context('turn-root', 'gpt-5.6-luna'),
    usage('root', 'turn-root', 'response-root'),
    compacted('root'),
    complete('turn-root', 100),
  ]);

  const result = collectCodexCollaboration(f.home, 'root');
  expect(result.coverage).toBe('partial');
  expect(result.cliVersions).toEqual(['0.154.0-alpha.6.2']);
  expect(result.compactions.root).toEqual({
    count: null,
    observedCount: 1,
    coverage: 'partial',
  });
});
