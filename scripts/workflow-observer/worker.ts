import { resolve } from 'node:path';
import { load, phase } from '../local-workflow/run-state';
import { executeWorkflow } from '../local-workflow/workflow';

const directory = process.argv[2];
if (!directory) throw new Error('Missing workflow directory');
const state = load(resolve(directory));
try {
  const result = await executeWorkflow(state, process.argv.includes('--approve-plan'));
  process.exitCode = ['completed', 'waiting-plan'].includes(result.status) ? 0 : 2;
} catch (error) {
  phase(state, 'failed', `El controlador terminó con error: ${String(error)}`);
  console.error(error);
  process.exitCode = 2;
}
