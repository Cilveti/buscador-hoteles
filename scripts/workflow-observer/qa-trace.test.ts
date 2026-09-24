import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localAgents } from './local';
import { qaDirectoryForAgent, qaTraceItems, qaTracePage } from './qa-trace';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('QA appears as one agent and its trace distinguishes model decisions from controller actions', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-trace-'));
  roots.push(root);
  const qa = join(root, 'round-1/qa');
  for (const number of [0, 1]) {
    const step = join(qa, `step-${number}`);
    mkdirSync(step, { recursive: true });
    writeFileSync(
      join(step, 'agent.json'),
      JSON.stringify({ role: 'qa', model: 'gpt-6-luna', harness: 'codex' }),
    );
    writeFileSync(
      join(step, 'timing.json'),
      JSON.stringify({ startedAt: `2026-09-24T10:00:0${number}Z`, durationMs: 100 }),
    );
    writeFileSync(
      join(qa, `screen-0${number}.txt`),
      `URL: http://127.0.0.1/\nOBSERVATION ${number}`,
    );
    const decision =
      number === 0
        ? {
            action: 'click',
            role: 'button',
            name: 'Buscar',
            rationale: 'Voy a probar la búsqueda.',
            results: [],
          }
        : {
            action: 'finish',
            role: 'none',
            name: '',
            rationale: 'La búsqueda respondió.',
            results: [{ id: 'AC1', status: 'pass' }],
          };
    writeFileSync(
      join(step, 'agent.log'),
      [
        { type: 'thread.started', thread_id: `thread-${number}` },
        { type: 'item.completed', item: { type: 'reasoning', text: 'private reasoning' } },
        { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(decision) } },
        ...(number === 0
          ? [
              {
                type: 'item.completed',
                item: {
                  type: 'command_execution',
                  command: 'pwd',
                  aggregated_output: '/tmp',
                  status: 'completed',
                },
              },
            ]
          : []),
      ]
        .map((event) => JSON.stringify(event))
        .join('\n') + '\n',
    );
  }
  writeFileSync(
    join(qa, 'actions.json'),
    JSON.stringify([
      { action: { action: 'click', role: 'button', name: 'Buscar' }, outcome: 'Action executed' },
    ]),
  );
  writeFileSync(join(qa, 'qa.json'), JSON.stringify({ passed: true }));
  const agents = localAgents(root);
  expect(agents).toHaveLength(1);
  expect(agents[0]?.role).toBe('qa');
  expect(agents[0]?.status).toBe('passed');
  expect(agents[0]?.sessionId).toBeNull();
  const path = qaDirectoryForAgent(root, agents[0]?.id ?? '');
  expect(path).toBe(qa);
  const items = qaTraceItems(path ?? '');
  expect(items.map((item) => item.title)).toEqual([
    'Decisión 1',
    'Controlador · estado del navegador',
    'QA · decisión',
    'pwd',
    'Controlador · Playwright · click',
    'Decisión 2',
    'Controlador · estado del navegador',
    'QA · decisión',
    'QA · veredicto',
  ]);
  expect(items.find((item) => item.title === 'QA · decisión')?.body).toBe(
    'Voy a probar la búsqueda.',
  );
  expect(JSON.stringify(items)).not.toContain('private reasoning');
  expect(qaTracePage(qa).items).toEqual(items);
});
