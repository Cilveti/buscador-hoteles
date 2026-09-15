import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const manifests = [
  'package.json',
  'apps/web/package.json',
  'packages/core/package.json',
  'packages/contracts/package.json',
  'packages/adapters/package.json',
] as const;
const image =
  'oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895';

/** Only manifests and the pre-inference lock enter; no source/Git/keys, and lifecycle scripts are disabled. */
export function resolveDependencies(candidate: string, previousLock: Buffer): void {
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (uid === undefined || gid === undefined) throw new Error('Use Linux/macOS with Docker');
  const control = mkdtempSync(join(tmpdir(), 'factory-dependencies-'));
  const snapshot = join(control, 'input');
  const cid = join(control, 'container.id');
  mkdirSync(snapshot);
  try {
    for (const path of manifests) {
      mkdirSync(dirname(join(snapshot, path)), { recursive: true });
      copyFileSync(join(candidate, path), join(snapshot, path));
    }
    writeFileSync(join(snapshot, 'bun.lock'), previousLock);
    execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '--cidfile',
        cid,
        '--user',
        `${uid}:${gid}`,
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--pids-limit',
        '256',
        '-e',
        'BUN_INSTALL_CACHE_DIR=/tmp/bun-cache',
        '-e',
        'TMPDIR=/tmp',
        '-v',
        `${snapshot}:/work`,
        '-w',
        '/work',
        '--entrypoint',
        '/usr/local/bin/bun',
        image,
        'install',
        '--lockfile-only',
        '--ignore-scripts',
        '--registry',
        'https://registry.npmjs.org',
      ],
      { timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 2_000_000 },
    );
    for (const path of manifests) {
      if (!readFileSync(join(candidate, path)).equals(readFileSync(join(snapshot, path))))
        throw new Error('Dependency resolver altered a manifest');
    }
    copyFileSync(join(snapshot, 'bun.lock'), join(candidate, 'bun.lock'));
  } finally {
    // The ID file is outside the mount. Never remove a container identified only by a guessed name.
    if (existsSync(cid)) {
      const container = readFileSync(cid, 'utf8').trim();
      if (/^[a-f0-9]{64}$/.test(container)) {
        try {
          execFileSync('docker', ['rm', '--force', container], {
            stdio: 'ignore',
            timeout: 10_000,
          });
        } catch {
          // A successful --rm execution has already removed its container.
        }
      }
    }
    rmSync(control, { recursive: true, force: true });
  }
}
