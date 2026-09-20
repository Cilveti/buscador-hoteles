import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { specSchema } from './contracts';
import { createRun, executeWorkflow, load } from './workflow';

const help = `Workflow local · Claude implementa / Codex revisa y prueba

bun run workflow start --spec docs/workflows/examples/escape-search.json [--mode normal|ralph] [--plan-review] [--headed]
bun run workflow status <directorio-del-run>
bun run workflow resume <directorio-del-run> --approve-plan

Default: sin PostgreSQL, 2 intentos por subtarea y 2 rondas de revisión/QA.
Opciones: --max-rounds 1..3 --max-task-attempts 1..3
Usa las sesiones CLI existentes de Claude y Codex. No publica ni integra cambios.
WORKFLOW_CLAUDE_MODEL y WORKFLOW_CODEX_MODEL permiten elegir modelos.
`;
async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      spec: { type: 'string' },
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
