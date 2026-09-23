import { readFileSync } from 'node:fs';
import { codexExecutable } from '../coding-eval/codex-executable';
import { personalSkillOverride } from '../coding-eval/skill-isolation';
import type { HarnessAdapter, HarnessInvocation } from './harness';
import { execute } from './process';

export function codexCommand(invocation: HarnessInvocation): string[] {
  const command = [
    codexExecutable(),
    'exec',
    '--ignore-user-config',
    ...(invocation.persistSession ? [] : ['--ephemeral']),
    '--json',
    '--color',
    'never',
    ...(invocation.permissionArgs ?? [
      '--sandbox',
      invocation.access === 'write' ? 'workspace-write' : 'read-only',
    ]),
    '-c',
    'approval_policy="never"',
    '-c',
    'web_search="disabled"',
    '-c',
    personalSkillOverride(),
    '--output-schema',
    invocation.schemaPath,
    '--output-last-message',
    invocation.resultPath,
  ];
  // Allow the local app and the connection to the controller-owned Playwright browser.
  if (invocation.access === 'write' && !invocation.permissionArgs)
    command.push('-c', 'sandbox_workspace_write.network_access=true');
  if (invocation.model) command.push('--model', invocation.model);
  if (invocation.reasoningEffort)
    command.push('-c', `model_reasoning_effort=${JSON.stringify(invocation.reasoningEffort)}`);
  for (const image of invocation.images) command.push('--image', image);
  command.push('-');
  return command;
}

export const codexHarness: HarnessAdapter = {
  images: true,
  async run(invocation) {
    await execute(codexCommand(invocation), {
      cwd: invocation.root,
      log: invocation.logPath,
      input: invocation.prompt,
      env: { ...process.env, ...invocation.env, LOCAL_WORKFLOW_WORKER: '1' },
      timeoutMs: invocation.timeoutMs,
    });
    return JSON.parse(readFileSync(invocation.resultPath, 'utf8'));
  },
};
