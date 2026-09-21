import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runVerification } from './verify';

const directories: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'verify-test-'));
  directories.push(root);
  return { root, output: join(root, 'results') };
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

test('app profile retains lint, types and browser; full still detects a laboratory failure', async () => {
  const options = fixture();
  writeFileSync(
    join(options.root, 'package.json'),
    JSON.stringify({
      scripts: {
        lint: 'bun -e "process.exit(0)"',
        typecheck: 'bun -e "process.exit(0)"',
        test: 'bun -e "process.exit(9)"',
        'test:app': 'bun -e "process.exit(0)"',
        'test:browser': 'bun -e "process.exit(0)"',
      },
    }),
  );
  const app = await runVerification({ ...options, profile: 'app', browser: true });
  expect(app.passed).toBe(true);
  expect(app.checks.map(({ id }) => id)).toEqual(['lint', 'typecheck', 'tests', 'browser']);
  const full = await runVerification({
    ...options,
    output: join(options.root, 'full'),
    browser: true,
  });
  expect(full.passed).toBe(false);
  expect(full.checks.filter(({ status }) => status === 'failed').map(({ id }) => id)).toEqual([
    'tests',
  ]);
});

test('records failure evidence and continues with remaining checks', async () => {
  const options = fixture();
  const result = await runVerification({
    ...options,
    checks: [
      {
        id: 'broken',
        command: [process.execPath, '-e', 'console.error("expected failure"); process.exit(7)'],
      },
      { id: 'healthy', command: [process.execPath, '-e', 'console.log("passed check")'] },
    ],
  });
  expect(result.passed).toBe(false);
  expect(result.checks.map(({ status, exitCode }) => ({ status, exitCode }))).toEqual([
    { status: 'failed', exitCode: 7 },
    { status: 'passed', exitCode: 0 },
  ]);
  expect(readFileSync(join(options.output, 'broken.stderr.log'), 'utf8')).toContain(
    'expected failure',
  );
  expect(readFileSync(join(options.output, 'healthy.stdout.log'), 'utf8')).toContain(
    'passed check',
  );
  expect(JSON.parse(readFileSync(join(options.output, 'verification.json'), 'utf8'))).toEqual(
    result,
  );
});

test('timeout and unavailable executable are not successful checks and do not stop the suite', async () => {
  const result = await runVerification({
    ...fixture(),
    timeoutSeconds: 0.15,
    checks: [
      { id: 'hung', command: [process.execPath, '-e', 'setInterval(() => {}, 1000)'] },
      { id: 'missing', command: ['/nonexistent/verify-test-command'] },
      { id: 'healthy', command: [process.execPath, '-e', 'process.exit(0)'] },
    ],
  });
  expect(result.passed).toBe(false);
  expect(result.checks.map(({ status }) => status)).toEqual(['timed_out', 'not_run', 'passed']);
  expect(result.checks[1]?.error).toContain('ENOENT');
});

test('passes literal argv and isolated environment without shell interpretation', async () => {
  const options = fixture();
  const literal = '$(touch should-not-exist); spaces & "quotes"';
  const result = await runVerification({
    ...options,
    env: { VERIFICATION_TEST_PORT: '12345' },
    checks: [
      {
        id: 'literal',
        command: [
          process.execPath,
          '-e',
          'console.log(JSON.stringify({value:process.argv[1],port:process.env.VERIFICATION_TEST_PORT,cwd:process.cwd()}))',
          literal,
        ],
      },
    ],
  });
  expect(result.passed).toBe(true);
  expect(JSON.parse(readFileSync(join(options.output, 'literal.stdout.log'), 'utf8'))).toEqual({
    value: literal,
    port: '12345',
    cwd: realpathSync(options.root),
  });
});

test('rejects unsafe check ids before opening log files', async () => {
  await expect(
    runVerification({ ...fixture(), checks: [{ id: '../escape', command: ['bun'] }] }),
  ).rejects.toThrow('Check ids');
});

test('checks receive pipes instead of descriptors to private evidence files', async () => {
  const options = fixture();
  const result = await runVerification({
    ...options,
    checks: [
      {
        id: 'stdio',
        command: [
          'node',
          '-e',
          'const fs = require("node:fs"); console.log(JSON.stringify([...[1, 2].map(fd => { const s = fs.fstatSync(fd); return s.isFIFO() || s.isSocket(); })]));',
        ],
      },
    ],
  });
  expect(result.passed).toBe(true);
  expect(JSON.parse(readFileSync(join(options.output, 'stdio.stdout.log'), 'utf8'))).toEqual([
    true,
    true,
  ]);
});
