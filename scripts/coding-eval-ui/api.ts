import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { candidateScriptGroup } from '../coding-eval/candidate-checks';
import { candidateCheckIds, configSchema, type EvalConfig, listTasks } from '../coding-eval/config';
import { effectiveRun } from '../coding-eval/reverify';
import { skillSource } from '../coding-eval/skill-language';
import { specSchema } from '../local-workflow/contracts';

const object = z.record(z.string(), z.unknown());
const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,160}$/);
const recipeSchema = z
  .object({ name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/), config: configSchema })
  .strict();
const launchSchema = z
  .object({ name: recipeSchema.shape.name, mode: z.enum(['prepare', 'run']) })
  .strict();
function record(value: unknown) {
  return object.safeParse(value).data ?? {};
}
function json(file: string): Record<string, unknown> {
  return record(JSON.parse(readFileSync(file, 'utf8')));
}
function directories(folder: string) {
  return existsSync(folder)
    ? readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
}
function confined(root: string, ...parts: string[]) {
  const base = realpathSync(root);
  const target = realpathSync(resolve(root, ...parts));
  const path = relative(base, target);
  if (path.startsWith(`..${sep}`) || path === '..' || isAbsolute(path))
    throw new Error('Ruta fuera del directorio permitido.');
  return target;
}
function pick(source: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, source[key] ?? null]));
}
function runSummary(run: Record<string, unknown>) {
  const process = record(run.process);
  return {
    ...pick(run, [
      'id',
      'status',
      'startedAt',
      'finishedAt',
      'passed',
      'score',
      'scoreScale',
      'outcome',
      'evaluationIssues',
      'verificationRevision',
      'repositoryChecksPassed',
      'candidateTestsPassed',
      'candidateKind',
      'workflowCompleted',
      'judgeTaskVerdict',
      'taskAcceptancePassed',
      'privateAcceptancePassed',
      'estimatedApiCostUsd',
      'candidatePrompt',
      'candidateChecks',
      'initialSkills',
    ]),
    compactions: process.compactions ?? null,
  };
}
const artifactFiles = {
  prompt: 'candidate-prompt.md',
  specification: 'task-prompt.md',
  process: 'process-prompt.md',
  processSkill: 'process-skill.md',
  diff: 'candidate.patch',
  final: 'candidate-session/final.txt',
} as const;
export type Job = {
  id: string;
  recipe: string;
  mode: 'prepare' | 'run';
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  logPath: string;
  config: EvalConfig;
  campaignId: string | null;
  phase:
    | 'starting'
    | 'interrupted'
    | 'baseline'
    | 'candidate'
    | 'verification'
    | 'judge'
    | 'prepared'
    | 'completed'
    | 'failed';
  completedRuns: number;
  totalRuns: number;
};
export type Launch = (configPath: string, logPath: string) => Promise<number>;

/** Only reads bounded runner output, never candidate traces or bundle documents. */
function logSegment(file: string, tail: boolean) {
  const size = statSync(file).size;
  const length = Math.min(size, 64 * 1024);
  const buffer = Buffer.alloc(length);
  const descriptor = openSync(file, 'r');
  try {
    const bytes = readSync(descriptor, buffer, 0, length, tail ? size - length : 0);
    return buffer.subarray(0, bytes).toString('utf8');
  } finally {
    closeSync(descriptor);
  }
}
const bundleMetadata = z.object({ taskId: z.string(), version: z.string() });
const sourceLimitBytes = 512 * 1024;

/** Only catalog-owned source folders can feed the editor; saved paths never expand this boundary. */
function sourceFile(project: string, path: string) {
  const root = path.startsWith('.agents/skills/')
    ? '.agents/skills'
    : path.startsWith('evals/coding/tasks/')
      ? 'evals/coding/tasks'
      : path.startsWith('evals/coding/prompts/')
        ? 'evals/coding/prompts'
        : null;
  if (!root) throw new Error('Fuente fuera del catálogo.');
  const file = confined(
    resolve(project, root),
    relative(resolve(project, root), resolve(project, path)),
  );
  if (file !== resolve(realpathSync(project), path))
    throw new Error('Las fuentes del catálogo no pueden ser enlaces simbólicos.');
  if (!statSync(file).isFile() || statSync(file).size > sourceLimitBytes)
    throw new Error('Fuente inválida o demasiado grande.');
  return file;
}
function skillMetadata(project: string, name: string, path: string) {
  const content = readFileSync(sourceFile(project, path), 'utf8');
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  let metadata: Record<string, unknown> = {};
  if (frontmatter) {
    try {
      metadata = record(Bun.YAML.parse(frontmatter));
    } catch {
      // A malformed description must not hide an otherwise usable skill.
    }
  }
  return {
    name,
    path,
    label: typeof metadata.name === 'string' ? metadata.name : name,
    description: typeof metadata.description === 'string' ? metadata.description : null,
  };
}
function gitBranches(project: string) {
  try {
    return execFileSync(
      'git',
      ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'],
      {
        cwd: project,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
        maxBuffer: 512 * 1024,
      },
    )
      .trim()
      .split('\n')
      .filter((ref) => ref && !ref.endsWith('/HEAD'))
      .map((value) => ({
        value,
        label: value.replace(/^refs\/(heads|remotes)\//, ''),
        kind: value.startsWith('refs/heads/') ? ('branch' as const) : ('remote' as const),
      }));
  } catch {
    return [];
  }
}

function buildCatalog(project: string, saved: { config: EvalConfig }[]) {
  const tasks = listTasks(project);
  const output = resolve(project, '.agent-evals');
  const observed = directories(output).flatMap((name) => {
    try {
      return [json(confined(output, name, 'manifest.json'))];
    } catch {
      return [];
    }
  });
  const configs = [
    ...saved.map((recipe) => recipe.config),
    ...observed.map((entry) => record(entry.config)),
  ];
  const defaults = configSchema.parse({ task: tasks[0]?.id ?? 'default' });
  const models = { codex: new Set([defaults.model]), opencode: new Set<string>() };
  for (const config of configs) {
    if (
      (config.harness === 'codex' || config.harness === 'opencode') &&
      typeof config.model === 'string'
    )
      models[config.harness].add(config.model);
  }
  const skills = directories(resolve(project, '.agents/skills'))
    .flatMap((name) => {
      const path = `.agents/skills/${name}/SKILL.md`;
      try {
        return [skillMetadata(project, name, path)];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const taskFiles = tasks.flatMap((task) => {
    for (const filename of ['specification.md', 'prompt.md']) {
      const path = `evals/coding/tasks/${task.id}/${filename}`;
      try {
        sourceFile(project, path);
        return [{ taskId: task.id, label: task.title, path }];
      } catch {
        // Tasks predating the specification editor keep their requirements in prompt.md.
      }
    }
    return [];
  });
  const promptPaths = new Set([
    ...readdirSync(resolve(project, 'evals/coding/prompts'), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'judge.md')
      .map((entry) => `evals/coding/prompts/${entry.name}`),
    ...configs.flatMap((config) =>
      typeof config.promptFile === 'string' &&
      /^evals\/coding\/prompts\/[^/]+\.md$/.test(config.promptFile) &&
      !config.promptFile.endsWith('/judge.md')
        ? [config.promptFile]
        : [],
    ),
  ]);
  const prompts = [...promptPaths].flatMap((path) => {
    try {
      const file = sourceFile(project, path);
      return statSync(file).isFile()
        ? [{ label: basename(path, '.md'), path: relative(realpathSync(project), file) }]
        : [];
    } catch {
      return [];
    }
  });
  const baselines = [
    { value: 'working-tree', label: 'Cambios actuales' },
    { value: 'HEAD', label: 'Último commit' },
    ...gitBranches(project),
    ...[
      ...new Set(
        observed.flatMap((entry) =>
          typeof entry.baselineCommit === 'string' ? [entry.baselineCommit] : [],
        ),
      ),
    ].map((value) => ({ value, label: value.slice(0, 12) })),
  ];
  function bundles(field: 'judgeDossier' | 'privateAcceptance', filename: string, folder: string) {
    const paths = new Set(
      configs.flatMap((config) => (typeof config[field] === 'string' ? [config[field]] : [])),
    );
    for (const task of tasks)
      paths.add(resolve(homedir(), '.local/share/hoteles-harness-evals/private', task.id, folder));
    return [...paths].flatMap((path) => {
      try {
        const root = resolve(project, path);
        const metadata = bundleMetadata.parse(json(confined(root, filename)));
        return [{ ...metadata, path: root, label: `${metadata.taskId} · ${metadata.version}` }];
      } catch {
        return [];
      }
    });
  }
  const checkLabels = {
    lint: 'Lint',
    typecheck: 'Tipos',
    tests: 'Tests',
    architecture: 'Arquitectura',
    browser: 'Navegador',
    acceptance: 'Aceptación de la tarea',
  };
  const scripts = existsSync(resolve(project, 'package.json'))
    ? record(json(confined(project, 'package.json')).scripts)
    : {};
  const candidateChecks = candidateCheckIds
    .filter((id) => id !== 'acceptance')
    .map((id) => ({
      id,
      label: checkLabels[id],
      scripts: [
        ...Object.entries(scripts).flatMap(([name, command]) =>
          name !== 'test:e2e' &&
          typeof command === 'string' &&
          candidateScriptGroup(name, command) === id
            ? [name]
            : [],
        ),
      ],
    }));
  return {
    skills,
    candidateChecks,
    taskFiles,
    prompts,
    baselines,
    models: { codex: [...models.codex], opencode: [...models.opencode] },
    judgeDossiers: bundles('judgeDossier', 'dossier.json', 'dossier'),
    privateAcceptance: bundles('privateAcceptance', 'acceptance.json', 'acceptance'),
  };
}
export type LabCatalog = ReturnType<typeof buildCatalog>;

/** Local project UI. API reads summaries; original prompts/diffs require an explicit artifact request. */
export function createLabApi(project: string, token: string, launch: Launch) {
  const output = resolve(project, '.agent-evals');
  const state = resolve(output, 'ui');
  const recipes = resolve(state, 'recipes');
  mkdirSync(recipes, { recursive: true });
  const jobs: Job[] = directories(resolve(state, 'jobs'))
    .flatMap((name) => {
      try {
        return [restoreJob(name)];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  function restoreJob(name: string): Job {
    const folder = confined(state, 'jobs', id.parse(name));
    const config = configSchema.parse(json(confined(folder, 'config.json')));
    const stored = existsSync(resolve(folder, 'job.json'))
      ? json(confined(folder, 'job.json'))
      : {};
    const status =
      stored.status === 'completed' || stored.status === 'failed' ? stored.status : 'interrupted';
    return {
      id: name,
      recipe: typeof stored.recipe === 'string' ? stored.recipe : config.task,
      mode: stored.mode === 'prepare' || config.prepareOnly ? 'prepare' : 'run',
      status,
      startedAt:
        typeof stored.startedAt === 'string'
          ? stored.startedAt
          : statSync(folder).birthtime.toISOString(),
      finishedAt: typeof stored.finishedAt === 'string' ? stored.finishedAt : null,
      exitCode: typeof stored.exitCode === 'number' ? stored.exitCode : null,
      logPath: relative(project, resolve(folder, 'runner.log')),
      config,
      campaignId: null,
      phase: status === 'interrupted' ? 'interrupted' : 'starting',
      completedRuns: 0,
      totalRuns: config.prepareOnly ? 0 : config.repeats,
    };
  }
  function campaignFolder(value: string) {
    return confined(output, id.parse(value));
  }
  function inputProvenance(folder: string) {
    try {
      const inputs = json(confined(folder, 'inputs.json'));
      return {
        specificationSha256: inputs.taskSha256 ?? null,
        promptSha256: inputs.candidatePromptSha256 ?? null,
      };
    } catch {
      return null;
    }
  }
  function runFolder(campaign: string, run: string) {
    return confined(campaignFolder(campaign), 'runs', id.parse(run));
  }
  function loadRecipe(name: string) {
    return recipeSchema.parse({
      name,
      config: json(confined(recipes, `${recipeSchema.shape.name.parse(name)}.json`)),
    });
  }
  function savedRecipes() {
    return readdirSync(recipes)
      .filter((name) => /^[a-z0-9][a-z0-9-]{0,63}\.json$/.test(name))
      .flatMap((file) => {
        try {
          return [loadRecipe(file.slice(0, -5))];
        } catch {
          return [];
        }
      });
  }
  function jobLog(job: Job, tail: boolean) {
    const folder = confined(state, 'jobs', job.id);
    if (!existsSync(resolve(folder, 'runner.log'))) return '';
    return logSegment(confined(folder, 'runner.log'), tail);
  }
  function jobCampaign(job: Job) {
    if (job.campaignId) return job.campaignId;
    const artifactPath = jobLog(job, false)
      .match(/^Artifacts: (.+)$/m)?.[1]
      ?.trim();
    if (!artifactPath) return null;
    const name = basename(artifactPath);
    if (resolve(artifactPath) !== resolve(output, name)) return null;
    campaignFolder(name);
    return name;
  }
  function campaignProgress(campaignId: string) {
    const folder = campaignFolder(campaignId);
    const manifest = json(confined(folder, 'manifest.json'));
    const runs = directories(resolve(folder, 'runs')).flatMap((name) => {
      try {
        const root = confined(folder, 'runs', name);
        return [{ root, result: json(confined(root, 'result.json')) }];
      } catch {
        return [];
      }
    });
    const active = runs.filter(({ result }) => result.status === 'running');
    let phase: Job['phase'] = active.length ? 'candidate' : 'baseline';
    if (active.some(({ root }) => existsSync(resolve(root, 'delivery.json'))))
      phase = 'verification';
    if (active.some(({ root }) => existsSync(resolve(root, 'judge-session')))) phase = 'judge';
    return {
      phase,
      completedRuns: runs.filter(({ result }) => result.status !== 'running').length,
      failed: ['baseline_failed', 'incomplete'].includes(String(manifest.status)),
    };
  }
  function refreshJob(job: Job) {
    job.campaignId = jobCampaign(job);
    if (job.campaignId) {
      try {
        const progress = campaignProgress(job.campaignId);
        job.completedRuns = progress.completedRuns;
        job.phase = progress.phase;
        // CLI exit 0 also covers a failed baseline; the manifest owns this outcome.
        if (progress.failed && job.status === 'completed') job.status = 'failed';
      } catch {
        // A runner can be replacing a JSON file while the UI polls it.
      }
    }
    if (job.status === 'completed') job.phase = job.mode === 'prepare' ? 'prepared' : 'completed';
    else if (job.status !== 'running') job.phase = job.status;
    return job;
  }
  function validateInputs(config: z.infer<typeof configSchema>) {
    if (!listTasks(project).some((task) => task.id === config.task))
      throw new Error('Tarea desconocida.');
    if (config.candidateKind === 'workflow') {
      const expected = `evals/coding/tasks/${config.task}/workflow-spec.json`;
      if (config.workflowSpec !== expected)
        throw new Error('Selecciona la spec pública del workflow de esta tarea.');
      const spec = specSchema.parse(
        JSON.parse(readFileSync(sourceFile(project, expected), 'utf8')),
      );
      if (spec.id !== config.task) throw new Error('La spec del workflow pertenece a otra tarea.');
      return;
    }
    // A skill path can cause resource copying even with an inline override.
    if (config.processSkill) {
      const path = relative(
        realpathSync(project),
        resolve(realpathSync(project), config.processSkill),
      );
      if (!/^\.agents\/skills\/[a-z0-9-]+\/SKILL\.md$/.test(path))
        throw new Error('La skill de proceso debe pertenecer al catálogo del proyecto.');
      let ancestor = resolve(realpathSync(project), path);
      while (!existsSync(ancestor)) ancestor = dirname(ancestor);
      if (realpathSync(ancestor) !== ancestor)
        throw new Error('La skill de proceso no puede usar enlaces simbólicos.');
    }
    // Inline content is authoritative: its original text source may have disappeared.
    const hasPromptOverride = config.promptText !== null;
    const editable =
      config.specificationText !== null || hasPromptOverride || config.promptSource !== null;
    const composed = !editable && !config.processSkill && !config.promptFile;
    const paths = [
      config.specificationText === null ? config.taskFile : null,
      !hasPromptOverride && !config.promptSource ? config.processSkill : null,
      !hasPromptOverride ? config.promptSource : null,
      !editable ? config.promptFile : null,
      composed ? config.instructions : null,
      editable || !config.promptFile ? config.candidatePrompt : null,
    ];
    const catalog = buildCatalog(project, []);
    const allowed = new Set(
      [...catalog.skills, ...catalog.taskFiles, ...catalog.prompts].map((source) => source.path),
    );
    for (const input of paths) {
      if (!input) continue;
      const path = relative(realpathSync(project), resolve(realpathSync(project), input));
      if (!allowed.has(path)) throw new Error('La entrada debe ser una fuente del catálogo.');
      sourceFile(project, path);
    }
  }
  return async function api(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const host = request.headers.get('host') ?? url.host;
    if (url.hostname !== '127.0.0.1' || host !== url.host)
      return Response.json({ error: 'Solo loopback.' }, { status: 403 });
    if (
      request.method !== 'GET' &&
      (request.method !== 'POST' ||
        request.headers.get('origin') !== url.origin ||
        request.headers.get('x-lab-token') !== token)
    )
      return Response.json({ error: 'Origen o sesión no permitidos.' }, { status: 403 });
    try {
      if (request.method === 'GET' && url.pathname === '/api/bootstrap')
        return Response.json({
          token,
          tasks: listTasks(project),
          jobs: jobs.map(refreshJob),
          catalog: buildCatalog(project, savedRecipes()),
          example: existsSync(resolve(project, 'evals/coding/example.json'))
            ? json(resolve(project, 'evals/coding/example.json'))
            : { task: listTasks(project)[0]?.id },
        });
      if (request.method === 'GET' && url.pathname === '/api/sources') {
        const path = z.string().min(1).parse(url.searchParams.get('path'));
        const catalog = buildCatalog(project, savedRecipes());
        const selectable = [...catalog.skills, ...catalog.taskFiles, ...catalog.prompts];
        if (!selectable.some((source) => source.path === path))
          throw new Error('Fuente fuera del catálogo.');
        const language = z.enum(['en', 'es']).parse(url.searchParams.get('language') ?? 'en');
        const skill = catalog.skills.find((skill) => skill.path === path);
        const file = skill ? skillSource(project, skill.name, language) : sourceFile(project, path);
        return Response.json({ path, content: readFileSync(file, 'utf8') });
      }
      if (url.pathname === '/api/recipes') {
        if (request.method === 'GET') return Response.json(savedRecipes());
        const input = recipeSchema.parse(await request.json());
        validateInputs(input.config);
        const path = resolve(recipes, `${input.name}.json`);
        // Existing symlinks must never redirect recipe writes.
        if (existsSync(path)) confined(recipes, `${input.name}.json`);
        writeFileSync(path, `${JSON.stringify(input.config, null, 2)}\n`);
        return Response.json(input);
      }
      if (request.method === 'GET' && url.pathname === '/api/jobs')
        return Response.json(jobs.map(refreshJob));
      const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
      if (request.method === 'GET' && jobMatch?.[1]) {
        const job = jobs.find((entry) => entry.id === id.parse(jobMatch[1]));
        if (!job) return Response.json({ error: 'Ejecución no encontrada.' }, { status: 404 });
        return Response.json({ ...refreshJob(job), logTail: jobLog(job, true) });
      }
      if (request.method === 'POST' && url.pathname === '/api/jobs') {
        if (jobs.some((job) => job.status === 'running'))
          return Response.json(
            { error: 'Ya hay una campaña activa desde esta UI.' },
            { status: 409 },
          );
        const input = launchSchema.parse(await request.json());
        const recipe = loadRecipe(input.name);
        validateInputs(recipe.config);
        const jobId = randomUUID();
        const folder = resolve(state, 'jobs', jobId);
        mkdirSync(folder, { recursive: true });
        const configPath = resolve(folder, 'config.json');
        const logPath = resolve(folder, 'runner.log');
        writeFileSync(
          configPath,
          JSON.stringify({ ...recipe.config, prepareOnly: input.mode === 'prepare' }, null, 2),
        );
        const job: Job = {
          id: jobId,
          recipe: input.name,
          mode: input.mode,
          status: 'running',
          startedAt: new Date().toISOString(),
          finishedAt: null,
          exitCode: null,
          logPath: relative(project, logPath),
          config: { ...recipe.config, prepareOnly: input.mode === 'prepare' },
          campaignId: null,
          phase: 'starting',
          completedRuns: 0,
          totalRuns: input.mode === 'prepare' ? 0 : recipe.config.repeats,
        };
        writeFileSync(resolve(folder, 'job.json'), JSON.stringify(job, null, 2));
        jobs.unshift(job);
        void Promise.resolve()
          .then(() => launch(configPath, logPath))
          .then((code) => {
            job.exitCode = code;
            job.status = code === 0 ? 'completed' : 'failed';
          })
          .catch(() => {
            job.status = 'failed';
          })
          .finally(() => {
            job.finishedAt = new Date().toISOString();
            refreshJob(job);
            writeFileSync(resolve(folder, 'job.json'), JSON.stringify(job, null, 2));
          });
        return Response.json(job, { status: 202 });
      }
      if (request.method === 'GET' && url.pathname === '/api/campaigns') {
        return Response.json(
          directories(output)
            .sort()
            .reverse()
            .flatMap((name) => {
              try {
                const folder = campaignFolder(name);
                const manifest = json(confined(folder, 'manifest.json'));
                return [
                  {
                    id: name,
                    inputProvenance: inputProvenance(folder),
                    ...pick(manifest, [
                      'status',
                      'startedAt',
                      'finishedAt',
                      'config',
                      'baselineCommit',
                    ]),
                    runs: directories(resolve(folder, 'runs')).flatMap((run) => {
                      try {
                        const runRoot = confined(folder, 'runs', run);
                        return [
                          runSummary(effectiveRun(runRoot, json(confined(runRoot, 'result.json')))),
                        ];
                      } catch {
                        return [];
                      }
                    }),
                  },
                ];
              } catch {
                return [];
              }
            }),
        );
      }
      const match = url.pathname.match(
        /^\/api\/campaigns\/([^/]+)\/runs\/([^/]+)(?:\/artifacts\/([^/]+))?$/,
      );
      if (request.method === 'GET' && match?.[1] && match[2]) {
        const campaignId = match[1];
        const folder = runFolder(campaignId, match[2]);
        const result = effectiveRun(folder, json(confined(folder, 'result.json')));
        if (match[3]) {
          const key = z
            .enum([
              'prompt',
              'specification',
              'process',
              'processSkill',
              'diff',
              'final',
              'trace',
              'initialSkills',
            ])
            .parse(match[3]);
          if (key === 'trace')
            return Response.json({
              process: result.process ?? null,
              judgeProcess: result.judgeProcess ?? null,
            });
          if (key === 'initialSkills') {
            const skills = z
              .array(z.object({ name: id }))
              .parse(record(result.candidatePrompt).initialSkills ?? []);
            const entries = skills.map(({ name }) => {
              const file = confined(campaignFolder(campaignId), 'initial-skills', name, 'SKILL.md');
              if (statSync(file).size > sourceLimitBytes)
                throw new Error('Skill demasiado grande.');
              return { name, content: readFileSync(file, 'utf8') };
            });
            if (JSON.stringify(entries).length > 2_000_000)
              throw new Error('Artefacto demasiado grande.');
            return Response.json(entries);
          }
          const file = confined(folder, artifactFiles[key]);
          if (statSync(file).size > 2_000_000)
            throw new Error('Artefacto demasiado grande; ábrelo localmente.');
          return new Response(readFileSync(file, 'utf8'), {
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          });
        }
        const process = record(result.process);
        return Response.json({
          ...runSummary(result),
          ...pick(result, [
            'config',
            'baselineCommit',
            'candidatePrompt',
            'availableSkills',
            'candidateChecks',
            'initialSkills',
            'verification',
            'candidateTestVerification',
            'judgment',
            'judgmentError',
            'cost',
            'judgeDossier',
            'privateAcceptance',
            'privateAcceptanceVerification',
          ]),
          process: pick(process, [
            'skillLoads',
            'compactions',
            'usage',
            'reportedCostUsd',
            'observedEditEvents',
            'limitations',
          ]),
          artifacts: Object.entries(artifactFiles)
            .filter(([, file]) => existsSync(resolve(folder, file)))
            .map(([name]) => name)
            .concat('trace')
            .concat(
              existsSync(resolve(campaignFolder(match[1]), 'initial-skills'))
                ? ['initialSkills']
                : [],
            ),
        });
      }
      return Response.json({ error: 'No encontrado.' }, { status: 404 });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof z.ZodError
              ? z.prettifyError(error)
              : error instanceof Error
                ? error.message
                : 'No se pudo completar la operación.',
        },
        { status: 400 },
      );
    }
  };
}
