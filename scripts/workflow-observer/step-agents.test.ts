import { expect, test } from 'bun:test';
import type { WorkflowAgent, WorkflowStep } from './contracts';
import { placeAgents } from './step-agents';

function step(id: string, phase: string, at: string): WorkflowStep {
  return { id, phase, at, title: phase, status: 'passed', message: '' };
}

function agent(id: string, role: string, startedAt: string | null): WorkflowAgent {
  return {
    id,
    role,
    startedAt,
    harness: 'codex',
    model: null,
    status: 'passed',
    durationMs: null,
    traceAvailable: true,
    output: null,
    sessionId: null,
    resumeCommand: null,
  };
}

test('places agents in the right occurrence of a repeated phase', () => {
  const run = {
    steps: [
      step('research', 'research', '2026-09-23T10:00:00Z'),
      step('first', 'implementing', '2026-09-23T10:10:00Z'),
      step('review', 'reviewing', '2026-09-23T10:20:00Z'),
      step('second', 'implementing', '2026-09-23T10:30:00Z'),
    ],
    agents: [
      agent('researcher', 'research-product', '2026-09-23T10:01:00Z'),
      agent('initial', 'implementer', '2026-09-23T10:11:00Z'),
      agent('reviewer', 'reviewer', '2026-09-23T10:21:00Z'),
      agent('repair', 'implementer', '2026-09-23T10:31:00Z'),
    ],
  };
  const placed = placeAgents(run);
  expect(
    [...placed.byStep.entries()].map(([id, agents]) => [id, agents.map((item) => item.id)]),
  ).toEqual([
    ['research', ['researcher']],
    ['first', ['initial']],
    ['review', ['reviewer']],
    ['second', ['repair']],
  ]);
  expect(placed.unplaced).toEqual([]);
});

test('does not invent a phase when attribution is ambiguous', () => {
  const placed = placeAgents({
    steps: [
      step('first', 'implementing', '2026-09-23T10:10:00Z'),
      step('second', 'implementing', '2026-09-23T10:30:00Z'),
    ],
    agents: [agent('missing-time', 'implementer', null), agent('unknown-role', 'other', null)],
  });
  expect(placed.byStep.size).toBe(0);
  expect(placed.unplaced.map((item) => item.id)).toEqual(['missing-time', 'unknown-role']);
});
