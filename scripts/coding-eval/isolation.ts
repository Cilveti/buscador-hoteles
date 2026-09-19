import { spawnSync } from 'node:child_process';
import {
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type CheckDefinition, runVerification } from '../verification/verify';
import { browserHealthScript, provisionBrowserBridge } from './browser-bridge';
import type { CandidateCheck } from './config';
import { git, linkDependencies, saveJson } from './workspace';

export function isolatedEnvironment(
  env: Record<string, string>,
  original: string,
  isolated: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      key,
      value === original || value.startsWith(`${original}/`)
        ? isolated + value.slice(original.length)
        : value,
    ]),
  );
}

/** Run the supplied tree outside private parent paths; restore it and its Git pointer afterward. */
export async function withCandidateIsolation<T>(
  root: string,
  deniedRoots: string[],
  executable: string,
  run: (permissionArgs: string[], isolatedRoot: string) => Promise<T>,
  options: { checks?: CandidateCheck[]; env?: Record<string, string> } = {},
) {
  const originalGit = readFileSync(join(root, '.git'), 'utf8');
  if (!originalGit.startsWith('gitdir:'))
    throw new Error('Expected a disposable candidate worktree');
  const project = deniedRoots[0];
  if (!project) throw new Error('Missing controller root');
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'hoteles-candidate-')));
  const isolated = join(temporary, 'workspace');
  const output = join(dirname(root), 'environment-preflight');
  mkdirSync(output, { recursive: true });
  renameSync(root, isolated);
  symlinkSync(isolated, root, 'dir');
  try {
    rmSync(join(isolated, '.git'));
    // APFS uses copy-on-write; dependencies have no path through the denied controller.
    rmSync(join(isolated, 'node_modules'), { recursive: true, force: true });
    cpSync(join(project, 'node_modules'), join(isolated, 'node_modules'), {
      recursive: true,
      verbatimSymlinks: true,
      mode: constants.COPYFILE_FICLONE,
    });
    linkDependencies(project, isolated, isolated);
    if (options.env?.EVAL_BROWSER_WS_ENDPOINT) provisionBrowserBridge(isolated);
    git(isolated, ['init', '--quiet']);
    git(isolated, ['add', '-A']);
    git(isolated, [
      '-c',
      'user.name=Evaluation',
      '-c',
      'user.email=eval@localhost',
      'commit',
      '--quiet',
      '-m',
      'Supplied candidate baseline',
    ]);

    const filesystem = Object.fromEntries([
      ...[
        ...deniedRoots,
        join(homedir(), '.codex'),
        ...['Codex', 'com.openai.codex', 'com.openai.atlas', 'OpenAI'].map((name) =>
          join(homedir(), 'Library/Application Support', name),
        ),
      ]
        .filter(existsSync)
        .map((path) => [realpathSync(path), 'deny']),
      [isolated, 'write'],
      [join(isolated, 'node_modules'), 'read'],
    ]);
    const table = `{${Object.entries(filesystem)
      .map(([path, permission]) => `${JSON.stringify(path)}=${JSON.stringify(permission)}`)
      .join(',')}}`;
    const overrides = [
      '-c',
      'permissions.private-eval.extends=":workspace"',
      '-c',
      `permissions.private-eval.filesystem=${table}`,
      '-c',
      'permissions.private-eval.network.enabled=true',
    ];
    const sandbox = (command: string[]) =>
      spawnSync(
        executable,
        ['sandbox', '-P', 'private-eval', ...overrides, '-C', isolated, '--', ...command],
        {
          cwd: isolated,
          encoding: 'utf8',
          timeout: 180_000,
          maxBuffer: 16 * 1024 * 1024,
          env: { ...process.env, ...isolatedEnvironment(options.env ?? {}, root, isolated) },
        },
      );
    const probe = sandbox(['/bin/cat', join(project, '.git/HEAD')]);
    if (probe.status === 0 || !/Operation not permitted/.test(probe.stderr ?? ''))
      throw new Error(`Private read isolation unavailable: ${probe.stderr ?? probe.error}`);

    const scripts = {
      lint: 'lint',
      typecheck: 'typecheck',
      tests: 'test',
      architecture: 'check:architecture',
      browser: 'test:eval-browser',
    };
    // Async checks keep the externally leased Playwright browser responsive.
    const verification = await runVerification({
      root: isolated,
      output,
      timeoutSeconds: 180,
      env: isolatedEnvironment(options.env ?? {}, root, isolated),
      checks: [
        ...['node', 'bun'].map<CheckDefinition>((runtime) => ({
          id: `environment-${runtime}`,
          command: [
            executable,
            'sandbox',
            '-P',
            'private-eval',
            ...overrides,
            '-C',
            isolated,
            '--',
            runtime,
            '-e',
            options.env?.EVAL_BROWSER_WS_ENDPOINT
              ? browserHealthScript
              : `require('node:fs').accessSync('.'); console.log('ENVIRONMENT_READY')`,
          ],
        })),
        {
          id: 'environment-private-access',
          command: [
            executable,
            'sandbox',
            '-P',
            'private-eval',
            ...overrides,
            '-C',
            isolated,
            '--',
            'node',
            '-e',
            `
const fs = require('node:fs');
for (const path of ${JSON.stringify(
              Object.entries(filesystem)
                .filter(([, permission]) => permission === 'deny')
                .map(([path]) => path),
            )}) {
  try { fs.readdirSync(path); throw new Error('PRIVATE_READ_ALLOWED'); }
  catch (error) { if (!['EPERM', 'EACCES'].includes(error.code)) throw error; }
}
fetch('http://127.0.0.1:3415/api/bootstrap', { signal: AbortSignal.timeout(3000) })
  .then(response => { if (response.status !== 403) throw new Error('LAB_API_EXPOSED_' + response.status); console.log('PRIVATE_FILES_DENIED LAB_API_DENIED'); })
  .catch(error => { if (error.cause?.code === 'ECONNREFUSED') console.log('PRIVATE_FILES_DENIED LAB_API_OFFLINE'); else { console.error(error.message); process.exitCode = 1; } });
`,
          ],
        },
        ...(options.checks ?? [])
          .filter((check) => check !== 'acceptance')
          .map<CheckDefinition>((check) => ({
            id: check,
            command: [
              executable,
              'sandbox',
              '-P',
              'private-eval',
              ...overrides,
              '-C',
              isolated,
              '--',
              'bun',
              'run',
              scripts[check],
            ],
          })),
      ],
    });
    if (!verification.passed)
      throw new Error(`Candidate environment preflight failed. See ${output}`);
    saveJson(join(dirname(root), 'candidate-isolation.json'), {
      filesystem,
      independentGit: true,
      privateReadProbeDenied: true,
      sharedBrowserOutsideProfile: true,
      dependencies: 'isolated copy; reflink when supported',
      browserBridge: options.env?.EVAL_BROWSER_WS_ENDPOINT
        ? 'chromium.launch connects to leased browser; launch process options do not configure the remote browser'
        : null,
      checks: verification.checks,
    });
    return await run(['-c', 'default_permissions="private-eval"', ...overrides], isolated);
  } finally {
    rmSync(join(isolated, '.git'), { recursive: true, force: true });
    writeFileSync(join(isolated, '.git'), originalGit);
    rmSync(root);
    renameSync(isolated, root);
    rmSync(temporary, { recursive: true, force: true });
    // Discard only dependency copies created by this provisioning; delivery/code/logs remain.
    for (const folder of [
      '',
      'apps/web',
      ...readdirSync(join(project, 'packages')).map((name) => `packages/${name}`),
    ])
      rmSync(join(root, folder, 'node_modules'), { recursive: true, force: true });
    linkDependencies(project, root);
  }
}
