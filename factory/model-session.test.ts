import { expect, test } from 'bun:test';
import { waitForModelResult } from './model-session';

test('async review waits through startup and tool turns, then returns the completed structured answer', async () => {
  let reads = 0;
  const result = await waitForModelResult(
    async (path) => {
      expect(path).toBe('/session/ses1/message?limit=1');
      reads++;
      if (reads === 1) return []; // Accepted prompt has not produced a response yet.
      const previous = {
        role: 'assistant',
        time: { created: 1, completed: 2 },
        finish: 'tool-calls',
      };
      return reads === 2
        ? [{ info: previous }]
        : [
            {
              info: {
                role: 'assistant',
                time: { created: 3, completed: 4 },
                finish: 'tool-calls',
                structured: { status: 'pass', summary: 'Sin defectos', findings: [] },
              },
            },
            { info: previous },
          ]; // No dependence on API list order.
    },
    'ses1',
    AbortSignal.timeout(2000),
    1,
  );
  expect(result.structured).toEqual({ status: 'pass', summary: 'Sin defectos', findings: [] });
  expect(reads).toBe(3);
});

test('async review preserves model errors and terminates a permanently busy session at the deadline', async () => {
  const error = { name: 'StructuredOutputError' };
  const result = await waitForModelResult(
    async () => [{ info: { role: 'assistant', time: { created: 1 }, error } }],
    'ses1',
    AbortSignal.timeout(1000),
    1,
  );
  expect(result.error).toEqual(error);
  await expect(
    waitForModelResult(async () => [], 'ses1', AbortSignal.timeout(20), 1),
  ).rejects.toThrow();
});

test('progress exposes only tool states, never model prose, inputs or tool output', async () => {
  const samples: unknown[] = [];
  await waitForModelResult(
    async () => [
      {
        info: {
          role: 'assistant',
          time: { created: 1, completed: 2 },
          structured: { status: 'pass' },
        },
        parts: [
          { type: 'reasoning', text: 'private reasoning' },
          {
            type: 'tool',
            tool: 'read',
            state: { status: 'completed', input: { path: 'private' }, output: 'private source' },
          },
        ],
      },
    ],
    'ses1',
    AbortSignal.timeout(1000),
    1,
    (sample) => samples.push(sample),
  );
  expect(samples).toEqual([
    {
      polls: 1,
      toolCalls: 0,
      assistantMessages: 1,
      completed: true,
      structured: true,
      tools: [{ name: 'read', status: 'completed' }],
    },
  ]);
});

test('a runaway tool stream is stopped before consuming the entire time budget', async () => {
  let reads = 0;
  await expect(
    waitForModelResult(
      async () => [
        {
          info: { role: 'assistant', time: { created: 1 } },
          parts: [
            { id: `tool-${++reads}`, type: 'tool', tool: 'read', state: { status: 'completed' } },
          ],
        },
      ],
      'ses1',
      AbortSignal.timeout(2000),
      1,
      undefined,
      2,
    ),
  ).rejects.toThrow('Model tool-call limit exceeded');
  expect(reads).toBe(3);
});
