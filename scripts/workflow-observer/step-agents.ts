import type { WorkflowAgent, WorkflowRun, WorkflowStep } from './contracts';

const agentPhases: Record<string, string> = {
  'research-product': 'research',
  'research-verification': 'research',
  planner: 'planning',
  implementer: 'implementing',
  candidate: 'implementing',
  reviewer: 'reviewing',
  qa: 'qa',
};

/** Repeated rounds can revisit a phase, so use the agent's start time to find its occurrence. */
function stepForAgent(steps: WorkflowStep[], agent: WorkflowAgent): WorkflowStep | undefined {
  const phase = agentPhases[agent.role];
  const matches = steps.filter((step) => step.phase === phase);
  if (matches.length === 1) return matches[0];
  if (!matches.length || !agent.startedAt) return undefined;
  const started = Date.parse(agent.startedAt);
  if (Number.isNaN(started)) return undefined;
  return matches.filter((step) => step.at && Date.parse(step.at) <= started).at(-1) ?? matches[0];
}

/** Keep every session visible, including those whose phase cannot be established. */
export function placeAgents(run: Pick<WorkflowRun, 'agents' | 'steps'>) {
  const byStep = new Map<string, WorkflowAgent[]>();
  const unplaced: WorkflowAgent[] = [];
  for (const agent of run.agents) {
    const step = stepForAgent(run.steps, agent);
    if (!step) {
      unplaced.push(agent);
      continue;
    }
    const agents = byStep.get(step.id) ?? [];
    agents.push(agent);
    byStep.set(step.id, agents);
  }
  return { byStep, unplaced };
}
