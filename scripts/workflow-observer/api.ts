import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import {
  agentConfigSchema,
  installedHarnesses,
  resolveAgents,
  validateAgents,
} from '../local-workflow/agents';
import { specSchema } from '../local-workflow/contracts';
import { createRun, load } from '../local-workflow/run-state';
import { type WorkflowRun, type WorkflowSource, workflowDefinitionSchema } from './contracts';
import { evaluationRun } from './evaluation';
import { localAgentLog, localWorkflowRun, localWorkflowSummary } from './local';
import { qaDirectoryForAgent, qaTracePage } from './qa-trace';
import { tracePage } from './trace';

const refSchema = z
  .string()
  .regex(/^(?:local:[a-zA-Z0-9.-]+|evaluation:[a-zA-Z0-9.-]+:[a-zA-Z0-9.-]+)$/);
const launchSchema = z
  .object({
    definitionId: z.literal('delivery'),
    specPath: z.string(),
    agentConfig: agentConfigSchema,
    mode: z.enum(['normal', 'ralph']).default('normal'),
    planReview: z.boolean().default(false),
  })
  .strict();
function folders(path: string) {
  return existsSync(path)
    ? readdirSync(path, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
}
function confined(root: string, ...parts: string[]) {
  const base = realpathSync(root);
  const path = realpathSync(resolve(root, ...parts));
  const delta = relative(base, path);
  if (delta === '..' || delta.startsWith(`..${sep}`) || isAbsolute(delta))
    throw new Error('Ruta fuera del almacén de workflows.');
  return path;
}
function knownSpecs(project: string) {
  const tasks = resolve(project, 'docs/workflows/tasks');
  const examples = resolve(project, 'docs/workflows/examples');
  return [
    ...folders(tasks).map((id) => `docs/workflows/tasks/${id}/spec.json`),
    ...(existsSync(examples)
      ? readdirSync(examples)
          .filter((file) => file.endsWith('.json'))
          .map((file) => `docs/workflows/examples/${file}`)
      : []),
  ].flatMap((path) => {
    try {
      const file = confined(project, path);
      const spec = specSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
      return [{ path, id: spec.id, title: spec.title, objective: spec.objective }];
    } catch {
      return [];
    }
  });
}
function definitions(project: string) {
  const root = resolve(project, 'workflows/definitions');
  return readdirSync(root)
    .filter((file) => file.endsWith('.json'))
    .map((file) =>
      workflowDefinitionSchema.parse(JSON.parse(readFileSync(confined(root, file), 'utf8'))),
    );
}
function runRoot(project: string, ref: string) {
  const [source, id, run] = refSchema.parse(ref).split(':');
  if (!id) throw new Error('Referencia de workflow inválida.');
  if (source === 'local') {
    const root = resolve(project, '.tmp/local-workflows');
    return { source: 'local' as const, path: confined(root, id) };
  }
  if (!run) throw new Error('Referencia de evaluación inválida.');
  const root = resolve(project, '.agent-evals');
  return {
    source: 'evaluation' as const,
    path: confined(root, id, 'runs', run),
    campaign: id,
    run,
  };
}
function snapshot(project: string, ref: string): WorkflowRun {
  const root = runRoot(project, ref);
  return root.source === 'local'
    ? localWorkflowRun(root.path)
    : evaluationRun(root.campaign, root.run, root.path);
}
function summaries(project: string, source?: WorkflowSource): WorkflowRun[] {
  const localRoot = resolve(project, '.tmp/local-workflows');
  const evalRoot = resolve(project, '.agent-evals');
  const local = (source === 'evaluation' ? [] : folders(localRoot)).flatMap((name) => {
    try {
      return [localWorkflowSummary(confined(localRoot, name))];
    } catch {
      return [];
    }
  });
  const evaluated = (source === 'local' ? [] : folders(evalRoot)).flatMap((campaign) => {
    try {
      const root = confined(evalRoot, campaign);
      if (!existsSync(join(root, 'manifest.json'))) return [];
      return folders(join(root, 'runs')).flatMap((run) => {
        try {
          return [evaluationRun(campaign, run, confined(root, 'runs', run), true)];
        } catch {
          return [];
        }
      });
    } catch {
      return [];
    }
  });
  return [...local, ...evaluated].sort((a, b) =>
    (b.startedAt ?? '').localeCompare(a.startedAt ?? ''),
  );
}
function traceFile(project: string, ref: string, agent: string) {
  const root = runRoot(project, ref);
  if (root.source === 'local') return localAgentLog(root.path, agent);
  const archived = join(root.path, 'trace-archive', `${agent}.projected.jsonl`);
  if (existsSync(archived)) return archived;
  const result = evaluationRun(root.campaign, root.run, root.path);
  if (result.definitionId === 'single-agent' && agent === 'candidate') {
    const path = join(root.path, 'candidate-session/events.jsonl');
    return existsSync(path) ? path : null;
  }
  const workflowRoot = join(root.path, 'workflow');
  return existsSync(workflowRoot) ? localAgentLog(workflowRoot, agent) : null;
}
const artifacts: Record<string, string> = {
  spec: 'spec.json',
  plan: 'plan.md',
  patch: 'candidate.patch',
  result: 'RESULTADO.md',
};
export type WorkflowLauncher = (directory: string, approvePlan?: boolean) => void;
/** Local authenticated API; no endpoint accepts an arbitrary filesystem path. */
export function createWorkflowApi(project: string, token: string, launch: WorkflowLauncher) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.hostname !== '127.0.0.1' || request.headers.get('host') !== url.host)
      return Response.json({ error: 'Solo loopback.' }, { status: 403 });
    if (
      request.method !== 'GET' &&
      (request.method !== 'POST' ||
        request.headers.get('origin') !== url.origin ||
        request.headers.get('x-lab-token') !== token)
    )
      return Response.json({ error: 'Origen o sesión no permitidos.' }, { status: 403 });
    try {
      if (request.method === 'GET' && url.pathname === '/api/workflows/catalog')
        return Response.json({
          definitions: definitions(project),
          specs: knownSpecs(project),
          harnesses: Object.keys(installedHarnesses),
          agentDefaults: agentConfigSchema.parse(
            JSON.parse(readFileSync(resolve(project, 'workflow.agents.json'), 'utf8')),
          ),
        });
      if (url.pathname === '/api/workflows') {
        if (request.method === 'GET') {
          const requested = url.searchParams.get('source');
          const source = requested ? z.enum(['local', 'evaluation']).parse(requested) : undefined;
          return Response.json(summaries(project, source));
        }
        const input = launchSchema.parse(await request.json());
        const spec = knownSpecs(project).find((item) => item.path === input.specPath);
        if (!spec) throw new Error('Selecciona una spec del catálogo.');
        const agents = resolveAgents(input.agentConfig);
        validateAgents(agents);
        const active = summaries(project, 'local').find(
          (run) =>
            run.source === 'local' &&
            run.rawStatus !== 'waiting-plan' &&
            run.status === 'running' &&
            run.title === spec.title,
        );
        if (active)
          return Response.json(
            { error: `Ya existe una ejecución activa de esta tarea: ${active.runId}` },
            { status: 409 },
          );
        const state = createRun(
          project,
          specSchema.parse(JSON.parse(readFileSync(confined(project, spec.path), 'utf8'))),
          {
            mode: input.mode,
            agents,
            planReview: input.planReview,
            headed: false,
            maxRounds: 2,
            maxTaskAttempts: 2,
          },
        );
        try {
          launch(state.directory);
        } catch (error) {
          return Response.json(
            { error: `Run creado pero no arrancó: ${String(error)}`, ref: `local:${state.id}` },
            { status: 500 },
          );
        }
        return Response.json({ ref: `local:${state.id}` }, { status: 202 });
      }
      const approval = url.pathname.match(/^\/api\/workflows\/([^/]+)\/approve-plan$/);
      if (request.method === 'POST' && approval?.[1]) {
        const ref = decodeURIComponent(approval[1]);
        const root = runRoot(project, ref);
        if (root.source !== 'local') throw new Error('Solo se puede aprobar un workflow local.');
        const state = load(root.path);
        if (state.status !== 'waiting-plan')
          throw new Error('El run no espera aprobación del plan.');
        if (existsSync(join(root.path, 'running.lock')))
          throw new Error('El run sigue en ejecución. Espera a que se detenga.');
        const marker = join(root.path, 'approval.lock');
        if (existsSync(marker))
          return Response.json({ error: 'La aprobación ya se solicitó.' }, { status: 409 });
        const descriptor = openSync(marker, 'wx', 0o600);
        closeSync(descriptor);
        try {
          launch(root.path, true);
        } catch (error) {
          unlinkSync(marker);
          throw error;
        }
        return Response.json({ ref }, { status: 202 });
      }
      const match = url.pathname.match(
        /^\/api\/workflows\/([^/]+)(?:\/(stream|agents\/((?:candidate|[a-f0-9]{16}))\/trace|artifacts\/([a-z]+)))?$/,
      );
      if (request.method === 'GET' && match?.[1]) {
        const ref = decodeURIComponent(match[1]);
        if (match[2] === 'stream') {
          const encoder = new TextEncoder();
          let interval: ReturnType<typeof setInterval> | undefined;
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              let previous = '';
              const send = () => {
                try {
                  const data = JSON.stringify(snapshot(project, ref));
                  if (data === previous) return;
                  previous = data;
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch (error) {
                  controller.enqueue(
                    encoder.encode(
                      `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`,
                    ),
                  );
                }
              };
              send();
              interval = setInterval(send, 1200);
              request.signal.addEventListener(
                'abort',
                () => {
                  if (interval) clearInterval(interval);
                  try {
                    controller.close();
                  } catch {
                    /* already closed */
                  }
                },
                { once: true },
              );
            },
            cancel() {
              if (interval) clearInterval(interval);
            },
          });
          return new Response(stream, {
            headers: {
              'content-type': 'text/event-stream; charset=utf-8',
              'cache-control': 'no-store',
              connection: 'keep-alive',
            },
          });
        }
        if (match[3]) {
          const root = runRoot(project, ref);
          const workflow = root.source === 'local' ? root.path : join(root.path, 'workflow');
          const archived =
            root.source === 'evaluation' &&
            existsSync(join(root.path, 'trace-archive', `${match[3]}.projected.jsonl`));
          const qa =
            !archived && existsSync(workflow) ? qaDirectoryForAgent(workflow, match[3]) : null;
          const file = traceFile(project, ref, match[3]);
          const cursor = url.searchParams.get('before');
          const before = cursor === null ? undefined : Number(cursor);
          if (before !== undefined && (!Number.isSafeInteger(before) || before <= 0))
            throw new Error('Cursor de traza inválido.');
          return qa
            ? Response.json(qaTracePage(qa, before))
            : file
              ? Response.json(tracePage(file, before))
              : Response.json(
                  { error: 'Esta traza no se conservó o aún no existe.' },
                  { status: 404 },
                );
        }
        if (match[4]) {
          const root = runRoot(project, ref);
          const file =
            root.source === 'local'
              ? artifacts[match[4]]
              : { patch: 'candidate.patch', result: 'result.json' }[match[4]];
          if (!file) throw new Error('Artefacto no permitido.');
          const path = confined(root.path, file);
          if (statSync(path).size > 2_000_000) throw new Error('Artefacto demasiado grande.');
          return new Response(readFileSync(path, 'utf8'), {
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          });
        }
        return Response.json(snapshot(project, ref));
      }
      return Response.json({ error: 'No encontrado.' }, { status: 404 });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
  };
}

export function spawnWorkflowWorker(project: string, directory: string, approvePlan = false) {
  const log = openSync(join(directory, 'controller.log'), approvePlan ? 'a' : 'wx', 0o600);
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '--no-env-file',
        resolve(project, 'scripts/workflow-observer/worker.ts'),
        directory,
        ...(approvePlan ? ['--approve-plan'] : []),
      ],
      {
        cwd: project,
        stdin: 'ignore',
        stdout: log,
        stderr: log,
      },
    );
    void child.exited.finally(() => closeSync(log));
  } catch (error) {
    closeSync(log);
    throw error;
  }
}
