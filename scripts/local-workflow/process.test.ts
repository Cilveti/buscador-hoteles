import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execute } from './process';

test('worker runner passes text through stdin without shell expansion', async () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-process-'));
  try {
    const log = join(root, 'worker.log');
    const input = 'A literal $(touch SHOULD_NOT_EXIST) and `command`';
    await execute([process.execPath, '-e', 'console.log(await Bun.stdin.text())'], {
      cwd: root,
      log,
      input,
      timeoutMs: 3000,
    });
    expect(readFileSync(log, 'utf8').trim()).toBe(input);
    expect(existsSync(join(root, 'SHOULD_NOT_EXIST'))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('timeout stops the owned process and reports failure rather than a completed task', async () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-timeout-'));
  try {
    const started = performance.now();
    await expect(
      execute([process.execPath, '-e', 'await Bun.sleep(60000)'], {
        cwd: root,
        log: join(root, 'worker.log'),
        timeoutMs: 80,
      }),
    ).rejects.toThrow('timeout');
    expect(performance.now() - started).toBeLessThan(4000);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
