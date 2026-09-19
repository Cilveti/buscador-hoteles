import { expect, test } from 'bun:test';
import { analyzeCodexRollout } from './compactions';
import { analyzeEvents } from './trace';

const rollout = (compactions: unknown[], complete = true) => [
  JSON.stringify({
    type: 'session_meta',
    payload: { id: 'candidate-thread', cli_version: '0.154.0' },
  }),
  ...compactions.map((item) => JSON.stringify(item)),
  ...(complete ? [JSON.stringify({ type: 'event_msg', payload: { type: 'task_complete' } })] : []),
];

test('Codex durable markers count applied compactions once despite mirrored legacy notifications', () => {
  const marker = {
    type: 'compacted',
    timestamp: '2026-09-15T10:00:00Z',
    payload: { message: 'private summary' },
  };
  const result = analyzeCodexRollout(
    rollout([
      marker,
      { type: 'event_msg', payload: { type: 'context_compacted' } },
      marker,
      { ...marker, timestamp: '2026-09-15T10:10:00Z' },
    ]),
    'candidate-thread',
  );
  expect(result.count).toBe(2);
  expect(result.observedCount).toBe(2);
  expect(result.coverage).toBe('complete');
  expect(JSON.stringify(result)).not.toContain('private summary');
});

test('zero observed differs from unsupported CLI or truncated rollout', () => {
  expect(analyzeCodexRollout(rollout([]), 'candidate-thread').count).toBe(0);
  const partial = analyzeCodexRollout(
    rollout([{ type: 'compacted', payload: {} }], false),
    'candidate-thread',
  );
  expect(partial.count).toBeNull();
  expect(partial.observedCount).toBe(1);
  expect(partial.coverage).toBe('partial');
  const stream = analyzeEvents([{ type: 'turn.completed', usage: { input_tokens: 900000 } }]);
  expect(stream.compactions.count).toBeNull();
  expect(stream.compactions.coverage).toBe('unavailable');
});

test('wrong session and malformed rows cannot produce a definitive count', () => {
  expect(analyzeCodexRollout(rollout([]), 'another-thread').source).toBe('unavailable');
  expect(analyzeCodexRollout([...rollout([]), '{partial'], 'candidate-thread').coverage).toBe(
    'partial',
  );
});

test('OpenCode notifications are lower bounds; queued compaction, pruning and model text are not completion', () => {
  const event = {
    type: 'session.compacted',
    id: 'notification-1',
    properties: { sessionID: 's1' },
  };
  const result = analyzeEvents([
    { type: 'text', part: { text: 'I compacted my context three times.' } },
    {
      type: 'message.part.updated',
      properties: { part: { type: 'compaction', id: 'request-1', auto: true } },
    },
    { type: 'tool_use', part: { state: { time: { compacted: 123 } } } },
    event,
    event,
    { ...event, id: 'notification-2' },
  ]);
  expect(result.compactions.count).toBeNull();
  expect(result.compactions.observedCount).toBe(2);
  expect(result.compactions.coverage).toBe('partial');
});
