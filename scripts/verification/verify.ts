import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync, writeFileSync, writeSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

export type CheckDefinition = {
  id: string;
  command: [string, ...string[]];
};

export type CheckResult = CheckDefinition & {
  status: 'passed' | 'failed' | 'timed_out' | 'not_run';
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  stdoutPath: string;
  stderrPath: string;
  error?: string;
};

export type VerificationOptions = {
  root: string;
  output: string;
  timeoutSeconds?: number;
  browser?: boolean;
  env?: Record<string, string>;
  /** Permite comprobar el ejecutor con comandos aislados. */
  checks?: CheckDefinition[];
};

export type VerificationResult = {
  schemaVersion: 1;
  root: string;
  startedAt: string;
  finishedAt: string;
  timeoutSeconds: number;
  passed: boolean;
  checks: CheckResult[];
};

export function defaultChecks(browser = false): CheckDefinition[] {
  const checks: CheckDefinition[] = [
    { id: 'lint', command: ['bun', 'run', 'lint'] },
    { id: 'typecheck', command: ['bun', 'run', 'typecheck'] },
    { id: 'tests', command: ['bun', 'run', 'test'] },
  ];
  if (browser) checks.push({ id: 'browser', command: ['bun', 'run', 'test:browser'] });
  return checks;
}

/** Kill the whole check process group, including runners or servers it spawned. */
function killProcessGroup(child: ReturnType<typeof spawn>): void {
  if (child.pid === undefined) return;
  try {
    if (process.platform === 'win32') child.kill('SIGKILL');
    else process.kill(-child.pid, 'SIGKILL');
  } catch {
    // The process may have exited between the timer firing and the signal.
    child.kill('SIGKILL');
  }
}

async function runCheck(
  check: CheckDefinition,
  options: VerificationOptions,
  timeoutSeconds: number,
): Promise<CheckResult> {
  const stdoutPath = resolve(options.output, `${check.id}.stdout.log`);
  const stderrPath = resolve(options.output, `${check.id}.stderr.log`);
  const stdout = openSync(stdoutPath, 'w');
  const stderr = openSync(stderrPath, 'w');
  const started = performance.now();
  const base = { ...check, stdoutPath, stderrPath };
  try {
    return await new Promise<CheckResult>((resolveResult) => {
      let timedOut = false;
      const child = spawn(check.command[0], check.command.slice(1), {
        cwd: options.root,
        env: { ...process.env, FORCE_COLOR: '0', ...options.env },
        shell: false,
        detached: process.platform !== 'win32',
        // Pipes keep private controller file descriptors out of the candidate sandbox.
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout?.on('data', (chunk: Buffer) => writeSync(stdout, chunk));
      child.stderr?.on('data', (chunk: Buffer) => writeSync(stderr, chunk));
      const timer = setTimeout(() => {
        timedOut = true;
        killProcessGroup(child);
      }, timeoutSeconds * 1000);
      child.once('error', (error) => {
        clearTimeout(timer);
        resolveResult({
          ...base,
          status: 'not_run',
          exitCode: null,
          signal: null,
          durationMs: Math.round(performance.now() - started),
          error: error.message,
        });
      });
      child.once('close', (exitCode, signal) => {
        clearTimeout(timer);
        resolveResult({
          ...base,
          status: timedOut ? 'timed_out' : exitCode === 0 ? 'passed' : 'failed',
          exitCode,
          signal,
          durationMs: Math.round(performance.now() - started),
        });
      });
    });
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
}

function validateChecks(checks: CheckDefinition[]): void {
  if (checks.length === 0) throw new Error('Verification needs at least one check.');
  const names = new Set<string>();
  for (const check of checks) {
    if (!/^[a-z][a-z0-9-]*$/.test(check.id) || names.has(check.id)) {
      throw new Error(`Check ids must be unique, safe filenames: ${check.id}`);
    }
    if (!check.command[0]) throw new Error(`Missing executable for check ${check.id}`);
    names.add(check.id);
  }
}

/** Run every check even after failures; a non-executed or timed-out check never passes. */
export async function runVerification(options: VerificationOptions): Promise<VerificationResult> {
  const timeoutSeconds = options.timeoutSeconds ?? 600;
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error('timeoutSeconds must be a positive finite number.');
  }
  const definitions = options.checks ?? defaultChecks(options.browser);
  validateChecks(definitions);
  const root = resolve(options.root);
  const output = resolve(options.output);
  mkdirSync(output, { recursive: true });
  const startedAt = new Date().toISOString();
  const checks: CheckResult[] = [];
  for (const definition of definitions) {
    checks.push(await runCheck(definition, { ...options, root, output }, timeoutSeconds));
  }
  const result: VerificationResult = {
    schemaVersion: 1,
    root,
    startedAt,
    finishedAt: new Date().toISOString(),
    timeoutSeconds,
    passed: checks.every((check) => check.status === 'passed'),
    checks,
  };
  writeFileSync(resolve(output, 'verification.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: 'string' },
      output: { type: 'string' },
      'timeout-seconds': { type: 'string', default: '600' },
      browser: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(
      'verify [--root DIR] [--output DIR] [--timeout-seconds N] [--browser]\n' +
        'Runs lint, typecheck and the full deterministic test suite; --browser adds isolated browser tests.\n' +
        'Timeout applies separately to each check. JSON and stdout/stderr logs are saved in output.',
    );
    return;
  }
  const root = resolve(values.root ?? process.cwd());
  const output = resolve(
    values.output ??
      `${root}/.tmp/verification/${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`,
  );
  const result = await runVerification({
    root,
    output,
    timeoutSeconds: Number(values['timeout-seconds']),
    browser: values.browser,
  });
  for (const check of result.checks) {
    console.log(`${check.id}: ${check.status} (${check.durationMs} ms)`);
  }
  console.log(`Evidence: ${resolve(output, 'verification.json')}`);
  process.exitCode = result.passed ? 0 : 1;
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
