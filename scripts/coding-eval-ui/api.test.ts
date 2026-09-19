import { afterEach, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLabApi, type Launch } from './api';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function fixture(
  launch: Launch = () => {
    throw new Error('Must not invoke a model');
  },
) {
  const project = mkdtempSync(join(tmpdir(), 'eval-ui-'));
  folders.push(project);
  mkdirSync(join(project, 'evals/coding/tasks/demo'), { recursive: true });
  mkdirSync(join(project, 'evals/coding/prompts'), { recursive: true });
  writeFileSync(join(project, 'evals/coding/prompts/candidate.md'), 'Implement the task');
  writeFileSync(
    join(project, 'evals/coding/tasks/demo/task.json'),
    JSON.stringify({
      id: 'demo',
      title: 'Demo',
      description: 'Demo',
      browser: false,
      expectedSkills: [],
    }),
  );
  const api = createLabApi(project, 'test-token', launch);
  const request = (path: string, body?: unknown, authorized = true) =>
    api(
      new Request(`http://127.0.0.1:3415${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          host: '127.0.0.1:3415',
          ...(body
            ? {
                'content-type': 'application/json',
                origin: authorized ? 'http://127.0.0.1:3415' : 'https://other.example',
                'x-lab-token': 'test-token',
              }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  return { project, request };
}
test('saves validated recipes and rejects cross-origin writes and invalid configuration', async () => {
  const { request } = fixture();
  expect(
    (await request('/api/recipes', { name: 'base', config: { task: 'demo' } }, false)).status,
  ).toBe(403);
  expect(
    (await request('/api/recipes', { name: '../escape', config: { task: 'demo' } })).status,
  ).toBe(400);
  expect(
    (await request('/api/recipes', { name: 'bad', config: { task: 'demo', repeats: 0 } })).status,
  ).toBe(400);
  expect((await request('/api/recipes', { name: 'base', config: { task: 'demo' } })).status).toBe(
    200,
  );
  const response = await request('/api/recipes');
  expect(await response.json()).toMatchObject([
    { name: 'base', config: { task: 'demo', repeats: 1 } },
  ]);
});
test('listing excludes trace content and confines artifacts even through symlinks', async () => {
  const { project, request } = fixture();
  const run = join(project, '.agent-evals/campaign/runs/001');
  mkdirSync(run, { recursive: true });
  writeFileSync(
    join(project, '.agent-evals/campaign/manifest.json'),
    JSON.stringify({ id: 'campaign', status: 'evaluated', config: { task: 'demo' } }),
  );
  writeFileSync(
    join(run, 'result.json'),
    JSON.stringify({
      id: '001',
      status: 'evaluated',
      process: {
        finalResponse: 'PRIVATE TRACE',
        commands: [{ command: 'PRIVATE COMMAND' }],
        compactions: { count: null, observedCount: 0, coverage: 'unavailable' },
      },
    }),
  );
  const response = await request('/api/campaigns/campaign/runs/001');
  const content = await response.text();
  expect(content).not.toContain('PRIVATE');
  expect(content).toContain('unavailable');
  const secret = join(project, 'secret');
  writeFileSync(secret, 'secret');
  symlinkSync(secret, join(run, 'candidate-prompt.md'));
  expect((await request('/api/campaigns/campaign/runs/001/artifacts/prompt')).status).toBe(400);
  expect((await request('/api/campaigns/campaign/runs/001/artifacts/auth')).status).toBe(400);
});

test('launch snapshots the recipe and prepare mode never requests model execution', async () => {
  let configPath = '';
  let complete: (code: number) => void = () => {
    throw new Error('No active job');
  };
  const { request } = fixture((path) => {
    configPath = path;
    return new Promise<number>((resolve) => {
      complete = resolve;
    });
  });
  await request('/api/recipes', { name: 'base', config: { task: 'demo', prepareOnly: false } });
  const start = await request('/api/jobs', { name: 'base', mode: 'prepare' });
  expect(start.status).toBe(202);
  expect(JSON.parse(readFileSync(configPath, 'utf8'))).toMatchObject({
    task: 'demo',
    prepareOnly: true,
  });
  expect((await request('/api/jobs', { name: 'base', mode: 'run' })).status).toBe(409);
  await request('/api/recipes', {
    name: 'base',
    config: { task: 'demo', model: 'different-model' },
  });
  expect(JSON.parse(readFileSync(configPath, 'utf8')).model).toBe('gpt-5.6-luna');
  complete(0);
  // Observe completion rather than introducing a real runner process.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(await (await request('/api/jobs')).json()).toMatchObject([
    { status: 'completed', exitCode: 0 },
  ]);
});

test('catalog discovers real project inputs and observed models without exposing private contents', async () => {
  const { project, request } = fixture();
  mkdirSync(join(project, '.agents/skills/write-code'), { recursive: true });
  writeFileSync(
    join(project, '.agents/skills/write-code/SKILL.md'),
    '---\nname: write-code\n---\nWork',
  );
  writeFileSync(join(project, 'evals/coding/tasks/demo/specification.md'), 'Requirements');
  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify({
      scripts: {
        'typecheck:custom': 'tsc --noEmit',
        lint: 'biome check .',
        specs: 'bun test packages',
        dev: 'bun run app',
      },
    }),
  );
  const external = mkdtempSync(join(tmpdir(), 'eval-ui-private-'));
  folders.push(external);
  writeFileSync(join(external, 'dossier.json'), JSON.stringify({ taskId: 'demo', version: 'v2' }));
  writeFileSync(join(external, 'bugs.md'), 'DO NOT EXPOSE BUG CONTENTS');
  await request('/api/recipes', {
    name: 'observed',
    config: {
      task: 'demo',
      harness: 'opencode',
      model: 'provider/observed',
      judgeDossier: external,
    },
  });
  const catalog = (await (await request('/api/bootstrap')).json()).catalog;
  expect(catalog.skills).toContainEqual({
    name: 'write-code',
    path: '.agents/skills/write-code/SKILL.md',
    label: 'write-code',
    description: null,
  });
  expect(catalog.taskFiles).toContainEqual({
    taskId: 'demo',
    label: 'Demo',
    path: 'evals/coding/tasks/demo/specification.md',
  });
  expect(catalog.prompts).toContainEqual({
    label: 'candidate',
    path: 'evals/coding/prompts/candidate.md',
  });
  expect(catalog.baselines).toContainEqual({ value: 'working-tree', label: 'Cambios actuales' });
  expect(catalog.candidateChecks).toContainEqual({
    id: 'typecheck',
    label: 'Tipos',
    scripts: ['typecheck:custom'],
  });
  expect(catalog.candidateChecks).toContainEqual({
    id: 'tests',
    label: 'Tests',
    scripts: ['specs'],
  });
  expect(JSON.stringify(catalog.candidateChecks)).not.toContain('dev');
  expect(catalog.models).toEqual({ codex: ['gpt-5.6-luna'], opencode: ['provider/observed'] });
  expect(catalog.judgeDossiers).toContainEqual({
    taskId: 'demo',
    version: 'v2',
    path: external,
    label: 'demo · v2',
  });
  expect(JSON.stringify(catalog)).not.toContain('DO NOT EXPOSE');
});

test('job progress follows its own runner log and artifacts, and baseline failure is not success', async () => {
  let complete: (code: number) => void = () => {};
  let logPath = '';
  const { project, request } = fixture((_config, log) => {
    logPath = log;
    return new Promise<number>((resolve) => {
      complete = resolve;
    });
  });
  await request('/api/recipes', { name: 'base', config: { task: 'demo', repeats: 2 } });
  const job = await (await request('/api/jobs', { name: 'base', mode: 'run' })).json();
  const own = join(project, '.agent-evals/own');
  const other = join(project, '.agent-evals/newer-unrelated');
  for (const folder of [own, other]) {
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'manifest.json'), JSON.stringify({ status: 'preparing' }));
  }
  writeFileSync(logPath, `Baseline: abc\nArtifacts: ${own}\nChecking baseline\n`);
  expect(await (await request('/api/jobs')).json()).toMatchObject([
    {
      id: job.id,
      config: { repeats: 2 },
      campaignId: 'own',
      phase: 'baseline',
      totalRuns: 2,
      completedRuns: 0,
    },
  ]);
  const run = join(own, 'runs/001');
  mkdirSync(join(run, 'judge-session'), { recursive: true });
  writeFileSync(join(run, 'result.json'), JSON.stringify({ status: 'running' }));
  expect(await (await request(`/api/jobs/${job.id}`)).json()).toMatchObject({
    phase: 'judge',
    logTail: expect.stringContaining('Checking baseline'),
  });
  writeFileSync(join(own, 'manifest.json'), JSON.stringify({ status: 'baseline_failed' }));
  complete(0);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(await (await request('/api/jobs')).json()).toMatchObject([
    { status: 'failed', phase: 'failed', campaignId: 'own' },
  ]);
  const outside = join(project, 'outside.log');
  writeFileSync(outside, 'PRIVATE');
  rmSync(logPath);
  symlinkSync(outside, logPath);
  expect((await request(`/api/jobs/${job.id}`)).status).toBe(400);
});

test('restart preserves completed jobs and exposes unfinished jobs as interrupted without relaunching', async () => {
  const { project } = fixture();
  const jobsRoot = join(project, '.agent-evals/ui/jobs');
  for (const name of ['finished', 'unfinished']) {
    const folder = join(jobsRoot, name);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'config.json'), JSON.stringify({ task: 'demo', prepareOnly: true }));
    writeFileSync(join(folder, 'runner.log'), `Runner ${name}\n`);
  }
  writeFileSync(
    join(jobsRoot, 'finished/job.json'),
    JSON.stringify({
      id: 'finished',
      recipe: 'my-recipe',
      mode: 'prepare',
      status: 'completed',
      startedAt: '2026-09-15T12:00:00.000Z',
      finishedAt: '2026-09-15T12:01:00.000Z',
      exitCode: 0,
    }),
  );
  let launched = false;
  const api = createLabApi(project, 'test-token', async () => {
    launched = true;
    return 0;
  });
  const read = (path: string) => api(new Request(`http://127.0.0.1:3415${path}`));
  const jobs = await (await read('/api/jobs')).json();
  expect(jobs).toContainEqual(
    expect.objectContaining({
      id: 'finished',
      recipe: 'my-recipe',
      mode: 'prepare',
      status: 'completed',
      phase: 'prepared',
      config: expect.objectContaining({ task: 'demo' }),
    }),
  );
  expect(jobs).toContainEqual(
    expect.objectContaining({
      id: 'unfinished',
      status: 'interrupted',
      phase: 'interrupted',
      exitCode: null,
    }),
  );
  expect(await (await read('/api/jobs/finished')).json()).toMatchObject({
    logTail: 'Runner finished\n',
  });
  expect(launched).toBe(false);
});

test('source reader preserves exact content and rejects arbitrary files and escaped catalog symlinks', async () => {
  const { project, request } = fixture();
  const spec = '  Requirements\n\nKeep trailing spaces  \n';
  const source = 'evals/coding/tasks/demo/specification.md';
  writeFileSync(join(project, source), spec);
  const skill = '.agents/skills/implement/SKILL.md';
  mkdirSync(join(project, '.agents/skills/implement'), { recursive: true });
  writeFileSync(
    join(project, skill),
    '---\nname: Implement\ndescription: Delivery process\n---\nDo work\n',
  );
  expect(await (await request(`/api/sources?path=${source}`)).json()).toEqual({
    path: source,
    content: spec,
  });
  expect(await (await request(`/api/sources?path=${skill}`)).json()).toMatchObject({
    content: expect.stringContaining('Do work'),
  });
  writeFileSync(join(project, '.env.local'), 'PRIVATE_SECRET');
  // Even an old saved config must not promote arbitrary project files to readable sources.
  await request('/api/recipes', {
    name: 'unsafe-source',
    config: { task: 'demo', promptFile: '.env.local' },
  });
  for (const path of ['.env.local', '../outside', '/etc/passwd', 'evals/coding/prompts/judge.md'])
    expect((await request(`/api/sources?path=${encodeURIComponent(path)}`)).status).toBe(400);
  symlinkSync(join(project, '.env.local'), join(project, 'evals/coding/prompts/leak.md'));
  expect((await request('/api/sources?path=evals/coding/prompts/leak.md')).status).toBe(400);
  writeFileSync(join(project, 'evals/coding/prompts/judge.md'), 'Reserved evaluator prompt');
  symlinkSync(
    join(project, 'evals/coding/prompts/judge.md'),
    join(project, 'evals/coding/prompts/disguised.md'),
  );
  expect((await request('/api/sources?path=evals/coding/prompts/disguised.md')).status).toBe(400);
  const catalog = (await (await request('/api/bootstrap')).json()).catalog;
  expect(catalog.skills).toContainEqual({
    name: 'implement',
    label: 'Implement',
    description: 'Delivery process',
    path: skill,
  });
  expect(JSON.stringify(catalog.prompts)).not.toContain('.env.local');
  expect(JSON.stringify(catalog.prompts)).not.toContain('leak.md');
});

test('catalog exposes existing local and remote branches without fetching or inventing legacy variants', async () => {
  const { project, request } = fixture();
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();
  git('init', '-q');
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--allow-empty',
    '-qm',
    'Baseline',
  );
  git('branch', 'legacy/example');
  git('update-ref', 'refs/remotes/origin/clean', 'HEAD');
  const catalog = (await (await request('/api/bootstrap')).json()).catalog;
  expect(catalog.baselines).toContainEqual({
    value: 'refs/heads/legacy/example',
    label: 'legacy/example',
    kind: 'branch',
  });
  expect(catalog.baselines).toContainEqual({
    value: 'refs/remotes/origin/clean',
    label: 'origin/clean',
    kind: 'remote',
  });
});

test('recipe and job snapshots preserve edited specification and prompt after their sources disappear', async () => {
  let frozen = '';
  const { project, request } = fixture(async (configPath) => {
    frozen = readFileSync(configPath, 'utf8');
    return 0;
  });
  const config = {
    task: 'demo',
    taskFile: 'evals/coding/tasks/demo/deleted-specification.md',
    processSkill: '.agents/skills/deleted/SKILL.md',
    promptSource: 'evals/coding/prompts/deleted.md',
    promptFile: 'evals/coding/prompts/deleted-full.md',
    specificationText: '  Spec override\n\n',
    promptText: 'Edited process  \n',
    initialSkills: [],
    candidateChecks: ['typecheck', 'tests'],
  };
  expect((await request('/api/recipes', { name: 'edited', config })).status).toBe(200);
  expect(await (await request('/api/recipes')).json()).toMatchObject([{ name: 'edited', config }]);
  expect((await request('/api/jobs', { name: 'edited', mode: 'run' })).status).toBe(202);
  expect(JSON.parse(frozen)).toMatchObject(config);
  expect(
    JSON.parse(readFileSync(join(project, '.agent-evals/ui/recipes/edited.json'), 'utf8')),
  ).toMatchObject(config);
});

test('runs expose frozen input hashes and edited process artifacts without relying on current sources', async () => {
  const { project, request } = fixture();
  const campaign = join(project, '.agent-evals/frozen');
  const run = join(campaign, 'runs/001');
  mkdirSync(run, { recursive: true });
  mkdirSync(join(campaign, 'initial-skills/write-code'), { recursive: true });
  writeFileSync(join(campaign, 'manifest.json'), JSON.stringify({ status: 'evaluated' }));
  writeFileSync(
    join(campaign, 'inputs.json'),
    JSON.stringify({ taskSha256: 'spec-hash', candidatePromptSha256: 'prompt-hash' }),
  );
  writeFileSync(
    join(run, 'result.json'),
    JSON.stringify({
      id: '001',
      candidatePrompt: {
        sha256: 'prompt-hash',
        initialSkills: [{ name: 'write-code', sha256: 'skill-hash' }],
      },
      candidateChecks: { enabled: ['tests'] },
    }),
  );
  writeFileSync(join(run, 'process-prompt.md'), 'Edited process  \n');
  writeFileSync(join(run, 'task-prompt.md'), 'Frozen specification\n');
  writeFileSync(join(campaign, 'initial-skills/write-code/SKILL.md'), 'Frozen initial skill');
  expect(await (await request('/api/campaigns')).json()).toMatchObject([
    {
      inputProvenance: { specificationSha256: 'spec-hash', promptSha256: 'prompt-hash' },
      runs: [
        { candidatePrompt: { sha256: 'prompt-hash' }, candidateChecks: { enabled: ['tests'] } },
      ],
    },
  ]);
  const detail = await (await request('/api/campaigns/frozen/runs/001')).json();
  expect(detail.artifacts).toContain('process');
  expect(detail.artifacts).toContain('initialSkills');
  expect(await (await request('/api/campaigns/frozen/runs/001/artifacts/process')).text()).toBe(
    'Edited process  \n',
  );
  expect(
    await (await request('/api/campaigns/frozen/runs/001/artifacts/specification')).text(),
  ).toBe('Frozen specification\n');
  expect(
    await (await request('/api/campaigns/frozen/runs/001/artifacts/initialSkills')).json(),
  ).toEqual([{ name: 'write-code', content: 'Frozen initial skill' }]);
});

test('tasks without a specification file expose their existing prompt as the editable specification', async () => {
  const { project, request } = fixture();
  const content = 'Existing requirements\n  preserved exactly\n';
  writeFileSync(join(project, 'evals/coding/tasks/demo/prompt.md'), content);
  const catalog = (await (await request('/api/bootstrap')).json()).catalog;
  expect(catalog.taskFiles).toContainEqual({
    taskId: 'demo',
    label: 'Demo',
    path: 'evals/coding/tasks/demo/prompt.md',
  });
  expect(
    await (await request('/api/sources?path=evals/coding/tasks/demo/prompt.md')).json(),
  ).toMatchObject({ content });
  expect(
    (
      await request('/api/recipes', {
        name: 'legacy-task',
        config: { task: 'demo', taskFile: 'evals/coding/tasks/demo/prompt.md', promptText: '' },
      })
    ).status,
  ).toBe(200);
});

test('recipe inputs cannot bypass the source catalog or redirect overridden skill resources', async () => {
  const { project, request } = fixture();
  writeFileSync(join(project, '.env.local'), 'PRIVATE');
  const configs = [
    { promptSource: '.env.local', specificationText: 'Requirements' },
    { candidatePrompt: '.env.local' },
    { instructions: '.env.local' },
    { promptFile: '.env.local' },
    {
      processSkill: '/tmp/external/SKILL.md',
      promptText: 'Override',
      specificationText: 'Requirements',
    },
  ];
  for (const config of configs) {
    expect(
      (await request('/api/recipes', { name: 'blocked', config: { task: 'demo', ...config } }))
        .status,
    ).toBe(400);
  }
  const external = mkdtempSync(join(tmpdir(), 'eval-ui-external-skill-'));
  folders.push(external);
  writeFileSync(join(external, 'SKILL.md'), 'Secret resource directory');
  mkdirSync(join(project, '.agents/skills'), { recursive: true });
  symlinkSync(external, join(project, '.agents/skills/linked'));
  expect(
    (
      await request('/api/recipes', {
        name: 'linked',
        config: {
          task: 'demo',
          processSkill: '.agents/skills/linked/SKILL.md',
          promptText: 'Override',
          specificationText: 'Requirements',
        },
      })
    ).status,
  ).toBe(400);
  // Revalidation at launch protects recipes saved by an earlier API version.
  writeFileSync(
    join(project, '.agent-evals/ui/recipes/old.json'),
    JSON.stringify({ task: 'demo', promptSource: '.env.local', specificationText: 'Requirements' }),
  );
  expect((await request('/api/jobs', { name: 'old', mode: 'run' })).status).toBe(400);
});

test('a verified correction updates table and detail while retaining the original result; stale corrections are ignored', async () => {
  const { hashFile } = await import('../coding-eval/workspace');
  const { project, request } = fixture();
  const campaign = join(project, '.agent-evals/corrected');
  const run = join(campaign, 'runs/001');
  const revision = join(run, 'reverifications/2026-09-16');
  mkdirSync(revision, { recursive: true });
  writeFileSync(
    join(campaign, 'manifest.json'),
    JSON.stringify({ status: 'completed', config: { task: 'demo' } }),
  );
  const original = JSON.stringify({
    id: '001',
    status: 'evaluated',
    deliveredCommit: 'frozen-delivery',
    passed: false,
    repositoryChecksPassed: true,
    candidateTestsPassed: false,
    privateAcceptancePassed: true,
    judgeTaskVerdict: 'pass',
  });
  writeFileSync(join(run, 'result.json'), original);
  const correction = {
    kind: 'candidate-tests-runner-v2',
    originalResultSha256: hashFile(join(run, 'result.json')),
    deliveredCommit: 'frozen-delivery',
    createdAt: '2026-09-16T01:00:00Z',
    candidateTestVerification: {
      passed: true,
      checks: [{ id: 'candidate-product-browser-tests', status: 'passed' }],
    },
  };
  writeFileSync(join(revision, 'result.json'), JSON.stringify(correction));
  expect(await (await request('/api/campaigns/corrected/runs/001')).json()).toMatchObject({
    outcome: 'pass',
    passed: true,
    candidateTestsPassed: true,
    verificationRevision: { originalPassed: false },
  });
  expect(await (await request('/api/campaigns')).json()).toMatchObject([
    { runs: [{ id: '001', outcome: 'pass', passed: true }] },
  ]);
  expect(readFileSync(join(run, 'result.json'), 'utf8')).toBe(original);
  writeFileSync(
    join(revision, 'result.json'),
    JSON.stringify({ ...correction, originalResultSha256: 'wrong-hash' }),
  );
  expect(await (await request('/api/campaigns/corrected/runs/001')).json()).toMatchObject({
    passed: false,
    outcome: 'fail',
  });
  const judgment = Object.fromEntries(
    [
      'functionality',
      'codeQuality',
      'testQuality',
      'projectGuidelines',
      'verificationProcess',
      'reportAccuracy',
    ].map((key) => [key, { score: 8 }]),
  );
  writeFileSync(
    join(revision, 'result.json'),
    JSON.stringify({
      ...correction,
      kind: 'delivery-verification-v3',
      replacement: {
        status: 'evaluated',
        scoreScale: 10,
        judgment,
        judgmentError: null,
        verification: { passed: true, checks: [{ id: 'typecheck', status: 'passed' }] },
        candidateTestVerification: correction.candidateTestVerification,
        repositoryChecksPassed: true,
        candidateTestsPassed: true,
        judgeTaskVerdict: 'pass',
      },
    }),
  );
  expect(await (await request('/api/campaigns/corrected/runs/001')).json()).toMatchObject({
    outcome: 'pass',
    score: 8,
    scoreScale: 10,
    verificationRevision: { kind: 'delivery-verification-v3', originalPassed: false },
  });
  expect(await (await request('/api/campaigns')).json()).toMatchObject([
    { runs: [{ id: '001', outcome: 'pass', score: 8 }] },
  ]);
  const later = join(run, 'reverifications/2026-09-17');
  mkdirSync(later, { recursive: true });
  writeFileSync(
    join(later, 'result.json'),
    JSON.stringify({ ...correction, createdAt: '2026-09-17T01:00:00Z' }),
  );
  expect(await (await request('/api/campaigns/corrected/runs/001')).json()).toMatchObject({
    outcome: 'pass',
    score: 8,
    scoreScale: 10,
    verification: { passed: true },
    verificationRevision: { kind: 'candidate-tests-runner-v2' },
  });
  expect(readFileSync(join(run, 'result.json'), 'utf8')).toBe(original);
});
