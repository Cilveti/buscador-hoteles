import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';

export type FixtureCleanup = {
  terminatedPids: number[];
  errors: string[];
};

function inspect(executable: string, args: string[]): string {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    timeout: 3000,
    maxBuffer: 128 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.signal || (result.status !== 0 && result.status !== 1)) {
    throw new Error(`${executable} process inspection failed`);
  }
  return result.stdout;
}

function cwdRecords(output: string): { pid: number; cwd: string }[] {
  const records: { pid: number; cwd: string }[] = [];
  let pid = 0;
  for (const line of output.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    if (line.startsWith('n') && Number.isInteger(pid) && pid > 1)
      records.push({ pid, cwd: line.slice(1) });
  }
  return records;
}

function inside(root: string, cwd: string): boolean {
  try {
    const path = relative(root, realpathSync(cwd));
    return path === '' || (!path.startsWith('..') && !isAbsolute(path));
  } catch {
    return false;
  }
}

function isOwnedFixture(pid: number, root: string): boolean {
  if (pid === process.pid) return false;
  const cwd = cwdRecords(inspect('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fpn']));
  if (!cwd.some((record) => record.pid === pid && inside(root, record.cwd))) return false;
  const args = inspect('ps', ['-p', String(pid), '-o', 'args=']).trim();
  // Require a JS runtime command, not a shell/grep that merely mentions the script.
  return (
    /^(?:\S*\/)?(?:bun|node)(?:\s|$)/.test(args) &&
    /(?:^|[\s/])evals\/coding\/browser\/server\.ts(?:\s|$)/.test(args)
  );
}

/** Catch fixture servers detached by a tool's shell, scoped to this still-existing worktree. */
export async function cleanupFixtureServers(root: string): Promise<FixtureCleanup> {
  const evidence: FixtureCleanup = { terminatedPids: [], errors: [] };
  if (process.platform === 'win32') return evidence;
  try {
    const canonicalRoot = realpathSync(root);
    const records = cwdRecords(inspect('lsof', ['-a', '-d', 'cwd', '+D', canonicalRoot, '-Fpn']));
    for (const { pid, cwd } of records) {
      if (!inside(canonicalRoot, cwd) || !isOwnedFixture(pid, canonicalRoot)) continue;
      try {
        process.kill(pid, 'SIGTERM');
        evidence.terminatedPids.push(pid);
        await new Promise((done) => setTimeout(done, 100));
        // Revalidate PID identity and scope before escalating an unresponsive owned server.
        if (isOwnedFixture(pid, canonicalRoot)) process.kill(pid, 'SIGKILL');
      } catch (error) {
        evidence.errors.push(`PID ${pid}: ${String(error)}`);
      }
    }
  } catch (error) {
    evidence.errors.push(String(error));
  }
  return evidence;
}
