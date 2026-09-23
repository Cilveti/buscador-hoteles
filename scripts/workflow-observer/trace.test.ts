import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveTrace, tracePage } from './trace';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
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
