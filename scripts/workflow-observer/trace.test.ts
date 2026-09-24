import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resultText } from './result';
import { archiveTrace, tracePage } from './trace';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
test('preserva JSON de resultados largos tanto en la salida como en la traza archivada', () => {
  const root = mkdtempSync(join(tmpdir(), 'trace-result-'));
  roots.push(root);
  const result = { summary: 'Resumen largo '.repeat(1100), blockers: [] };
  const body = JSON.stringify(result);
  const output = join(root, 'result.json');
  const source = join(root, 'agent.log');
  const archive = join(root, 'agent.projected.jsonl');
  writeFileSync(output, body);
  writeFileSync(
    source,
    `${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: body } })}\n`,
  );
  expect(JSON.parse(resultText(output) ?? '')).toEqual(result);
  expect(archiveTrace(source, archive)).toBe(1);
  expect(JSON.parse(tracePage(archive).items[0]?.body ?? '')).toEqual(result);
});
test('pagina una traza larga sin perder eventos y archiva solo actividad visible', () => {
  const root = mkdtempSync(join(tmpdir(), 'trace-page-'));
  roots.push(root);
  const source = join(root, 'agent.log');
  const archive = join(root, 'agent.projected.jsonl');
  const lines = Array.from({ length: 20 }, (_, index) =>
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: `Mensaje ${index}` },
    }),
  );
  lines.push(
    JSON.stringify({ type: 'item.completed', item: { type: 'reasoning', text: 'private' } }),
  );
  writeFileSync(source, `${lines.join('\n')}\n`);
  const recent = tracePage(source, undefined, 240);
  expect(recent.before).not.toBeNull();
  const all = [...recent.items];
  let before = recent.before;
  while (before !== null) {
    const page = tracePage(source, before, 240);
    all.unshift(...page.items);
    before = page.before;
  }
  expect(all.map((item) => item.body)).toEqual(
    Array.from({ length: 20 }, (_, index) => `Mensaje ${index}`),
  );
  expect(archiveTrace(source, archive)).toBe(20);
  expect(tracePage(archive).items).toHaveLength(20);
  expect(JSON.stringify(tracePage(archive))).not.toContain('private');
});

test('conserva el id de una herramienta para unir su inicio y resultado en la UI', () => {
  const root = mkdtempSync(join(tmpdir(), 'trace-item-id-'));
  roots.push(root);
  const source = join(root, 'agent.log');
  const archive = join(root, 'agent.projected.jsonl');
  writeFileSync(
    source,
    `${[
      {
        type: 'item.started',
        item: {
          id: 'item_1',
          type: 'command_execution',
          command: 'bun run verify',
          status: 'in_progress',
        },
      },
      {
        type: 'item.completed',
        item: {
          id: 'item_1',
          type: 'command_execution',
          command: 'bun run verify',
          aggregated_output: '4 checks passed',
          status: 'completed',
        },
      },
      {
        type: 'item.completed',
        item: { id: 'item_2', type: 'mcp_tool_call', server: 'browser', tool: 'click' },
      },
    ]
      .map((event) => JSON.stringify(event))
      .join('\n')}\n`,
  );
  expect(tracePage(source).items.map((item) => item.itemId)).toEqual([
    'item_1',
    'item_1',
    'item_2',
  ]);
  expect(tracePage(source).items.at(-1)?.title).toBe('browser · click');
  expect(archiveTrace(source, archive)).toBe(3);
  expect(tracePage(archive).items.map((item) => item.itemId)).toEqual([
    'item_1',
    'item_1',
    'item_2',
  ]);
});
