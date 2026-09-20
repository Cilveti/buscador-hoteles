import { readFileSync } from 'node:fs';
import type { HarnessAdapter, HarnessInvocation } from './harness';
import { execute } from './process';

export function codexCommand(invocation: HarnessInvocation): string[] {
  const command = [
    'codex',
    'exec',
    '--ignore-user-config',
    '--ephemeral',
    '--json',
    '--color',
    'never',
    '--sandbox',
    invocation.access === 'write' ? 'workspace-write' : 'read-only',
    '-c',
    'approval_policy="never"',
    '-c',
    'web_search="disabled"',
    '--output-schema',
    invocation.schemaPath,
    '--output-last-message',
    invocation.resultPath,
  ];
  if (invocation.model) command.push('--model', invocation.model);
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
      env: { ...process.env, LOCAL_WORKFLOW_WORKER: '1' },
      timeoutMs: invocation.timeoutMs,
    });
    return JSON.parse(readFileSync(invocation.resultPath, 'utf8'));
  },
};
