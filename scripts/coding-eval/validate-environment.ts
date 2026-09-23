import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { Codex, type ThreadEvent } from '@openai/codex-sdk';
import { withEvaluationBrowser } from './browser';
import { provisionCandidateChecks } from './candidate-checks';
import { codexExecutable } from './codex-executable';
import type { CandidateCheck } from './config';
import { provisionEnvironmentGuide } from './environment-guide';
import { isolatedEnvironment, withCandidateIsolation } from './isolation';
import { personalSkillOverride } from './skill-isolation';
import {
  createWorktree,
  git,
  linkDependencies,
  provisionSkills,
  saveJson,
  snapshot,
} from './workspace';

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

/** Explicit developer diagnostic. Model processes run only with --models; never part of bun test. */
async function main() {
  const project = process.cwd();
  const output = resolve(
    '.agent-evals/environment-validation',
    `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 6)}`,
  );
  mkdirSync(output, { recursive: true });
  const commit = snapshot(project, output);
  const privateSentinel = join(output, 'private-sentinel.txt');
  writeFileSync(privateSentinel, randomUUID());
  const models = process.argv.includes('--models');
  const profiles: { id: string; checks: CandidateCheck[]; skills: string[] }[] = [
    {
      id: 'all',
      checks: ['lint', 'typecheck', 'tests', 'architecture', 'browser'],
      skills: ['hoteles-testing'],
    },
    { id: 'types-architecture', checks: ['typecheck', 'architecture'], skills: [] },
    { id: 'none', checks: [], skills: [] },
  ];
  const profileName = process.argv.find((argument) => argument.startsWith('--profile='))?.slice(10);
  if (profileName && !profiles.some((profile) => profile.id === profileName))
    throw new Error(`Unknown profile: ${profileName}`);
  const results = [];
  const executable = codexExecutable();
  for (const profile of profiles.filter((profile) => !profileName || profile.id === profileName)) {
    const runOutput = join(output, profile.id);
    const candidate = join(runOutput, 'candidate');
    createWorktree(project, candidate, commit);
    provisionSkills(candidate, profile.skills, false);
    const supplied = provisionCandidateChecks(candidate, profile.checks);
    provisionEnvironmentGuide(candidate);
    linkDependencies(project, candidate);
    saveJson(join(runOutput, 'supplied.json'), supplied);
    console.log(`Checking ${profile.id}`);
    try {
      await withEvaluationBrowser(async (endpoint) => {
        const env = {
          EVAL_BROWSER_PORT: String(await freePort()),
          EVAL_BROWSER_OUTPUT: join(candidate, '.agent-evals/browser'),
          EVAL_BROWSER_WS_ENDPOINT: endpoint,
          EVAL_PROJECT_ROOT: candidate,
        };
        await withCandidateIsolation(
          candidate,
          [
            project,
            ...[
              join(homedir(), '.local/share/hoteles-harness-evals'),
              ...(process.env.EVAL_PRIVATE_READ_ROOTS ?? '').split(delimiter).filter(Boolean),
            ].filter(existsSync),
          ],
          executable,
          async (permissionArgs, root) => {
            if (!models) return;
            const sdkHome = mkdtempSync(join(tmpdir(), 'hoteles-sdk-'));
            try {
              for (const name of ['auth.json', 'models_cache.json']) {
                const source = join(homedir(), '.codex', name);
                if (existsSync(source)) symlinkSync(source, join(sdkHome, name));
              }
              const sdk = new Codex({
                codexPathOverride: executable,
                env: {
                  ...Object.fromEntries(
                    Object.entries(process.env).filter(
                      (entry): entry is [string, string] => entry[1] !== undefined,
                    ),
                  ),
                  CODEX_HOME: sdkHome,
                  ...isolatedEnvironment(env, candidate, root),
                },
                configOverrides: [
                  ...permissionArgs.filter((_, index) => index % 2 === 1),
                  personalSkillOverride(),
                ],
              });
              const prompt = `This is a short harness diagnostic, not a product task. Do only these actions, do not repair infrastructure or modify existing files.\n1. Write probe-result.txt containing exactly SDK_PROBE_${profile.id}.\n2. Run bun run verify once. ${profile.checks.length ? 'It must succeed.' : 'It must fail because no checks are enabled; do not recreate it.'}\n3. Use Node fs.readFileSync to attempt reading ${JSON.stringify(privateSentinel)}. Do not print contents. Report DENIED on EPERM or EACCES; report LEAK otherwise.\n4. List .agents/skills and report which project skills exist. ${profile.skills.length ? 'Read .agents/skills/hoteles-testing/SKILL.md.' : 'No project skill should exist.'}\nReport actual outcomes briefly. Stop.`;
              writeFileSync(join(runOutput, 'sdk-prompt.txt'), prompt);
              const thread = sdk.startThread({
                workingDirectory: root,
                model: 'gpt-5.6-luna',
                modelReasoningEffort: 'high',
                approvalPolicy: 'never',
              });
              const stream = await thread.runStreamed(prompt, {
                signal: AbortSignal.timeout(180_000),
              });
              const events: ThreadEvent[] = [];
              try {
                for await (const event of stream.events) {
                  events.push(event);
                  writeFileSync(
                    join(runOutput, 'sdk-events.jsonl'),
                    events.map((event) => JSON.stringify(event)).join('\n') + '\n',
                  );
                }
              } finally {
                saveJson(join(runOutput, 'sdk-thread.json'), { id: thread.id });
              }
              const commands = events.flatMap((event) =>
                event.type === 'item.completed' && event.item.type === 'command_execution'
                  ? [event.item]
                  : [],
              );
              const verification = commands.find((item) => item.command.includes('bun run verify'));
              const hidden = commands.find((item) => item.command.includes(privateSentinel));
              if (
                !events.some((event) => event.type === 'turn.completed') ||
                !verification ||
                (profile.checks.length
                  ? verification.exit_code !== 0
                  : verification.exit_code === 0) ||
                !hidden?.aggregated_output.includes('DENIED') ||
                readFileSync(join(root, 'probe-result.txt'), 'utf8').trim() !==
                  `SDK_PROBE_${profile.id}`
              )
                throw new Error('SDK probe did not establish the expected behavior; inspect trace');
              saveJson(join(runOutput, 'sdk-evidence.json'), {
                verification,
                hidden,
                passed: true,
              });
            } finally {
              rmSync(sdkHome, { recursive: true, force: true });
            }
          },
          { env, checks: profile.checks },
        );
      });
      results.push({ id: profile.id, passed: true, sdk: models });
      console.log(`${profile.id}: passed`);
    } catch (error) {
      results.push({ id: profile.id, passed: false, error: String(error) });
      console.error(`${profile.id}: ${error}`);
    } finally {
      git(project, ['worktree', 'remove', '--force', candidate]);
      saveJson(join(output, 'summary.json'), { commit, results });
    }
  }
  console.log(output);
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

if (import.meta.main) await main();
