import { afterEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { provisionCandidateChecks } from './candidate-checks';
import { configSchema, JUDGE, parseConfig } from './config';
import { judgmentSchema } from './judge';
import { buildTaskSkillPrompt, readProcessSkill } from './process-skill';
import { rejudgeRun } from './rejudge';
import { buildCandidatePrompt, runCampaign } from './runner';
import { analyzeEvents } from './trace';
import {
  changedPaths,
  createWorktree,
  git,
  provisionSkills,
  restoreReferences,
  saveJson,
  snapshot,
} from './workspace';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'coding-eval-'));
  folders.push(root);
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'test']);
  git(root, ['config', 'user.email', 'test@localhost']);
  put('.gitignore', '.agent-evals/\nnode_modules/\n');
  put('packages/core/index.ts', 'export const version = 1;\n');
  put('packages/core/core.test.ts', 'original expectations\n');
  put('package.json', '{"scripts":{"test":"reference"}}');
  for (const name of ['one', 'two', 'hoteles-verificar-buscador'])
    put(`.agents/skills/${name}/SKILL.md`, `# ${name}`);
  put(
    'scripts/verification/verify.ts',
    "export function defaultChecks() { const checks = [{id: 'lint'}, {id: 'tests'}]; return checks; }",
  );
  put(
    'evals/coding/tasks/example/task.json',
    JSON.stringify({
      id: 'example',
      title: 'Example',
      description: 'A real task',
      browser: true,
      expectedSkills: ['one'],
      acceptanceCommand: ['bun', 'test', './acceptance.test.ts'],
    }),
  );
  put('evals/coding/tasks/example/prompt.md', 'Implement useful behavior.');
  put('evals/coding/prompts/candidate.md', 'Implement the task.');
  put('evals/coding/prompts/self-verify.md', 'Run verify and Playwright.');
  put('evals/coding/prompts/judge.md', 'Review with evidence.');
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'baseline']);
  return { root, put };
}

test('flags independently control instruction and skill without falsy defaults overriding JSON', () => {
  const { root, put } = fixture();
  put(
    'config.json',
    JSON.stringify({ task: 'example', selfVerify: false, browserSkill: false, repeats: 2 }),
  );
  const config = parseConfig([
    '--config',
    join(root, 'config.json'),
    '--browser-skill',
    'on',
    '--repeats',
    '3',
  ]);
  expect(config.selfVerify).toBe(false);
  expect(config.browserSkill).toBe(true);
  expect(config.repeats).toBe(3);
  expect(buildCandidatePrompt('base', 'task', null, null)).not.toContain('verify');
  expect(buildCandidatePrompt('base', 'task', 'run verify', null)).toContain('run verify');
});

test('candidate timeout defaults to null and CLI can enable or disable a JSON limit', () => {
  const { root, put } = fixture();
  put('config.json', JSON.stringify({ task: 'example', timeoutSeconds: 900 }));
  expect(parseConfig(['--task', 'example']).timeoutSeconds).toBeNull();
  expect(
    parseConfig(['--config', join(root, 'config.json'), '--timeout-seconds', 'off']).timeoutSeconds,
  ).toBeNull();
  expect(parseConfig(['--task', 'example', '--timeout-seconds', '1200']).timeoutSeconds).toBe(1200);
  expect(configSchema.parse({ task: 'example', timeoutSeconds: null }).timeoutSeconds).toBeNull();
  expect(() => parseConfig(['--task', 'example', '--timeout-seconds', '0'])).toThrow();
  expect(() => parseConfig(['--task', 'example', '--timeout-seconds', 'unlimited'])).toThrow();
});

test('OpenCode cost ceiling defaults off and accepts a positive reported USD limit', () => {
  expect(configSchema.parse({ task: 'example' }).maxReportedCostUsd).toBeNull();
  expect(
    parseConfig(['--task', 'example', '--max-reported-cost-usd', '0.75']).maxReportedCostUsd,
  ).toBe(0.75);
  expect(() => parseConfig(['--task', 'example', '--max-reported-cost-usd', '0'])).toThrow();
});

test('judge packet mode defaults to full and accepts an explicit compact packet', () => {
  expect(configSchema.parse({ task: 'example' }).judgePacketMode).toBe('full');
  expect(parseConfig(['--task', 'example', '--judge-packet-mode', 'compact']).judgePacketMode).toBe(
    'compact',
  );
  expect(() => parseConfig(['--task', 'example', '--judge-packet-mode', 'minimal'])).toThrow();
});

test('workflow candidate keeps the same judge and private gates but requires a frozen phase spec', () => {
  const config = parseConfig([
    '--task',
    'example',
    '--candidate-kind',
    'workflow',
    '--workflow-spec',
    'evals/coding/tasks/example/workflow-spec.json',
  ]);
  expect(config.candidateKind).toBe('workflow');
  expect(config.workflowSpec).toBe('evals/coding/tasks/example/workflow-spec.json');
  expect(JUDGE.model).toBe('gpt-6-sol');
  expect(() => configSchema.parse({ task: 'example', candidateKind: 'workflow' })).toThrow();
  expect(() =>
    configSchema.parse({
      task: 'example',
      candidateKind: 'workflow',
      workflowSpec: 'evals/coding/tasks/example/workflow-spec.json',
      candidateChecks: [],
    }),
  ).toThrow();
  expect(() =>
    configSchema.parse({
      task: 'example',
      candidateKind: 'workflow',
      workflowSpec: 'evals/coding/tasks/example/workflow-spec.json',
      processSkill: '.agents/skills/abordar-tarea/SKILL.md',
    }),
  ).toThrow();
});

for (const failedCheck of ['lint', 'acceptance']) {
  test(`baseline ${failedCheck} failure ${failedCheck === 'lint' ? 'blocks models' : 'permits evaluation'}`, async () => {
    const { root } = fixture();
    let modelCalls = 0;
    const campaign = await runCampaign(
      root,
      configSchema.parse({ task: 'example', skills: ['one'] }),
      {
        agent: async () => {
          modelCalls++;
          throw new Error('Reached model boundary; no real model in fixture');
        },
        browser: async (run) => run('ws://fixture'),
        verify: async (options) => ({
          schemaVersion: 1,
          root: options.root,
          startedAt: '',
          finishedAt: '',
          timeoutSeconds: 1,
          passed: false,
          checks: (options.checks ?? []).map((check) => ({
            ...check,
            status: check.id === failedCheck ? 'failed' : 'passed',
            exitCode: check.id === failedCheck ? 1 : 0,
            signal: null,
            durationMs: 1,
            stdoutPath: '',
            stderrPath: '',
          })),
        }),
      },
    );
    const manifest = JSON.parse(readFileSync(join(campaign, 'manifest.json'), 'utf8'));
    expect(modelCalls).toBe(failedCheck === 'lint' ? 0 : 1);
    expect(manifest.status).toBe(failedCheck === 'lint' ? 'baseline_failed' : 'incomplete');
    if (failedCheck === 'lint') {
      expect(manifest.baselineRepositoryFailures).toEqual(['lint']);
      expect(readdirSync(campaign)).not.toContain('runs');
    }
  }, 30000);
}

test('prompt file CLI overrides JSON and keeps composition options independent', () => {
  const { root, put } = fixture();
  put('config.json', JSON.stringify({ task: 'example', promptFile: 'old.md' }));
  expect(
    parseConfig(['--config', join(root, 'config.json'), '--prompt-file', 'new.md']).promptFile,
  ).toBe('new.md');
  expect(configSchema.parse({ task: 'example' }).promptFile).toBeNull();
});

test('split input requires both specification and process skill and rejects an ambiguous full prompt', () => {
  expect(
    parseConfig([
      '--task',
      'example',
      '--task-file',
      'requirements.md',
      '--process-skill',
      'SKILL.md',
    ]),
  ).toMatchObject({ taskFile: 'requirements.md', processSkill: 'SKILL.md', promptFile: null });
  for (const fields of [
    { taskFile: 'requirements.md' },
    { processSkill: 'SKILL.md' },
    { taskFile: 'requirements.md', processSkill: 'SKILL.md', promptFile: 'full.md' },
  ])
    expect(() => configSchema.parse({ task: 'example', ...fields })).toThrow();
});

for (const fullPrompt of [false, true]) {
  test(`prepare-only freezes ${fullPrompt ? 'complete file' : 'composed'} prompt without models`, async () => {
    const { root, put } = fixture();
    const baseline = git(root, ['rev-parse', 'HEAD']);
    const exact = '\n# Tarea autónoma\r\n\r\nConservar ñ, espacios finales.  \r\n';
    // This file is deliberately absent from the frozen baseline.
    put('complete.md', exact);
    const campaign = await runCampaign(
      root,
      configSchema.parse({
        task: 'example',
        baseline,
        prepareOnly: true,
        skills: ['one'],
        promptFile: fullPrompt ? 'complete.md' : null,
        // Complete input must not even read the unused composition files.
        ...(fullPrompt ? { candidatePrompt: 'missing.md', instructions: 'also-missing.md' } : {}),
      }),
      {
        agent: async () => {
          throw new Error('prepare-only must not call a model');
        },
        browser: async () => {
          throw new Error('prepare-only must not provision candidate browser');
        },
        verify: async (options) => {
          put('complete.md', 'Changed while the baseline verifier ran.');
          return {
            schemaVersion: 1,
            root: options.root,
            startedAt: '',
            finishedAt: '',
            timeoutSeconds: 1,
            passed: true,
            checks: [],
          };
        },
      },
    );
    const expected = fullPrompt
      ? exact
      : 'Implement the task.\n\n## Tarea\n\nImplement useful behavior.\n\nRun verify and Playwright.';
    expect(readFileSync(join(campaign, 'candidate-prompt.md'), 'utf8')).toBe(expected);
    const inputs = JSON.parse(readFileSync(join(campaign, 'inputs.json'), 'utf8'));
    expect(inputs.candidatePrompt.sha256).toBe(createHash('sha256').update(expected).digest('hex'));
    expect(inputs.candidatePromptSha256).toBe(inputs.candidatePrompt.sha256);
    expect(inputs.candidatePrompt.mode).toBe(fullPrompt ? 'file' : 'composed');
    expect(inputs.candidatePrompt.selfVerifyInstructionApplied).toBe(!fullPrompt);
    expect(readFileSync(join(campaign, inputs.candidatePrompt.path), 'utf8')).toBe(expected);
    expect(readFileSync(join(campaign, 'task-prompt.md'), 'utf8')).toBe(
      fullPrompt ? exact : 'Implement useful behavior.',
    );
    expect(JSON.parse(readFileSync(join(campaign, 'manifest.json'), 'utf8')).status).toBe(
      'prepared',
    );
  }, 30000);
}

test('snapshot preserves user index, captures untracked delivery and changes committed by candidate', () => {
  const { root, put } = fixture();
  put('new.ts', 'new code');
  put('packages/core/index.ts', 'staged value');
  git(root, ['add', 'packages/core/index.ts']);
  put('packages/core/index.ts', 'unstaged value');
  const indexBefore = git(root, ['diff', '--cached']);
  const output = join(root, '.agent-evals');
  const commit = snapshot(root, output);
  expect(git(root, ['diff', '--cached'])).toBe(indexBefore);
  expect(git(root, ['show', `${commit}:new.ts`])).toBe('new code');
  const candidate = join(output, 'candidate');
  createWorktree(root, candidate, commit);
  writeFileSync(join(candidate, 'new.ts'), 'delivered');
  git(candidate, ['add', 'new.ts']);
  git(candidate, ['commit', '-qm', 'candidate may commit']);
  writeFileSync(join(candidate, 'extra.ts'), 'new file');
  const delivered = snapshot(candidate, output, commit);
  expect(changedPaths(root, commit, delivered)).toEqual(['extra.ts', 'new.ts']);
});

test('reference changes are restored externally; new tests and arbitrary product paths remain', () => {
  const { root } = fixture();
  const baseline = git(root, ['rev-parse', 'HEAD']);
  const out = join(root, '.agent-evals');
  const candidate = join(out, 'candidate');
  createWorktree(root, candidate, baseline);
  expect(provisionSkills(candidate, ['one'], false)).toEqual(['one']);
  writeFileSync(join(candidate, 'packages/core/core.test.ts'), 'weakened test');
  writeFileSync(join(candidate, 'new.test.ts'), 'new meaningful test');
  writeFileSync(join(candidate, 'different-product-file.ts'), 'allowed product change');
  const delivered = snapshot(candidate, out, baseline);
  const verification = join(out, 'verify');
  createWorktree(root, verification, delivered);
  const changes = restoreReferences(root, verification, baseline, delivered);
  expect(changes.map((change) => change.path)).toContain('packages/core/core.test.ts');
  expect(readFileSync(join(verification, 'packages/core/core.test.ts'), 'utf8')).toBe(
    'original expectations\n',
  );
  expect(readFileSync(join(candidate, 'packages/core/core.test.ts'), 'utf8')).toBe('weakened test');
  expect(readFileSync(join(verification, 'different-product-file.ts'), 'utf8')).toBe(
    'allowed product change',
  );
  expect(readFileSync(join(verification, 'new.test.ts'), 'utf8')).toBe('new meaningful test');
});

test('new nested check configuration is neutralized, while delivered tests can be checked separately', () => {
  const { root } = fixture();
  const baseline = git(root, ['rev-parse', 'HEAD']);
  const out = join(root, '.agent-evals');
  const candidate = join(out, 'candidate');
  createWorktree(root, candidate, baseline);
  writeFileSync(
    join(candidate, 'packages/core/biome.json'),
    '{"root":false,"linter":{"enabled":false}}',
  );
  writeFileSync(join(candidate, 'packages/core/.gitignore'), '*.ts');
  writeFileSync(join(candidate, 'packages/core/core.test.ts'), 'new candidate assertions');
  const delivered = snapshot(candidate, out, baseline);
  const verification = join(out, 'verify');
  createWorktree(root, verification, delivered);
  const changes = restoreReferences(root, verification, baseline, delivered, true);
  expect(
    changes.filter((change) => change.addedConfiguration).map((change) => change.path),
  ).toEqual(['packages/core/.gitignore', 'packages/core/biome.json']);
  expect(existsSync(join(verification, 'packages/core/biome.json'))).toBe(false);
  expect(existsSync(join(verification, 'packages/core/.gitignore'))).toBe(false);
  expect(readFileSync(join(verification, 'packages/core/core.test.ts'), 'utf8')).toBe(
    'new candidate assertions',
  );
  expect(existsSync(join(candidate, 'packages/core/biome.json'))).toBe(true);
});

test('reference scripts stay frozen without erasing product exports or new package manifests', () => {
  const { root, put } = fixture();
  put(
    'packages/core/package.json',
    JSON.stringify({
      name: '@example/core',
      scripts: { test: 'trusted' },
      exports: { '.': './index.ts' },
    }),
  );
  const out = join(root, '.agent-evals');
  const baseline = snapshot(root, out);
  const candidate = join(out, 'candidate');
  createWorktree(root, candidate, baseline);
  const manifest = {
    name: '@example/core',
    type: 'module',
    exports: { '.': './index.ts', './saved-search': './saved.ts' },
    imports: { '#local': './saved.ts' },
    scripts: { test: 'echo bypass', pretest: 'echo injected' },
  };
  const deliveredText = JSON.stringify(manifest);
  writeFileSync(join(candidate, 'packages/core/package.json'), deliveredText);
  mkdirSync(join(candidate, 'packages/new'), { recursive: true });
  writeFileSync(
    join(candidate, 'packages/new/package.json'),
    '{"name":"@example/new","exports":"./index.ts"}',
  );
  const delivered = snapshot(candidate, out, baseline);
  const verification = join(out, 'verify');
  createWorktree(root, verification, delivered);
  const changes = restoreReferences(root, verification, baseline, delivered);
  expect(
    JSON.parse(readFileSync(join(verification, 'packages/core/package.json'), 'utf8')),
  ).toEqual({ ...manifest, scripts: { test: 'trusted' } });
  expect(existsSync(join(verification, 'packages/new/package.json'))).toBe(true);
  expect(changes.find((change) => change.path === 'packages/core/package.json')).toMatchObject({
    restoredFields: ['scripts'],
  });
  expect(readFileSync(join(candidate, 'packages/core/package.json'), 'utf8')).toBe(deliveredText);
});

test('reference restoration does not repair invalid or deleted product manifests', () => {
  const { root, put } = fixture();
  put('packages/core/package.json', '{"name":"@example/core"}');
  const out = join(root, '.agent-evals');
  const baseline = snapshot(root, out);
  const candidate = join(out, 'candidate');
  createWorktree(root, candidate, baseline);
  writeFileSync(join(candidate, 'package.json'), '{invalid');
  rmSync(join(candidate, 'packages/core/package.json'));
  const delivered = snapshot(candidate, out, baseline);
  const verification = join(out, 'verify');
  createWorktree(root, verification, delivered);
  restoreReferences(root, verification, baseline, delivered);
  expect(readFileSync(join(verification, 'package.json'), 'utf8')).toBe('{invalid');
  expect(existsSync(join(verification, 'packages/core/package.json'))).toBe(false);
});

test('external verification restores disabled suites with their helpers, while candidate tests retain delivered helpers', () => {
  const { root, put } = fixture();
  put('tests/architecture/dependency-check.ts', 'export const dependencyCheck = true;');
  put(
    'tests/architecture/dependencies.test.ts',
    'import { dependencyCheck } from "./dependency-check";',
  );
  put('tests/browser/fixtures.ts', 'original fixture');
  put('.dependency-cruiser.cjs', 'module.exports = { forbidden: ["original rule"] };');
  const out = join(root, '.agent-evals');
  const baseline = snapshot(root, out);
  const candidate = join(out, 'candidate');
  createWorktree(root, candidate, baseline);
  provisionCandidateChecks(candidate, []);
  expect(existsSync(join(candidate, 'tests/architecture/dependency-check.ts'))).toBe(false);
  writeFileSync(join(candidate, 'tests/browser/fixtures.ts'), 'candidate fixture');
  writeFileSync(join(candidate, '.dependency-cruiser.cjs'), 'module.exports = {};');
  const delivered = snapshot(candidate, out, baseline);
  for (const preserveTests of [false, true]) {
    const verification = join(out, preserveTests ? 'candidate-tests' : 'reference-tests');
    createWorktree(root, verification, delivered);
    restoreReferences(root, verification, baseline, delivered, preserveTests);
    expect(readFileSync(join(verification, '.dependency-cruiser.cjs'), 'utf8')).toContain(
      'original rule',
    );
    expect(readFileSync(join(verification, 'tests/browser/fixtures.ts'), 'utf8')).toBe(
      preserveTests ? 'candidate fixture' : 'original fixture',
    );
    expect(existsSync(join(verification, 'tests/architecture/dependency-check.ts'))).toBe(
      !preserveTests,
    );
    expect(existsSync(join(verification, 'tests/architecture/dependencies.test.ts'))).toBe(
      !preserveTests,
    );
  }
});

describe('trace evidence', () => {
  test('verification before final edit is not final-state verification; unavailable cost stays null', () => {
    const trace = analyzeEvents([
      {
        type: 'item.completed',
        item: { type: 'command_execution', command: 'bun run verify', exit_code: 1 },
      },
      { type: 'item.completed', item: { type: 'file_change', status: 'completed' } },
      { type: 'turn.completed', usage: { input_tokens: 30, output_tokens: 20 } },
    ]);
    expect(trace.verify.afterLastObservedEdit).toBe(false);
    expect(trace.reportedCostUsd).toBeNull();
    expect(trace.completed).toBe(true);
  });
  test('provider failure cannot be successful even after code and final response', () => {
    expect(
      analyzeEvents([
        { type: 'turn.completed' },
        { type: 'turn.failed', error: { message: 'provider failed' } },
      ]).completed,
    ).toBe(false);
  });
});

test.each([
  { candidateStatus: 'completed', split: false, judgePacketMode: 'full' },
  { candidateStatus: 'timed_out', split: false, judgePacketMode: 'full' },
  { candidateStatus: 'completed', split: true, judgePacketMode: 'full' },
  { candidateStatus: 'completed', split: true, judgePacketMode: 'compact' },
] as const)(
  'campaign verifies delivery and informs judge of candidate execution: %s',
  async ({ candidateStatus, split, judgePacketMode }) => {
    const { root, put } = fixture();
    const rates = {
      inputPerMillion: 2,
      cachedInputPerMillion: 0.5,
      cacheWritePerMillion: 2.5,
      outputPerMillion: 10,
      longContextThresholdTokens: null,
      source: { kind: 'user', url: 'fixture', verifiedOn: '2026-09-15' },
    };
    const pricing = {
      schemaVersion: 1,
      currency: 'USD',
      models: { 'gpt-5.6-luna': rates, [JUDGE.model]: rates },
    };
    put('evals/coding/pricing.json', JSON.stringify(pricing));
    put('evals/coding/tasks/example/acceptance.browser.spec.ts', 'original browser acceptance');
    const exactPrompt = '# Requisitos completos\r\n\r\nImplementa comportamiento observable.  \r\n';
    put('complete.md', exactPrompt);
    put('evals/coding/tasks/example/design/reference.svg', '<svg>Frozen public design</svg>');
    const baseline = snapshot(root, join(root, '.agent-evals/fixture-baseline'));
    const skillContent =
      '---\nname: task-process\ndescription: Implement and verify a task.\n---\nUse behavior evidence.\n';
    put('injected/SKILL.md', skillContent);
    const expectedPrompt = split
      ? buildTaskSkillPrompt(
          'Implement the task.',
          exactPrompt,
          readProcessSkill(root, 'injected/SKILL.md'),
        )
      : exactPrompt;
    const privateSource = mkdtempSync(join(tmpdir(), 'coding-private-'));
    folders.push(privateSource);
    for (const folder of ['dossier', 'acceptance']) mkdirSync(join(privateSource, folder));
    writeFileSync(
      join(privateSource, 'dossier/dossier.json'),
      JSON.stringify({ taskId: 'example', version: 'v1' }),
    );
    writeFileSync(join(privateSource, 'dossier/bugs.md'), 'PRIVATE_KNOWN_BUG');
    writeFileSync(
      join(privateSource, 'acceptance/acceptance.json'),
      JSON.stringify({
        taskId: 'example',
        version: 'v1',
        command: ['bun', 'test', 'reserved.spec.ts'],
      }),
    );
    writeFileSync(join(privateSource, 'acceptance/reserved.spec.ts'), 'PRIVATE_ASSERTION');
    let agentCalls = 0;
    let verifies = 0;
    let candidateBrowserOpen = false;
    const campaign = await runCampaign(
      root,
      configSchema.parse({
        task: 'example',
        skills: ['one'],
        baseline,
        promptFile: split ? null : join(root, 'complete.md'),
        taskFile: split ? 'complete.md' : null,
        processSkill: split ? 'injected/SKILL.md' : null,
        judgeDossier: split ? join(privateSource, 'dossier') : null,
        privateAcceptance: split ? join(privateSource, 'acceptance') : null,
        judgePacketMode,
        selfVerify: true,
        browserSkill: false,
      }),
      {
        browser: async (run) => {
          candidateBrowserOpen = true;
          try {
            return await run('ws://127.0.0.1:43125/candidate');
          } finally {
            candidateBrowserOpen = false;
          }
        },
        agent: async (options) => {
          agentCalls++;
          if (!options.readOnly) {
            expect(options.prompt).toBe(expectedPrompt);
            expect(options.prompt).not.toContain('PRIVATE_');
            expect(
              git(options.root, ['log', '--all', '--oneline', '--', 'bugs.md', 'reserved.spec.ts']),
            ).toBe('');
            expect(existsSync(join(options.root, 'judge-dossier'))).toBe(false);
            if (split)
              expect(
                readFileSync(join(options.root, '.agents/skills/task-process/SKILL.md'), 'utf8'),
              ).toBe(skillContent);
          }
          mkdirSync(options.output, { recursive: true });
          const eventsPath = join(options.output, 'events.jsonl'),
            finalPath = join(options.output, 'final.txt');
          if (options.readOnly) {
            expect(candidateBrowserOpen).toBe(false);
            expect(options.env?.EVAL_BROWSER_WS_ENDPOINT).toBeUndefined();
            expect(options.timeoutSeconds).toBe(600);
            expect(
              JSON.parse(readFileSync(join(options.root, 'candidate-execution.json'), 'utf8')),
            ).toMatchObject({
              status: candidateStatus,
              timeoutSeconds: null,
              responseKind: candidateStatus === 'completed' ? 'final' : 'last-observed-text',
            });
            if (split) {
              expect(readFileSync(join(options.root, 'judge-dossier/bugs.md'), 'utf8')).toBe(
                'PRIVATE_KNOWN_BUG',
              );
              expect(
                readFileSync(join(options.root, 'private-acceptance/reserved.spec.ts'), 'utf8'),
              ).toBe('PRIVATE_ASSERTION');
              expect(
                JSON.parse(readFileSync(join(options.root, 'private-acceptance.json'), 'utf8'))
                  .passed,
              ).toBe(false);
            }
            expect(
              readFileSync(join(options.root, 'task-reference/design/reference.svg'), 'utf8'),
            ).toBe('<svg>Frozen public design</svg>');
            expect(options.model).toBe(JUDGE.model);
            expect(options.effort).toBe(JUDGE.effort);
            expect(options.schema).toBeDefined();
            expect(readFileSync(join(options.root, 'TASK.md'), 'utf8')).toBe(exactPrompt);
            if (split) {
              expect(readFileSync(join(options.root, 'process-skill.md'), 'utf8')).toBe(
                skillContent,
              );
              expect(
                readFileSync(
                  join(options.root, 'guidance/.agents/skills/task-process/SKILL.md'),
                  'utf8',
                ),
              ).toBe(skillContent);
            }
            const packetManifest = JSON.parse(
              readFileSync(join(options.root, 'packet-manifest.json'), 'utf8'),
            );
            const processSummary = JSON.parse(
              readFileSync(join(options.root, 'process-summary.json'), 'utf8'),
            );
            expect(packetManifest.mode).toBe(judgePacketMode);
            expect(packetManifest.criticalHashes.task).toBeString();
            expect(packetManifest.criticalHashes.candidatePatch).toBeString();
            expect(
              JSON.parse(readFileSync(join(options.root, 'experiment.json'), 'utf8'))
                .judgePacketMode,
            ).toBe(judgePacketMode);
            if (judgePacketMode === 'compact') {
              expect(existsSync(join(options.root, 'process.json'))).toBe(false);
              expect(processSummary).not.toHaveProperty('finalResponse');
              expect(processSummary).not.toHaveProperty('sessionId');
              expect(processSummary).not.toHaveProperty('usage');
              expect(processSummary).not.toHaveProperty('reportedCostUsd');
              expect(processSummary).not.toHaveProperty('apiCostEstimate');
              expect(processSummary.commands).toHaveLength(2);
              expect(processSummary.commands[0].output).toHaveLength(1200);
              expect(processSummary.commands[0].fullOutput).toBe('process-output/event-0.txt');
              expect(processSummary.commands[1].fullOutput).toBe('process-output/event-1.txt');
              expect(
                readFileSync(join(options.root, processSummary.commands[0].fullOutput), 'utf8'),
              ).toEndWith('VERIFY_OUTPUT_TAIL');
              expect(processSummary.verify.callEvents).toEqual([0]);
              expect(processSummary.verify.timeline).toEqual({
                lastObservedEditEvent: null,
                lastVerifyEvent: 0,
                lastBrowserEvent: 1,
                lastSuccessfulRelevantCheckEvent: 1,
                finalStateVerification: 'no-observed-edits',
              });
              expect(processSummary.browserCommandEvents).toEqual([1]);
              expect(JSON.stringify(processSummary).split('VERIFY_OUTPUT_TAIL')).toHaveLength(2);
              expect(existsSync(join(options.root, 'guidance/.agents/skills/two'))).toBe(false);
              expect(
                readFileSync(join(options.root, 'guidance/.agents/skills/one/SKILL.md'), 'utf8'),
              ).toBe('# one');
              expect(readdirSync(join(options.root, 'skills')).sort()).toEqual([
                'one',
                'task-process',
              ]);
              expect(packetManifest.omitted).toContain('process.json');
            } else {
              expect(existsSync(join(options.root, 'process.json'))).toBe(true);
              expect(existsSync(join(options.root, 'guidance/.agents/skills/two/SKILL.md'))).toBe(
                true,
              );
            }
            expect(
              JSON.parse(readFileSync(join(options.root, 'experiment.json'), 'utf8')).selfVerify,
            ).toBeNull();
            expect(readFileSync(join(options.root, 'verification-after.json'), 'utf8')).toContain(
              'acceptance',
            );
            const criterion = {
              score: 2,
              explanation: 'Fixture evidence',
              evidence: ['files/new.ts'],
            };
            const judgment = judgmentSchema.parse({
              functionality: criterion,
              codeQuality: criterion,
              testQuality: criterion,
              projectGuidelines: criterion,
              verificationProcess: { ...criterion, score: 0 },
              reportAccuracy: criterion,
              verdict: 'pass',
              findings: [],
              limitations: [],
            });
            writeFileSync(finalPath, JSON.stringify(judgment));
          } else {
            expect(options.timeoutSeconds).toBeNull();
            expect(candidateBrowserOpen).toBe(true);
            expect(options.env?.EVAL_BROWSER_WS_ENDPOINT).toBe('ws://127.0.0.1:43125/candidate');
            // A controller table edit during execution must not alter this campaign's tariff.
            put('evals/coding/pricing.json', JSON.stringify({ ...pricing, models: {} }));
            expect(options.prompt).toBe(expectedPrompt);
            writeFileSync(
              join(options.root, 'evals/coding/tasks/example/design/reference.svg'),
              '<svg>Candidate modified design</svg>',
            );
            writeFileSync(join(options.root, 'new.ts'), 'export const implemented = true;');
            writeFileSync(
              join(options.root, 'packages/core/core.test.ts'),
              'candidate changed test',
            );
            writeFileSync(
              join(options.root, 'evals/coding/tasks/example/acceptance.browser.spec.ts'),
              'candidate browser acceptance',
            );
            writeFileSync(finalPath, 'Implemented, did not verify.');
          }
          writeFileSync(
            eventsPath,
            `${[
              {
                type: 'item.completed',
                item: {
                  type: 'command_execution',
                  command: 'bun run verify',
                  exit_code: 0,
                  aggregated_output: `${'v'.repeat(1300)}VERIFY_OUTPUT_TAIL`,
                },
              },
              {
                type: 'item.completed',
                item: {
                  type: 'command_execution',
                  command: 'bun run test:eval-browser',
                  exit_code: 0,
                  aggregated_output: 'BROWSER_OUTPUT',
                },
              },
              {
                type: 'item.completed',
                item: { type: 'agent_message', text: 'TRACE_FINAL_DUPLICATE' },
              },
              {
                type: 'turn.completed',
                usage: {
                  input_tokens: 1000,
                  cached_input_tokens: 600,
                  cache_write_input_tokens: 100,
                  output_tokens: 200,
                  reasoning_output_tokens: 50,
                },
              },
            ]
              .map((event) => JSON.stringify(event))
              .join('\n')}\n`,
          );
          return {
            status: options.readOnly ? 'completed' : candidateStatus,
            exitCode: 0,
            eventsPath,
            finalPath,
            stdoutPath: eventsPath,
            stderrPath: eventsPath,
            durationMs: 1,
            command: ['fixture'],
            compactions: {
              count: 2,
              observedCount: 2,
              source: 'codex-rollout',
              coverage: 'complete',
              evidence: [],
              limitations: [],
            },
          };
        },
        verify: async (options) => {
          verifies++;
          if (split) put('injected/SKILL.md', 'Changed after input was frozen.');
          if (options.root.endsWith('candidate-tests-worktree')) {
            expect(options.checks?.map((check) => check.id)).toEqual([
              'candidate-tests',
              'candidate-acceptance-tests',
            ]);
            expect(
              options.checks?.find((check) => check.id === 'candidate-tests')?.command.join(' '),
            ).not.toContain('.browser.spec.ts');
            expect(
              readFileSync(
                join(options.root, 'evals/coding/tasks/example/acceptance.browser.spec.ts'),
                'utf8',
              ),
            ).toBe('candidate browser acceptance');
          }
          expect(candidateBrowserOpen).toBe(false);
          if (options.checks?.[0]?.id === 'private-acceptance') {
            expect(agentCalls).toBe(1);
            expect(options.env?.EVAL_PROJECT_ROOT).toContain('verification-worktree');
            expect(readFileSync(join(options.root, 'reserved.spec.ts'), 'utf8')).toBe(
              'PRIVATE_ASSERTION',
            );
            return {
              schemaVersion: 1,
              root: options.root,
              startedAt: '',
              finishedAt: '',
              timeoutSeconds: 1,
              passed: false,
              checks: [],
            };
          }
          expect(readFileSync(join(options.root, 'packages/core/core.test.ts'), 'utf8')).toBe(
            options.root.endsWith('candidate-tests-worktree')
              ? 'candidate changed test'
              : 'original expectations\n',
          );
          mkdirSync(options.output, { recursive: true });
          const checks = (options.checks ?? []).map((check) => {
            const path = join(options.output, `${check.id}.log`);
            writeFileSync(path, 'reference check output');
            return {
              ...check,
              status: 'passed' as const,
              exitCode: 0,
              signal: null,
              durationMs: 1,
              stdoutPath: path,
              stderrPath: path,
            };
          });
          return {
            schemaVersion: 1,
            root: options.root,
            startedAt: '',
            finishedAt: '',
            timeoutSeconds: 1,
            passed: true,
            checks,
          };
        },
      },
    );
    const result = JSON.parse(readFileSync(join(campaign, 'runs/001/result.json'), 'utf8'));
    expect(result.error).toBeUndefined();
    expect(result.judgePacketMode).toBe(judgePacketMode);
    expect(result.judgePacket.mode).toBe(judgePacketMode);
    expect(result.judgePacket.criticalHashes.candidatePatch).toBeString();
    expect(agentCalls).toBe(2);
    expect(verifies).toBe(split ? 4 : 3);
    if (split) {
      expect(result.privateAcceptancePassed).toBe(false);
      expect(result.passed).toBe(false);
      expect(result.judgeDossier.version).toBe('v1');
      const originalResult = readFileSync(join(campaign, 'runs/001/result.json'), 'utf8');
      const originalJudgment = readFileSync(join(campaign, 'runs/001/judgment.json'), 'utf8');
      writeFileSync(
        join(privateSource, 'dossier/dossier.json'),
        JSON.stringify({ taskId: 'example', version: 'v2' }),
      );
      writeFileSync(join(privateSource, 'dossier/bugs.md'), 'NEW_BUG_EVIDENCE');
      await expect(
        rejudgeRun(root, join(campaign, 'runs/001'), join(privateSource, 'dossier'), async () => {
          throw new Error('Unexpected judge invocation in retention test');
        }),
      ).rejects.toThrow('final results only');
      expect(readFileSync(join(campaign, 'runs/001/result.json'), 'utf8')).toBe(originalResult);
      expect(readFileSync(join(campaign, 'runs/001/judgment.json'), 'utf8')).toBe(originalJudgment);
      const frozen = JSON.parse(readFileSync(join(campaign, 'private-inputs.json'), 'utf8'));
      folders.push(dirname(frozen.dossier.root));
      expect(result.candidatePrompt.mode).toBe('task-skill');
      expect(result.candidatePrompt.injectedProcessSkill).toMatchObject({
        delivery: 'inline',
        sha256: createHash('sha256').update(skillContent).digest('hex'),
      });
      expect(readFileSync(join(campaign, 'process-skill.md'), 'utf8')).toBe(skillContent);
    }
    expect(result.status).toBe(candidateStatus === 'completed' ? 'evaluated' : 'incomplete');
    expect(result.candidatePrompt.sha256).toBe(
      createHash('sha256').update(expectedPrompt).digest('hex'),
    );
    expect(readFileSync(join(campaign, 'runs/001', result.candidatePrompt.path), 'utf8')).toBe(
      expectedPrompt,
    );
    expect(result.process.verify.observed).toBe(true);
    expect(result.process.compactions.count).toBe(2);
    expect(result.judgeProcess.compactions.count).toBe(2);
    expect(result.referenceChanges.map((change: { path: string }) => change.path)).toContain(
      'packages/core/core.test.ts',
    );
    expect(result.availableSkills).toEqual(split ? ['one', 'task-process'] : ['one']);
    expect(result.judgment.verificationProcess.score).toBe(0);
    expect(result.process.reportedCostUsd).toBeNull();
    expect(result.process.apiCostEstimate.estimatedApiCostUsd).toBeCloseTo(0.00315, 10);
    expect(result.judgeProcess.apiCostEstimate.estimatedApiCostUsd).toBeCloseTo(0.00315, 10);
    expect(result.cost.complete).toBe(true);
    expect(result.estimatedApiCostUsd).toBeCloseTo(0.0063, 10);
    expect(JSON.parse(readFileSync(join(campaign, 'runs/001/cost.json'), 'utf8'))).toEqual(
      result.cost,
    );
    const frozenPricing = readFileSync(join(campaign, 'pricing.json'), 'utf8');
    expect(JSON.parse(frozenPricing)).toEqual(pricing);
    const inputs = JSON.parse(readFileSync(join(campaign, 'inputs.json'), 'utf8'));
    expect(inputs.judgePacketMode).toBe(judgePacketMode);
    expect(inputs.pricingSha256).toBe(createHash('sha256').update(frozenPricing).digest('hex'));
    expect(JSON.parse(readFileSync(join(campaign, 'manifest.json'), 'utf8')).judgePacketMode).toBe(
      judgePacketMode,
    );
    saveJson(join(campaign, 'fixture-only.json'), { realModelCalls: 0 });
  },
  30000,
);

test('edited inputs and initial skills are frozen once, separate from available skills and external checks', async () => {
  const { root, put } = fixture();
  const specification = '  Requirements\r\nExact whitespace.\r\n';
  const process = 'Edited process instruction.\n';
  const skill = '---\nname: one\ndescription: Initial behavior.\n---\nINITIAL_UNIQUE_INSTRUCTION\n';
  put('.agents/skills/one/SKILL.md', skill);
  put('.agents/skills/one/references/rules.md', 'FROZEN_RULES');
  put('original-spec.md', 'original');
  put(
    'package.json',
    JSON.stringify({
      scripts: {
        test: 'reference',
        lint: 'biome check .',
        typecheck: 'tsc --noEmit',
        verify: 'bun scripts/verification/verify.ts',
      },
    }),
  );
  const seen: string[] = [];
  let verifies = 0;
  const campaign = await runCampaign(
    root,
    configSchema.parse({
      task: 'example',
      skills: [],
      browserSkill: false,
      initialSkills: ['one', 'one'],
      taskFile: 'original-spec.md',
      processSkill: '.agents/skills/missing/SKILL.md',
      specificationText: specification,
      promptText: process,
      candidateChecks: [],
      repeats: 2,
    }),
    {
      browser: async (run) => run('ws://fixture'),
      verify: async (options) => {
        verifies++;
        expect(readFileSync(join(options.root, 'packages/core/core.test.ts'), 'utf8')).toBe(
          'original expectations\n',
        );
        expect(
          JSON.parse(readFileSync(join(options.root, 'package.json'), 'utf8')).scripts.test,
        ).toBe('reference');
        expect(options.checks?.map((check) => check.id)).toContain('tests');
        put('original-spec.md', 'changed after freezing');
        put('.agents/skills/one/SKILL.md', 'changed after freezing');
        put('.agents/skills/one/references/rules.md', 'changed reference');
        return {
          schemaVersion: 1,
          root: options.root,
          startedAt: '',
          finishedAt: '',
          timeoutSeconds: 1,
          passed: true,
          checks: [],
        };
      },
      agent: async (options) => {
        if (options.readOnly) throw new Error('Judge boundary verified separately; no model');
        seen.push(options.prompt);
        expect(options.prompt.split('INITIAL_UNIQUE_INSTRUCTION')).toHaveLength(2);
        expect(options.prompt).toContain(specification);
        expect(options.prompt).toContain(process);
        expect(existsSync(join(options.root, 'packages/core/core.test.ts'))).toBe(false);
        const scripts = JSON.parse(
          readFileSync(join(options.root, 'package.json'), 'utf8'),
        ).scripts;
        expect(scripts.test).toBeUndefined();
        expect(scripts.lint).toBeUndefined();
        expect(scripts.typecheck).toBeUndefined();
        const restrictedVerifier = await import(
          join(options.root, 'scripts/verification/verify.ts')
        );
        expect(restrictedVerifier.defaultChecks()).toEqual([]);
        expect(readFileSync(join(options.root, '.agents/skills/one/SKILL.md'), 'utf8')).toBe(skill);
        expect(
          readFileSync(join(options.root, '.agents/skills/one/references/rules.md'), 'utf8'),
        ).toBe('FROZEN_RULES');
        mkdirSync(options.output, { recursive: true });
        const eventsPath = join(options.output, 'events.jsonl');
        const finalPath = join(options.output, 'final.txt');
        writeFileSync(eventsPath, '');
        writeFileSync(finalPath, 'No changes.');
        return {
          status: 'completed',
          exitCode: 0,
          durationMs: 1,
          eventsPath,
          finalPath,
          stdoutPath: eventsPath,
          stderrPath: eventsPath,
          command: ['fixture'],
        };
      },
    },
  );
  expect(seen).toHaveLength(2);
  expect(seen[0]).toBe(seen[1]);
  expect(verifies).toBe(3);
  expect(readFileSync(join(campaign, 'task-prompt.md'), 'utf8')).toBe(specification);
  expect(readFileSync(join(campaign, 'process-prompt.md'), 'utf8')).toBe(process);
  const inputs = JSON.parse(readFileSync(join(campaign, 'inputs.json'), 'utf8'));
  expect(inputs.candidatePrompt.mode).toBe('editable');
  expect(inputs.candidatePrompt.initialSkills).toHaveLength(1);
  for (const id of ['001', '002']) {
    expect(readFileSync(join(campaign, 'runs', id, 'candidate.patch'), 'utf8')).toBe('');
    expect(
      JSON.parse(readFileSync(join(campaign, 'runs', id, 'reference-changes.json'), 'utf8')),
    ).toEqual([]);
    expect(existsSync(join(campaign, 'runs', id, 'judge-input'))).toBe(false);
    expect(existsSync(join(campaign, 'runs', id, 'candidate'))).toBe(false);
    expect(existsSync(join(campaign, 'runs', id, 'verification-worktree'))).toBe(false);
  }
}, 30000);

test('candidate checks distinguish general tests, browser acceptance and lint without changing product files', () => {
  const { root, put } = fixture();
  put('evals/coding/browser/base.spec.ts', 'browser assertion');
  put('evals/coding/tasks/example/acceptance.browser.spec.ts', 'acceptance assertion');
  put('evals/coding/tasks/example/playwright.config.ts', 'acceptance config');
  put('biome.json', '{}');
  put('tsconfig.json', '{}');
  put(
    'package.json',
    JSON.stringify({
      scripts: {
        test: 'bun test ./packages',
        lint: 'biome check .',
        typecheck: 'tsc --noEmit',
        'test:eval-browser': 'playwright test',
        verify: 'bun scripts/verification/verify.ts',
      },
    }),
  );
  git(root, ['add', '.']);
  const selection = provisionCandidateChecks(root, ['lint', 'typecheck', 'browser']);
  expect(selection.removedFiles).toContain('packages/core/core.test.ts');
  expect(selection.removedFiles).toContain('evals/coding/tasks/example/acceptance.browser.spec.ts');
  expect(selection.removedFiles).toContain('evals/coding/tasks/example/playwright.config.ts');
  expect(existsSync(join(root, 'evals/coding/browser/base.spec.ts'))).toBe(true);
  expect(existsSync(join(root, 'biome.json'))).toBe(true);
  expect(existsSync(join(root, 'tsconfig.json'))).toBe(true);
  expect(readFileSync(join(root, 'packages/core/index.ts'), 'utf8')).toBe(
    'export const version = 1;\n',
  );
  const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
  expect(scripts.test).toBeUndefined();
  expect(scripts.verify).toBe('bun run lint && bun run typecheck && bun run test:eval-browser');
});

test('legacy code baseline uses frozen controller tasks and offered skills without injecting the evaluator kit into candidate code', async () => {
  const { root, put } = fixture();
  const original = git(root, ['rev-parse', 'HEAD']);
  put(
    'package.json',
    JSON.stringify({
      scripts: { lint: 'true', typecheck: 'true', test: 'true', 'test:eval-browser': 'true' },
    }),
  );
  git(root, ['rm', '-r', '.agents', 'evals', 'scripts/verification']);
  git(root, ['add', 'package.json']);
  git(root, ['commit', '-qm', 'Legacy code without evaluation kit']);
  const legacy = git(root, ['rev-parse', 'HEAD']);
  git(root, [
    'restore',
    `--source=${original}`,
    '--worktree',
    '--',
    '.agents',
    'evals',
    'scripts/verification',
  ]);
  put('.agents/skills/one/SKILL.md', 'CONTROLLER_SKILL');
  put('.agents/skills/one/references/rules.md', 'CONTROLLER_RULES');
  let candidateReached = false;
  let judgeReached = false;
  const campaign = await runCampaign(
    root,
    configSchema.parse({ task: 'example', baseline: legacy, skills: ['one'], browserSkill: false }),
    {
      browser: async (run) => run('ws://fixture'),
      verify: async (options) => {
        expect(existsSync(join(options.root, 'evals/coding/tasks/example/task.json'))).toBe(false);
        expect(existsSync(join(options.root, 'scripts/verification/verify.ts'))).toBe(false);
        put('.agents/skills/one/SKILL.md', 'LIVE_CHANGED_SKILL');
        put('.agents/skills/one/references/rules.md', 'LIVE_CHANGED_RULES');
        put('evals/coding/tasks/example/prompt.md', 'LIVE_CHANGED_TASK');
        return {
          schemaVersion: 1,
          root: options.root,
          startedAt: '',
          finishedAt: '',
          timeoutSeconds: 1,
          passed: true,
          checks: [],
        };
      },
      agent: async (options) => {
        if (options.readOnly) {
          expect(readFileSync(join(options.root, 'TASK.md'), 'utf8')).toBe(
            'Implement useful behavior.',
          );
          expect(readFileSync(join(options.root, 'task-reference/prompt.md'), 'utf8')).toBe(
            'Implement useful behavior.',
          );
          expect(
            readFileSync(join(options.root, 'guidance/.agents/skills/one/SKILL.md'), 'utf8'),
          ).toBe('CONTROLLER_SKILL');
          judgeReached = true;
          throw new Error('No real judge in fixture');
        }
        expect(readFileSync(join(options.root, '.agents/skills/one/SKILL.md'), 'utf8')).toBe(
          'CONTROLLER_SKILL',
        );
        expect(
          readFileSync(join(options.root, '.agents/skills/one/references/rules.md'), 'utf8'),
        ).toBe('CONTROLLER_RULES');
        expect(existsSync(join(options.root, 'evals/coding'))).toBe(false);
        expect(existsSync(join(options.root, 'scripts/verification'))).toBe(false);
        expect(options.prompt).toContain('Implement useful behavior.');
        candidateReached = true;
        mkdirSync(options.output, { recursive: true });
        const eventsPath = join(options.output, 'events.jsonl');
        const finalPath = join(options.output, 'final.txt');
        writeFileSync(eventsPath, '');
        writeFileSync(finalPath, 'Done');
        return {
          status: 'completed',
          exitCode: 0,
          durationMs: 1,
          eventsPath,
          finalPath,
          stdoutPath: eventsPath,
          stderrPath: eventsPath,
          command: ['fixture'],
        };
      },
    },
  );
  expect(candidateReached).toBe(true);
  expect(judgeReached).toBe(true);
  const inputs = JSON.parse(readFileSync(join(campaign, 'inputs.json'), 'utf8'));
  expect(inputs.baselineCommit).toBe(legacy);
  expect(inputs.candidatePrompt.availableSkills[0].sha256).toBe(
    createHash('sha256').update('CONTROLLER_SKILL').digest('hex'),
  );
  expect(readFileSync(join(campaign, 'runs/001/candidate.patch'), 'utf8')).toBe('');
}, 30000);

test('editing a process skill does not suppress explicitly selected original initial skill or copy arbitrary resources', async () => {
  const { root, put } = fixture();
  const original = '---\nname: one\ndescription: Original workflow.\n---\nORIGINAL_WORKFLOW\n';
  put('.agents/skills/one/SKILL.md', original);
  put('outside/SKILL.md', 'outside prompt');
  put('outside/unrelated.secret', 'DO_NOT_COPY');
  for (const processSkill of ['.agents/skills/one/SKILL.md', 'outside/SKILL.md']) {
    const campaign = await runCampaign(
      root,
      configSchema.parse({
        task: 'example',
        skills: [],
        browserSkill: false,
        prepareOnly: true,
        specificationText: '',
        promptText: 'EDITED_WORKFLOW',
        processSkill,
        initialSkills: ['one', 'one'],
      }),
      {
        agent: async () => {
          throw new Error('No model');
        },
        browser: async () => {
          throw new Error('No browser');
        },
        verify: async (options) => ({
          schemaVersion: 1,
          root: options.root,
          startedAt: '',
          finishedAt: '',
          timeoutSeconds: 1,
          passed: true,
          checks: [],
        }),
      },
    );
    const prompt = readFileSync(join(campaign, 'candidate-prompt.md'), 'utf8');
    expect(prompt).toContain('EDITED_WORKFLOW');
    expect(prompt.split('ORIGINAL_WORKFLOW')).toHaveLength(2);
    expect(readFileSync(join(campaign, 'task-prompt.md'), 'utf8')).toBe('');
    expect(existsSync(join(campaign, 'process-skill-resources/unrelated.secret'))).toBe(false);
  }
}, 30000);

test('language choice freezes matching resources and a single-skill override without changing the task', async () => {
  const { root, put } = fixture();
  const skill = (name: string, text: string) =>
    `---\nname: ${name}\ndescription: Test guidance\n---\n${text}\n`;
  for (const name of ['one', 'two']) {
    put(`.agents/skills/${name}/SKILL.md`, skill(name, `English ${name}`));
    put(`.agents/skills/${name}/references/rule.md`, `English reference ${name}`);
    put(`evals/coding/skill-locales/es/${name}/SKILL.md`, skill(name, `Español ${name}`));
    put(`evals/coding/skill-locales/es/${name}/references/rule.md`, `Referencia española ${name}`);
  }
  let checked = false;
  const campaign = await runCampaign(
    root,
    configSchema.parse({
      task: 'example',
      skills: ['one', 'two'],
      browserSkill: false,
      skillLanguage: 'es',
      skillLanguages: { two: 'en' },
      initialSkills: ['two'],
      taskFile: 'evals/coding/tasks/example/prompt.md',
      processSkill: '.agents/skills/one/SKILL.md',
    }),
    {
      verify: async (options) => ({
        schemaVersion: 1,
        root: options.root,
        startedAt: '',
        finishedAt: '',
        timeoutSeconds: 1,
        passed: true,
        checks: [],
      }),
      browser: async (run) => run('ws://fixture'),
      agent: async (options) => {
        expect(options.prompt).toContain('Español one');
        expect(options.prompt).toContain('English two');
        expect(options.prompt).not.toContain('English one');
        expect(
          readFileSync(join(options.root, '.agents/skills/one/references/rule.md'), 'utf8'),
        ).toBe('Referencia española one');
        expect(
          readFileSync(join(options.root, '.agents/skills/two/references/rule.md'), 'utf8'),
        ).toBe('English reference two');
        expect(existsSync(join(options.root, 'evals/coding/skill-locales'))).toBe(false);
        checked = true;
        throw new Error('Stop at observed candidate boundary; no model execution');
      },
    },
  );
  expect(checked).toBe(true);
  const inputs = JSON.parse(readFileSync(join(campaign, 'inputs.json'), 'utf8'));
  expect(inputs.candidatePrompt.skillLanguages).toEqual({ one: 'es', two: 'en' });
  expect(readFileSync(join(campaign, 'task-prompt.md'), 'utf8')).toBe('Implement useful behavior.');
  put('evals/coding/skill-locales/es/one/references/rule.md', 'later change');
  expect(readFileSync(join(campaign, 'available-skills/one/references/rule.md'), 'utf8')).toBe(
    'Referencia española one',
  );
}, 30000);

test('missing translation rejects the campaign before any candidate, rather than silently using English', async () => {
  const { root } = fixture();
  let calls = 0;
  await expect(
    runCampaign(
      root,
      configSchema.parse({
        task: 'example',
        skills: ['one'],
        browserSkill: false,
        skillLanguage: 'es',
      }),
      {
        verify: async () => {
          throw new Error('No verification before valid inputs');
        },
        browser: async () => {
          throw new Error('No browser before valid inputs');
        },
        agent: async () => {
          calls++;
          throw new Error('No model');
        },
      },
    ),
  ).rejects.toThrow('Missing or unsafe es skill');
  expect(calls).toBe(0);
});

test('enabling tests preserves the product suite and excludes controller tests', () => {
  const { root, put } = fixture();
  const command = 'bun test ./packages ./scripts/verification ./scripts/coding-eval';
  put(
    'package.json',
    JSON.stringify({ scripts: { test: command, verify: 'bun scripts/verification/verify.ts' } }),
  );
  git(root, ['add', '.']);
  provisionCandidateChecks(root, ['tests']);
  const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
  expect(scripts.test).toBe('bun test ./packages');
  expect(scripts.verify).toBe('bun run test');
});

const selectableChecks = ['lint', 'typecheck', 'tests', 'architecture', 'browser'] as const;
test.each(Array.from({ length: 32 }, (_, mask) => mask))(
  'check combination %s preserves enabled suites and removes disabled suites',
  async (mask) => {
    const { root, put } = fixture();
    const enabled = selectableChecks.filter((_, index) => mask & (1 << index));
    const definitions = {
      lint: ['lint', 'biome check .', 'biome.json'],
      typecheck: ['typecheck', 'tsc --noEmit', null],
      tests: [
        'test',
        'bun test ./packages/core ./tests/architecture ./scripts/coding-eval',
        'packages/core/core.test.ts',
      ],
      architecture: [
        'check:architecture',
        'bun test ./tests/architecture/dependencies.test.ts',
        'tests/architecture/dependencies.test.ts',
      ],
      browser: [
        'test:eval-browser',
        'node node_modules/@playwright/test/cli.js test',
        'tests/browser/example.spec.ts',
      ],
    } as const;
    put(
      'package.json',
      JSON.stringify({
        scripts: Object.fromEntries(
          Object.values(definitions).map(([name, command]) => [name, command]),
        ),
      }),
    );
    for (const [, , path] of Object.values(definitions)) if (path) put(path, '');
    put('scripts/coding-eval/controller.test.ts', 'throw new Error("controller-only");');
    git(root, ['add', '.']);
    provisionCandidateChecks(root, enabled);
    const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
    for (const check of selectableChecks) {
      const [name, , path] = definitions[check];
      expect(typeof scripts[name] === 'string').toBe(enabled.includes(check));
      if (path) expect(existsSync(join(root, path))).toBe(enabled.includes(check));
    }
    if (enabled.includes('tests')) {
      expect(scripts.test.includes('./packages/core')).toBe(true);
      expect(scripts.test.includes('./tests/architecture')).toBe(enabled.includes('architecture'));
      expect(scripts.test).not.toContain('scripts/coding-eval');
    }
    expect(existsSync(join(root, 'scripts/coding-eval/controller.test.ts'))).toBe(false);
    expect(scripts.verify).toBe(
      enabled.length
        ? enabled.map((check) => `bun run ${definitions[check][0]}`).join(' && ')
        : undefined,
    );
    const verifier = await import(join(root, 'scripts/verification/verify.ts'));
    expect(verifier.defaultChecks().map((check: { id: string }) => check.id)).toEqual(
      ['lint', 'tests'].filter((id) => enabled.some((check) => check === id)),
    );
  },
  30_000,
);
