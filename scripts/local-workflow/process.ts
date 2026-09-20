import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';

/** Only processes owned by this invocation are terminated, including their child processes. */
export function stop(pid: number | undefined): void {
  if (!pid) return;
  try {
    process.kill(process.platform === 'win32' ? pid : -pid, 'SIGTERM');
  } catch {}
}

export async function execute(
  command: string[],
  options: {
    cwd: string;
    log: string;
    timeoutMs: number;
    input?: string;
    env?: NodeJS.ProcessEnv;
  },
): Promise<void> {
  const executable = command[0];
  if (!executable) throw new Error('Missing executable');
  mkdirSync(dirname(options.log), { recursive: true });
  const fd = openSync(options.log, 'wx', 0o600);
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(executable, command.slice(1), {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: ['pipe', fd, fd],
        detached: process.platform !== 'win32',
      });
      const cancel = () => {
        stop(child.pid);
      };
      process.once('SIGINT', cancel);
      process.once('SIGTERM', cancel);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        stop(child.pid);
      }, options.timeoutMs);
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      child.once('spawn', () => {
        killTimer = setTimeout(() => {
          if (child.exitCode === null && child.pid) {
            try {
              process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL');
            } catch {}
          }
        }, options.timeoutMs + 5000);
      });
      const cleanup = () => {
        clearTimeout(timer);
        clearTimeout(killTimer);
        process.removeListener('SIGINT', cancel);
        process.removeListener('SIGTERM', cancel);
      };
      child.once('error', (error) => {
        cleanup();
        reject(error);
      });
      child.once('close', (code, signal) => {
        cleanup();
        if (code === 0 && !timedOut) resolve();
        else
          reject(
            new Error(
              `${executable}: ${timedOut ? 'timeout' : `exit ${code ?? signal}`} (see ${options.log})`,
            ),
          );
      });
      child.stdin?.on('error', () => {});
      child.stdin?.end(options.input ?? '');
    });
  } finally {
    closeSync(fd);
  }
}
