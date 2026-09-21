import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { runVerification, type VerificationResult } from '../verification/verify';
import { callAgent } from './agents';
import { implementationSchema, planSchema, researchSchema, reviewSchema } from './contracts';
import { assertCandidateUnchanged, candidatePatch, digest } from './policy';
import { taskPrompt } from './prompts';
import { availablePort, runQa, withBrowserChecks } from './qa';
import { writeDelivery } from './report';
import type { WorkflowState } from './run-state';

type ImplementationInput = {
  task: { id: string; instructions: string };
  feedback: string;
  output: string;
  attempt: number;
};

/** Concrete I/O for each phase; the controller owns ordering, retries and stopping decisions. */
export const localStages = {
  async verify(state: WorkflowState, output: string) {
    const frozen = digest(candidatePatch(state));
    const port = await availablePort();
    const checks = await runVerification({
      root: state.workspace,
      output,
      browser: true,
      profile: 'app',
      timeoutSeconds: 180,
      env: { TEST_BROWSER_PORT: String(port), TEST_BROWSER_OUTPUT: join(output, 'browser') },
    });
    assertCandidateUnchanged(state, frozen);
    return checks;
  },

  research(state: WorkflowState) {
    return Promise.all(
      (['research-product', 'research-verification'] as const).map((role) =>
        callAgent(
          state.agents,
          {
            role,
            root: state.workspace,
            output: join(state.directory, role),
            prompt: taskPrompt(role, state.spec),
          },
          researchSchema,
        ),
      ),
    );
  },

  plan(state: WorkflowState, research: z.infer<typeof researchSchema>[]) {
    return callAgent(
      state.agents,
      {
        role: 'planner',
        root: state.workspace,
        output: join(state.directory, 'plan'),
        prompt: taskPrompt('planner', state.spec, { RESEARCH: research }),
      },
      planSchema,
    );
  },

  writePlan(state: WorkflowState) {
    if (!state.plan) throw new Error('Missing implementation plan');
    writeFileSync(
      join(state.directory, 'plan.md'),
      `# Plan\n\n${state.plan.summary}\n\n${state.plan.tasks
        .map(
          (task) =>
            `## ${task.id}: ${task.title}\n${task.instructions}\n\nCriterios: ${task.criteria.join(', ')}`,
        )
        .join('\n\n')}`,
    );
  },

  implement(state: WorkflowState, { task, feedback, output, attempt }: ImplementationInput) {
    const checksOutput = join(
      state.workspace,
      '.tmp',
      `self-check-${state.round}-${task.id}-${attempt}`,
    );
    return withBrowserChecks(checksOutput, (env) =>
      callAgent(
        state.agents,
        {
          role: 'implementer',
          root: state.workspace,
          output: join(output, 'agent'),
          edit: true,
          env,
          prompt: taskPrompt('implementer', state.spec, {
            MODE: state.mode,
            'SCOPE / PLAN': state.plan,
            'CURRENT ASSIGNMENT': task.instructions,
            PROGRESS: state.completedTasks,
            'PREVIOUS FEEDBACK': feedback,
          }),
        },
        implementationSchema,
      ),
    );
  },

  checkFeedback(checks: VerificationResult): string {
    return checks.checks
      .filter((check) => check.status !== 'passed')
      .map(
        (check) =>
          `${check.id}: ${check.status}\n${readFileSync(check.stdoutPath, 'utf8').slice(-12000)}\n${readFileSync(check.stderrPath, 'utf8').slice(-8000)}`,
      )
      .join('\n');
  },

  review(state: WorkflowState, patch: string, roundDirectory: string) {
    return callAgent(
      state.agents,
      {
        role: 'reviewer',
        root: state.workspace,
        output: join(roundDirectory, 'review'),
        prompt: taskPrompt('reviewer', state.spec, {
          'VERIFIED PATCH SHA256': digest(patch),
          DIFF: patch,
        }),
      },
      reviewSchema,
    );
  },

  qa(state: WorkflowState, roundDirectory: string) {
    return runQa({
      agents: state.agents,
      root: state.workspace,
      output: join(roundDirectory, 'qa'),
      spec: state.spec,
      headed: state.headed,
    });
  },

  deliver: writeDelivery,
};

export type WorkflowStages = typeof localStages;
