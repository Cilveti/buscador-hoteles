import { z } from 'zod';

export const workflowDefinitionSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    title: z.string().min(1),
    description: z.string().min(1),
    engine: z.enum(['local-workflow', 'coding-eval']),
    stages: z.array(z.string().min(1)).min(1),
    launchable: z.boolean(),
  })
  .strict();
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'blocked' | 'unknown';
export type WorkflowSource = 'local' | 'evaluation';
export type WorkflowAgent = {
  id: string;
  role: string;
  harness: string;
  model: string | null;
  status: StepStatus;
  startedAt: string | null;
  durationMs: number | null;
  traceAvailable: boolean;
  output: string | null;
  sessionId: string | null;
  resumeCommand: string | null;
};
export type WorkflowStep = {
  id: string;
  phase: string;
  title: string;
  status: StepStatus;
  at: string | null;
  message: string;
};
export type WorkflowCheck = {
  id: string;
  group: string;
  status: StepStatus;
  durationMs: number | null;
};
export type WorkflowHandoff = {
  id: string;
  kind: 'feedback' | 'review' | 'qa';
  title: string;
  content: string;
};
/** UI-facing projection. Unknown evidence stays unknown; it never becomes a green check. */
export type WorkflowRun = {
  ref: string;
  source: WorkflowSource;
  definitionId: string;
  title: string;
  runId: string;
  status: StepStatus;
  rawStatus: string;
  message: string;
  startedAt: string | null;
  updatedAt: string | null;
  round: number | null;
  score: number | null;
  agents: WorkflowAgent[];
  steps: WorkflowStep[];
  checks: WorkflowCheck[];
  handoffs: WorkflowHandoff[];
  artifacts: { id: string; label: string; available: boolean }[];
};
