import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readAgents } from './agents';
import { readySpecSchema, specSchema } from './contracts';
import { createRun, load } from './run-state';
import { executeWorkflow } from './workflow';

const help = `Workflow local · roles configurables · Codex por defecto

bun run workflow start --spec docs/workflows/examples/copy-search.json [--mode normal|ralph] [--agents workflow.agents.json] [--plan-review] [--headed]
bun run workflow status <directorio-del-run>
bun run workflow resume <directorio-del-run> --approve-plan
bun run workflow validate --spec RUTA/spec.json

Default: sin PostgreSQL, 2 intentos por subtarea y 2 rondas de revisión/QA.
Opciones: --max-rounds 1..3 --max-task-attempts 1..3
Usa el arnés/modelo de workflow.agents.json. Configuración inicial: todo con Codex.
No publica ni integra cambios. Cada ejecución conserva su configuración de agentes.
`;
async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      spec: { type: 'string' },
      agents: { type: 'string', default: 'workflow.agents.json' },
      mode: { type: 'string', default: 'normal' },
      'plan-review': { type: 'boolean', default: false },
      'approve-plan': { type: 'boolean', default: false },
      headed: { type: 'boolean', default: false },
      'max-rounds': { type: 'string', default: '2' },
      'max-task-attempts': { type: 'string', default: '2' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || !positionals.length) {
    console.log(help);
    return;
  }
  const command = positionals[0];
  if (command === 'validate') {
    if (!values.spec) throw new Error('Missing --spec');
    const spec = readySpecSchema.parse(JSON.parse(readFileSync(resolve(values.spec), 'utf8')));
    console.log(
      `Especificación válida: ${spec.title} (${spec.acceptance.length} casos). No publica, etiqueta ni ejecuta agentes; falta confirmar el acuerdo humano.`,
    );
    return;
  }
  if (command === 'status' || command === 'resume') {
    const directory = positionals[1];
    if (!directory) throw new Error('Missing run directory');
    const state = load(resolve(directory));
    if (command === 'status') {
      console.log(`${state.status}: ${state.message}\n${state.directory}`);
      return;
    }
    if (state.status !== 'waiting-plan' || !values['approve-plan'])
      throw new Error('Only a waiting-plan run can resume with --approve-plan');
    const result = await executeWorkflow(state, true);
    process.exitCode = result.status === 'completed' ? 0 : 2;
    return;
  }
  if (command !== 'start' || !values.spec) throw new Error(help);
  if (values.mode !== 'normal' && values.mode !== 'ralph')
    throw new Error('Mode must be normal or ralph');
  const maxRounds = Number(values['max-rounds']),
    maxTaskAttempts = Number(values['max-task-attempts']);
  if (![maxRounds, maxTaskAttempts].every((n) => Number.isInteger(n) && n >= 1 && n <= 3))
    throw new Error('Limits must be integers from 1 to 3');
  const spec = specSchema.parse(JSON.parse(readFileSync(resolve(values.spec), 'utf8')));
  const state = createRun(process.cwd(), spec, {
    mode: values.mode,
    agents: readAgents(resolve(values.agents)),
    planReview: values['plan-review'],
    headed: values.headed,
    maxRounds,
    maxTaskAttempts,
  });
  console.log(`Run: ${state.directory}\nWorkspace: ${state.workspace}`);
  const result = await executeWorkflow(state);
  console.log(`Resultado: ${result.status}\n${result.directory}`);
  process.exitCode = ['completed', 'waiting-plan'].includes(result.status) ? 0 : 2;
}
if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
