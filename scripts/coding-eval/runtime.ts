import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { type Compactions, collectCodexCompactions } from './compactions';
import { type CandidateCheck, JUDGE } from './config';
import { isolatedEnvironment, withCandidateIsolation } from './isolation';
import { judgmentOutputSchema } from './judge';
import { cleanupFixtureServers, type FixtureCleanup } from './process-cleanup';
import { personalSkillOverride } from './skill-isolation';
import { analyzeEvents } from './trace';

export type AgentOptions = {
  root: string;
  output: string;
  prompt: string;
  harness: 'codex' | 'opencode';
  model: string;
  effort: string;
  timeoutSeconds: number | null;
  maxSteps: number;
  /** Stop OpenCode after a completed step reaches this reported USD amount; one request may overshoot. */
  maxReportedCostUsd?: number;
  schema?: object;
  readOnly?: boolean;
  env?: Record<string, string>;
  privateReadRoots?: string[];
  candidateChecks?: CandidateCheck[];
};

export type AgentResult = {
  status: 'completed' | 'failed' | 'timed_out' | 'cancelled';
  exitSignal?: NodeJS.Signals | null;
  exitCode: number | null;
  eventsPath: string;
  stdoutPath: string;
  stderrPath: string;
  finalPath: string;
  durationMs: number;
  command: string[];
  budgetExceeded?: boolean;
  fixtureCleanup?: FixtureCleanup;
  compactions?: Compactions;
  compactionsPath?: string;
};

/** The environment is used for authentication but never serialized into run artifacts. */
function agentEnvironment(options: AgentOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...options.env, FORCE_COLOR: '0' };
  if (options.harness !== 'opencode') return env;
  delete env.OPENCODE_CONFIG;
  delete env.OPENCODE_CONFIG_DIR;
  const configDirectory = resolve(options.output, 'opencode-config');
  mkdirSync(configDirectory, { recursive: true, mode: 0o700 });
  const dataDirectory = resolve(options.output, 'opencode-data');
  const authDirectory = resolve(dataDirectory, 'opencode');
  mkdirSync(authDirectory, { recursive: true, mode: 0o700 });
  const authSource = resolve(
    env.XDG_DATA_HOME ?? resolve(homedir(), '.local/share'),
    'opencode/auth.json',
  );
  const authLink = resolve(authDirectory, 'auth.json');
  // Reuse credentials without copying their contents or opening the user's session database.
  if (existsSync(authSource) && !existsSync(authLink)) symlinkSync(authSource, authLink);
  const skillsDirectory = resolve(options.root, '.agents/skills');
  const selectedSkills = existsSync(skillsDirectory)
    ? readdirSync(skillsDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
  return {
    ...env,
    XDG_CONFIG_HOME: configDirectory,
    XDG_DATA_HOME: dataDirectory,
    OPENCODE_DISABLE_PROJECT_CONFIG: 'true',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
    OPENCODE_DISABLE_EXTERNAL_SKILLS: 'true',
    OPENCODE_DISABLE_CLAUDE_CODE_PROMPT: 'true',
    OPENCODE_DISABLE_AUTOUPDATE: 'true',
    OPENCODE_DISABLE_SHARE: 'true',
    OPENCODE_CONFIG_CONTENT: JSON.stringify({
      $schema: 'https://opencode.ai/config.json',
      autoupdate: false,
      share: 'disabled',
      skills: { paths: [skillsDirectory] },
      agent: { build: { steps: options.maxSteps } },
      permission: {
        '*': 'deny',
        read: { '*': 'allow', '**/.env*': 'deny' },
        glob: 'allow',
        grep: 'allow',
        list: 'allow',
        skill: Object.fromEntries([
          ['*', 'deny'],
          ...selectedSkills.map((name) => [name, 'allow']),
        ]),
        edit: 'allow',
        write: 'allow',
        apply_patch: 'allow',
        bash: 'allow',
        todoread: 'allow',
        todowrite: 'allow',
        external_directory: 'deny',
      },
    }),
  };
}

/** Redact known credential values even when a value straddles stream chunks. */
function redactor(env: NodeJS.ProcessEnv): (text: string) => string {
  const secrets = Object.entries(env)
    .filter(
      ([name, value]) => /key|token|secret|password/i.test(name) && value && value.length >= 8,
    )
    .map(([, value]) => value)
    .filter((value): value is string => value !== undefined);
  return (text) => {
    let safe = text;
    for (const value of secrets) safe = safe.replaceAll(value, '[REDACTED]');
    return safe;
  };
}

function captureLines(stream: Readable, receive: (line: string) => void): () => void {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => {
    pending += chunk;
    let newline = pending.indexOf('\n');
    while (newline >= 0) {
      receive(pending.slice(0, newline));
      pending = pending.slice(newline + 1);
      newline = pending.indexOf('\n');
    }
  });
  return () => {
    if (pending) receive(pending);
    pending = '';
  };
}

function prepareCodexHome(harness: AgentOptions['harness'], env: NodeJS.ProcessEnv) {
  // Authentication/model metadata are reused; personal guidance, skills and rules are not experimental inputs.
  const codexHome =
    harness === 'codex' ? mkdtempSync(resolve(tmpdir(), 'coding-eval-codex-')) : null;
  if (codexHome) {
    const originalHome = env.CODEX_HOME ?? resolve(homedir(), '.codex');
    for (const name of ['auth.json', 'models_cache.json']) {
      const source = resolve(originalHome, name);
      if (existsSync(source)) symlinkSync(source, resolve(codexHome, name));
    }
    env.CODEX_HOME = codexHome;
  }
  return codexHome;
}

function agentArguments(
  options: AgentOptions,
  finalPath: string,
  permissionArgs: string[],
): string[] {
  if (options.harness === 'opencode') {
    if (options.schema || options.readOnly) {
      throw new Error('Structured read-only evaluation uses Codex, not OpenCode.');
    }
    return [
      'run',
      '--pure',
      '--format',
      'json',
      '--dir',
      resolve(options.root),
      '--agent',
      'build',
      '--model',
      options.model,
      ...(options.effort === 'default' ? [] : ['--variant', options.effort]),
      '--title',
      'Coding evaluation',
    ];
  }
  const args = [
    'exec',
    '--ignore-user-config',
    '--json',
    '--color',
    'never',
    '--cd',
    resolve(options.root),
    '--model',
    options.model,
    ...(permissionArgs.length
      ? permissionArgs
      : ['--sandbox', options.readOnly ? 'read-only' : 'workspace-write']),
    '-c',
    `model_reasoning_effort=${JSON.stringify(options.effort)}`,
    '-c',
    'approval_policy="never"',
    '-c',
    `web_search=${JSON.stringify(options.readOnly ? 'disabled' : 'live')}`,
    ...(permissionArgs.length ? [] : ['-c', 'sandbox_workspace_write.network_access=true']),
    '-c',
    personalSkillOverride(),
    '--output-last-message',
    finalPath,
  ];
  if (options.schema) {
    const schemaPath = resolve(options.output, 'output-schema.json');
    writeFileSync(schemaPath, `${JSON.stringify(options.schema, null, 2)}\n`, { mode: 0o600 });
    args.push('--output-schema', schemaPath);
  }
  args.push('-');
  return args;
}

function terminate(child: ReturnType<typeof spawn>): void {
  if (child.pid === undefined) return;
  try {
    if (process.platform === 'win32') child.kill('SIGKILL');
    else process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

function reportedStepCost(event: unknown): number {
  const step = event as { type?: string; part?: { cost?: unknown } } | null;
  const cost = step?.type === 'step_finish' ? step.part?.cost : undefined;
  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : 0;
}

function validateAgentOptions(options: AgentOptions): void {
  if (
    options.timeoutSeconds !== null &&
    (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds <= 0)
  ) {
    throw new Error('timeoutSeconds must be null or positive.');
  }
  if (!Number.isInteger(options.maxSteps) || options.maxSteps < 1) {
    throw new Error('maxSteps must be a positive integer.');
  }
  if (
    options.maxReportedCostUsd !== undefined &&
    (!Number.isFinite(options.maxReportedCostUsd) || options.maxReportedCostUsd <= 0)
  )
    throw new Error('maxReportedCostUsd must be positive.');
}

/** Runs the real CLI; commandPrefix permits an executable fixture without changing global PATH. */
async function runAgentImpl(
  options: AgentOptions,
  commandPrefix: [string, ...string[]] = [
    options.harness === 'codex' ? (process.env.EVAL_CODEX_BIN ?? 'codex') : options.harness,
  ],
  permissionArgs: string[] = [],
): Promise<AgentResult> {
  validateAgentOptions(options);
  const output = resolve(options.output);
  mkdirSync(output, { recursive: true });
  const paths = {
    eventsPath: resolve(output, 'events.jsonl'),
    stdoutPath: resolve(output, 'stdout.log'),
    stderrPath: resolve(output, 'stderr.log'),
    finalPath: resolve(output, 'final.txt'),
  };
  if (Object.values(paths).some(existsSync)) {
    throw new Error('Agent output already exists; use a fresh directory for each run.');
  }
  const normalized = { ...options, output };
  const command = [
    ...commandPrefix,
    ...agentArguments(normalized, paths.finalPath, permissionArgs),
  ];
  const env = agentEnvironment(normalized);
  const codexHome = prepareCodexHome(options.harness, env);
  const redact = redactor(env);
  const stdout = openSync(paths.stdoutPath, 'wx', 0o600);
  const stderr = openSync(paths.stderrPath, 'wx', 0o600);
  const eventFile = openSync(paths.eventsPath, 'wx', 0o600);
  const events: unknown[] = [];
  const started = performance.now();
  let timedOut = false;
  let launchFailed = false;
  let reportedCost = 0;
  let budgetExceeded = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let fixtureCleanup: FixtureCleanup | undefined;
  try {
    exitCode = await new Promise<number | null>((resolveExit) => {
      const child = spawn(commandPrefix[0], command.slice(1), {
        cwd: resolve(options.root),
        env,
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const flushOutput = captureLines(child.stdout, (raw) => {
        const line = redact(raw);
        writeSync(stdout, `${line}\n`);
        try {
          const event: unknown = JSON.parse(line);
          events.push(event);
          writeSync(eventFile, `${line}\n`);
          if (options.harness === 'opencode' && options.maxReportedCostUsd !== undefined) {
            reportedCost += reportedStepCost(event);
            if (reportedCost >= options.maxReportedCostUsd) {
              budgetExceeded = true;
              terminate(child);
            }
          }
        } catch {
          // Startup messages remain in stdout; only JSON events enter the trace analyzer.
        }
      });
      const flushErrors = captureLines(child.stderr, (line) => {
        writeSync(stderr, `${redact(line)}\n`);
      });
      const timer =
        options.timeoutSeconds === null
          ? null
          : setTimeout(() => {
              timedOut = true;
              terminate(child);
            }, options.timeoutSeconds * 1000);
      child.once('error', (error) => {
        launchFailed = true;
        writeSync(stderr, `${redact(error.message)}\n`);
      });
      // Exit occurs before close: descendants may otherwise keep inherited output pipes open.
      child.once('exit', () => terminate(child));
      child.once('close', (code, signal) => {
        exitSignal = signal;
        if (timer !== null) clearTimeout(timer);
        flushOutput();
        flushErrors();
        resolveExit(code);
      });
      // An early CLI failure may close stdin before receiving the prompt; close/error determines status.
      child.stdin.on('error', () => {});
      child.stdin.end(options.prompt);
    });
  } finally {
    closeSync(stdout);
    closeSync(stderr);
    closeSync(eventFile);
    if (!options.readOnly) fixtureCleanup = await cleanupFixtureServers(options.root);
  }
  const trace = analyzeEvents(events);
  const compactions = codexHome
    ? collectCodexCompactions(codexHome, trace.sessionId)
    : trace.compactions;
  const compactionsPath = resolve(output, 'compactions.json');
  writeFileSync(compactionsPath, `${JSON.stringify(compactions, null, 2)}\n`, { mode: 0o600 });
  // The public JSON events remain; private rollout payloads and credential links do not.
  if (codexHome) rmSync(codexHome, { recursive: true, force: true });
  const final = redact(
    existsSync(paths.finalPath) ? readFileSync(paths.finalPath, 'utf8') : trace.finalResponse,
  );
  writeFileSync(paths.finalPath, final, { mode: 0o600 });
  return {
    ...paths,
    command,
    compactions,
    compactionsPath,
    durationMs: Math.round(performance.now() - started),
    exitCode: launchFailed ? null : exitCode,
    exitSignal,
    budgetExceeded,
    fixtureCleanup,
    status: timedOut
      ? 'timed_out'
      : exitSignal === 'SIGINT' || exitSignal === 'SIGTERM'
        ? 'cancelled'
        : !launchFailed && !budgetExceeded && exitCode === 0 && trace.completed && final.trim()
          ? 'completed'
          : 'failed',
  };
}

export function runAgent(
  options: AgentOptions,
  commandPrefix?: [string, ...string[]],
): Promise<AgentResult> {
  if (options.privateReadRoots?.length && !options.readOnly) {
    if (options.harness !== 'codex')
      throw new Error('Private candidate read isolation currently requires Codex.');
    const executable = commandPrefix?.[0] ?? process.env.EVAL_CODEX_BIN ?? 'codex';
    return withCandidateIsolation(
      options.root,
      options.privateReadRoots,
      executable,
      (args, root) =>
        runAgentImpl(
          { ...options, root, env: isolatedEnvironment(options.env ?? {}, options.root, root) },
          commandPrefix,
          args,
        ),
      { checks: options.candidateChecks, env: options.env },
    );
  }
  return runAgentImpl(options, commandPrefix);
}

/** The evaluator identity is fixed independently of candidate model/effort settings. */
export function runJudge(
  options: Omit<AgentOptions, 'harness' | 'model' | 'effort' | 'schema' | 'readOnly'>,
  commandPrefix?: [string, ...string[]],
): Promise<AgentResult> {
  return runAgent(
    { ...options, ...JUDGE, schema: judgmentOutputSchema, readOnly: true },
    commandPrefix,
  );
}
