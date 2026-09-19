import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type AgentOptions, runAgent, runJudge } from './runtime';

const roots: string[] = [];
function fixture(code: string, extra: Partial<AgentOptions> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'coding-runtime-'));
  roots.push(root);
  const script = join(root, 'fake-cli.ts');
  writeFileSync(script, code);
  const options: AgentOptions = {
    root,
    output: join(root, 'result'),
    prompt: 'Implementa la tarea; verifica después. $(literal)',
    harness: 'codex',
    model: 'test-model',
    effort: 'high',
    timeoutSeconds: 2,
    maxSteps: 5,
    ...extra,
  };
  const command: [string, ...string[]] = [process.execPath, script];
  return { options, command };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('captures stdin, large JSON lines and final Codex message without argv prompt exposure', async () => {
  const f = fixture(`
    const prompt = await Bun.stdin.text();
    console.log(JSON.stringify({ type:'item.completed', item:{type:'agent_message',text:prompt+'x'.repeat(100000)} }));
    console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:2}}));
  `);
  const result = await runAgent(f.options, f.command);
  expect(result.status).toBe('completed');
  expect(result.command).not.toContain(f.options.prompt);
  expect(readFileSync(result.finalPath, 'utf8')).toBe(`${f.options.prompt}${'x'.repeat(100000)}`);
  expect(readFileSync(result.eventsPath, 'utf8').trim().split('\n')).toHaveLength(2);
});

test('provider errors fail a run even when CLI exits zero after a final answer', async () => {
  const f = fixture(
    `
    await Bun.stdin.text();
    console.log(JSON.stringify({type:'text',part:{text:'Done'}}));
    console.log(JSON.stringify({type:'step_finish',part:{reason:'stop'}}));
    console.log(JSON.stringify({type:'error',error:{message:'provider failure'}}));
  `,
    { harness: 'opencode', model: 'test/model' },
  );
  const result = await runAgent(f.options, f.command);
  expect(result.status).toBe('failed');
  expect(result.exitCode).toBe(0);
  expect(readFileSync(result.finalPath, 'utf8')).toBe('Done');
});

test('timeout keeps partial events, and nonzero CLI exit remains failed', async () => {
  const hung = fixture(
    `
    await Bun.stdin.text();
    console.log(JSON.stringify({type:'thread.started',thread_id:'fixture'}));
    setInterval(() => {},1000);
  `,
    { timeoutSeconds: 0.15 },
  );
  const timeout = await runAgent(hung.options, hung.command);
  expect(timeout.status).toBe('timed_out');
  expect(readFileSync(timeout.eventsPath, 'utf8')).toContain('thread.started');
  const failed = fixture('console.error("CLI failed"); process.exit(9);');
  const failure = await runAgent(failed.options, failed.command);
  expect(failure.status).toBe('failed');
  expect(failure.exitCode).toBe(9);
  expect(readFileSync(failure.stderrPath, 'utf8')).toContain('CLI failed');
});

test('null timeout lets a candidate finish naturally after asynchronous work', async () => {
  const f = fixture(
    `
    await Bun.stdin.text();
    console.log(JSON.stringify({type:'thread.started',thread_id:'unlimited'}));
    await Bun.sleep(200);
    console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Finished after waiting'}}));
    console.log(JSON.stringify({type:'turn.completed'}));
  `,
    { timeoutSeconds: null },
  );
  const result = await runAgent(f.options, f.command);
  expect(result.status).toBe('completed');
  expect(result.exitCode).toBe(0);
  expect(result.exitSignal).toBeNull();
  expect(result.durationMs).toBeGreaterThanOrEqual(200);
  expect(readFileSync(result.finalPath, 'utf8')).toBe('Finished after waiting');
});

test.skipIf(process.platform === 'win32')(
  'a signalled CLI is cancellation, not a completed final report',
  async () => {
    const f = fixture(
      `
    await Bun.stdin.text();
    console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Still implementing'}}));
    process.kill(process.pid, 'SIGTERM');
  `,
      { timeoutSeconds: null },
    );
    const result = await runAgent(f.options, f.command);
    expect(result.status).toBe('cancelled');
    expect(result.exitSignal).toBe('SIGTERM');
    expect(readFileSync(result.finalPath, 'utf8')).toBe('Still implementing');
  },
);

test('missing executable fails without hanging or inventing a successful completion', async () => {
  const f = fixture('');
  const result = await runAgent(f.options, ['/nonexistent/coding-eval-cli']);
  expect(result.status).toBe('failed');
  expect(result.exitCode).toBeNull();
});

test('OpenCode keeps auth home while isolating settings and redacts secrets across chunks', async () => {
  const f = fixture(
    `
    await Bun.stdin.text();
    const key = process.env.FIXTURE_API_KEY;
    process.stdout.write(JSON.stringify({type:'text',part:{text:key}}).slice(0,35));
    await Bun.sleep(10);
    process.stdout.write(JSON.stringify({type:'text',part:{text:key}}).slice(35)+'\\n');
    console.log(JSON.stringify({type:'step_finish',part:{reason:'stop'}}));
    console.error(JSON.stringify({home:process.env.HOME,data:process.env.XDG_DATA_HOME, config:process.env.XDG_CONFIG_HOME,steps:JSON.parse(process.env.OPENCODE_CONFIG_CONTENT).agent.build.steps,skills:JSON.parse(process.env.OPENCODE_CONFIG_CONTENT).permission.skill}));
  `,
    {
      harness: 'opencode',
      model: 'test/model',
      env: { FIXTURE_API_KEY: 'fixture-secret-never-persist' },
    },
  );
  const authSource = join(f.options.root, 'original-data', 'opencode');
  mkdirSync(authSource, { recursive: true });
  writeFileSync(join(authSource, 'auth.json'), '{}');
  mkdirSync(join(f.options.root, '.agents/skills/selected-skill'), { recursive: true });
  f.options.env = { ...f.options.env, XDG_DATA_HOME: join(f.options.root, 'original-data') };
  const result = await runAgent(f.options, f.command);
  expect(result.status).toBe('completed');
  expect(readlinkSync(join(f.options.output, 'opencode-data/opencode/auth.json'))).toBe(
    join(authSource, 'auth.json'),
  );
  expect(readFileSync(result.finalPath, 'utf8')).toBe('[REDACTED]');
  expect(readFileSync(result.stdoutPath, 'utf8')).not.toContain('fixture-secret-never-persist');
  const settings = JSON.parse(readFileSync(result.stderrPath, 'utf8'));
  expect(settings.home).toBe(process.env.HOME);
  expect(settings.data).toEndWith('opencode-data');
  expect(settings.config).toEndWith('opencode-config');
  expect(settings.steps).toBe(5);
  expect(settings.skills).toEqual({ '*': 'deny', 'selected-skill': 'allow' });
});

test('judge pins Sol high read-only and captures structured last-message output', async () => {
  const f = fixture(`
    await Bun.stdin.text();
    const index=process.argv.indexOf('--output-last-message');
    await Bun.write(process.argv[index+1],JSON.stringify({verdict:'pass'}));
    console.log(JSON.stringify({type:'turn.completed'}));
  `);
  const result = await runJudge(f.options, f.command);
  expect(result.status).toBe('completed');
  expect(result.command).toContain('gpt-5.6-sol');
  expect(result.command).toContain('model_reasoning_effort="high"');
  expect(result.command).toContain('read-only');
  expect(result.command).toContain('--output-schema');
  expect(JSON.parse(readFileSync(result.finalPath, 'utf8'))).toEqual({ verdict: 'pass' });
});

test('OpenCode cost ceiling stops between requests and preserves partial usage evidence', async () => {
  const f = fixture(
    `
    await Bun.stdin.text();
    console.log(JSON.stringify({type:'step_finish',part:{cost:0.08,reason:'tool-calls'}}));
    console.log(JSON.stringify({type:'step_finish',part:{cost:0.08,reason:'tool-calls'}}));
    setInterval(() => {},1000);
  `,
    { harness: 'opencode', model: 'test/model', maxReportedCostUsd: 0.15 },
  );
  const result = await runAgent(f.options, f.command);
  expect(result.budgetExceeded).toBe(true);
  expect(result.status).toBe('failed');
  expect(result.durationMs).toBeLessThan(1500);
  expect(readFileSync(result.eventsPath, 'utf8').trim().split('\n')).toHaveLength(2);
});

test('OpenCode default effort omits variant for models without named variants', async () => {
  const f = fixture(
    `
    await Bun.stdin.text();
    console.log(JSON.stringify({type:'text',part:{text:'Done'}}));
    console.log(JSON.stringify({type:'step_finish',part:{reason:'stop'}}));
  `,
    { harness: 'opencode', model: 'test/no-variants', effort: 'default' },
  );
  const result = await runAgent(f.options, f.command);
  expect(result.status).toBe('completed');
  expect(result.command).not.toContain('--variant');
});

test.skipIf(process.platform === 'win32')(
  'normal delivery closes background processes in the agents process group',
  async () => {
    const f = fixture(`
    import {spawn} from 'node:child_process';
    import {writeFileSync} from 'node:fs';
    await Bun.stdin.text();
    const server=spawn(process.execPath,['-e','setInterval(() => {},1000)'],{stdio:'ignore'});
    writeFileSync('owned-background.pid',String(server.pid));
    server.unref();
    console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Done'}}));
    console.log(JSON.stringify({type:'turn.completed'}));
  `);
    const result = await runAgent(f.options, f.command);
    const pid = Number(readFileSync(join(f.options.root, 'owned-background.pid'), 'utf8'));
    await Bun.sleep(100);
    let running = true;
    try {
      process.kill(pid, 0);
    } catch {
      running = false;
    }
    // Clean up the fixture even when testing the broken implementation.
    if (running) process.kill(pid, 'SIGKILL');
    expect(result.status).toBe('completed');
    expect(running).toBe(false);
  },
);

// Seatbelt can permit lsof but deny ps even for our own PID. The controller must
// still run these integration checks outside that sandbox; other failures remain red.
const processInspectionError =
  process.env.CODEX_SANDBOX === 'seatbelt' &&
  spawnSync('ps', ['-p', String(process.pid), '-o', 'args='], {
    encoding: 'utf8',
    timeout: 3000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).error;
const sandboxDeniesProcessInspection =
  processInspectionError instanceof Error &&
  'code' in processInspectionError &&
  processInspectionError.code === 'EPERM';
if (sandboxDeniesProcessInspection) {
  console.warn(
    'Integration capability unavailable: Seatbelt denies ps (EPERM). Skipping only the two detached-server cleanup tests; the external controller must run them without this sandbox.',
  );
}

test.skipIf(process.platform === 'win32' || sandboxDeniesProcessInspection).each([false, true])(
  'delivery cleanup scopes detached fixture server to its worktree (failure=%s)',
  async (fail) => {
    const other = mkdtempSync(join(tmpdir(), 'coding-runtime-control-'));
    roots.push(other);
    const f = fixture(
      `
    import {spawn} from 'node:child_process';
    import {writeFileSync} from 'node:fs';
    await Bun.stdin.text();
    const pids = [process.cwd(), process.env.CONTROL_ROOT].map(cwd => {
      const child = spawn(process.execPath,['evals/coding/browser/server.ts'],{cwd,detached:true,stdio:'ignore'});
      child.unref();
      return child.pid;
    });
    writeFileSync('fixture-pids.json',JSON.stringify(pids));
    await Bun.sleep(100);
    if (process.env.FAIL_CLI === 'yes') process.exit(7);
    console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Done'}}));
    console.log(JSON.stringify({type:'turn.completed'}));
  `,
      { env: { CONTROL_ROOT: other, FAIL_CLI: fail ? 'yes' : 'no' } },
    );
    for (const root of [f.options.root, other]) {
      mkdirSync(join(root, 'evals/coding/browser'), { recursive: true });
      writeFileSync(join(root, 'evals/coding/browser/server.ts'), 'setInterval(() => {},1000);');
    }
    const result = await runAgent(f.options, f.command);
    const pids: number[] = JSON.parse(
      readFileSync(join(f.options.root, 'fixture-pids.json'), 'utf8'),
    );
    const running = pids.map((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });
    for (const [index, pid] of pids.entries()) if (running[index]) process.kill(pid, 'SIGKILL');
    expect(result.status).toBe(fail ? 'failed' : 'completed');
    expect(running).toEqual([false, true]);
    expect(result.fixtureCleanup?.terminatedPids).toEqual(pids.slice(0, 1));
    expect(result.fixtureCleanup?.errors).toEqual([]);
  },
  10000,
);

test('Codex compactions use only its isolated rollout and exclude personal skill discovery', async () => {
  const f = fixture(`
    import { mkdirSync, writeFileSync, readlinkSync, existsSync } from 'node:fs';
    import { join } from 'node:path';
    await Bun.stdin.text();
    const home = process.env.CODEX_HOME;
    const session = join(home, 'sessions/2026/09/15');
    mkdirSync(session, { recursive: true });
    const marker = {type:'compacted',timestamp:'2026-09-15T10:00:00Z',payload:{message:'PRIVATE_ROLLOUT_CONTENT'}};
    writeFileSync(join(session, 'rollout-date-candidate-thread.jsonl'), [
      {type:'session_meta',payload:{id:'candidate-thread',cli_version:'0.154.0'}}, marker,
      {type:'event_msg',payload:{type:'context_compacted'}},
      {type:'event_msg',payload:{type:'task_complete'}},
    ].map(JSON.stringify).join('\\n'));
    // A subagent rollout in the same isolated store must not affect the candidate count.
    writeFileSync(join(session, 'rollout-date-other-thread.jsonl'), JSON.stringify(marker));
    console.error(JSON.stringify({home,skills:existsSync(join(home,'skills')),auth:readlinkSync(join(home,'auth.json')),personalSessions:existsSync(join(home,'sessions/personal'))}));
    console.log(JSON.stringify({type:'thread.started',thread_id:'candidate-thread'}));
    console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Done'}}));
    console.log(JSON.stringify({type:'turn.completed'}));
  `);
  const originalHome = join(f.options.root, 'personal-codex');
  mkdirSync(join(originalHome, 'skills'), { recursive: true });
  mkdirSync(join(originalHome, 'sessions/personal'), { recursive: true });
  writeFileSync(join(originalHome, 'auth.json'), '{}');
  f.options.env = { CODEX_HOME: originalHome };
  const result = await runAgent(f.options, f.command);
  expect(result.status).toBe('completed');
  expect(result.command).not.toContain('--ephemeral');
  expect(result.compactions?.count).toBe(1);
  expect(result.compactions?.coverage).toBe('complete');
  const settings = JSON.parse(readFileSync(result.stderrPath, 'utf8'));
  expect(settings.home).not.toBe(originalHome);
  expect(settings.skills).toBe(false);
  expect(settings.auth).toBe(join(originalHome, 'auth.json'));
  expect(settings.personalSessions).toBe(false);
  expect(existsSync(settings.home)).toBe(false);
  expect(result.compactionsPath).toBeDefined();
  const saved = readFileSync(join(f.options.output, 'compactions.json'), 'utf8');
  expect(saved).not.toContain('PRIVATE_ROLLOUT_CONTENT');
  expect(JSON.parse(saved).count).toBe(1);
});

test('candidates can search live documentation while judges use their evidence packet', async () => {
  for (const readOnly of [false, true]) {
    const f = fixture(
      `await Bun.stdin.text(); console.log(JSON.stringify({type:'turn.completed'}));`,
      { readOnly },
    );
    const result = await runAgent(f.options, f.command);
    expect(result.command).toContain(`web_search="${readOnly ? 'disabled' : 'live'}"`);
  }
});
