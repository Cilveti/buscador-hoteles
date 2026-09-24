import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { string } from '../github';

const directory = string(process.env.FACTORY_EVIDENCE_DIR);
const phasesPath = join(directory, 'phases.tsv');
const outcomes = new Map(
  (existsSync(phasesPath) ? readFileSync(phasesPath, 'utf8').trim() : '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [phase, code] = line.split('\t');
      return [phase, code] as const;
    }),
);
const rows = [
  ['unit', 'Lint, tipos y tests de comportamiento'],
  ['e2e', 'Navegador con aplicación y PostgreSQL reales'],
  ['build', 'Build de producción'],
].map(([phase, label]) => {
  const result = outcomes.get(phase);
  return `| ${label} | ${result === '0' ? 'Superado' : result ? 'Falló' : 'No completado'} |`;
});
appendFileSync(
  string(process.env.GITHUB_STEP_SUMMARY),
  [
    '## Resultado de CI',
    '| Comprobación | Resultado |\n|---|---|\n' + rows.join('\n'),
    'Los artefactos de esta ejecución contienen logs, capturas y trazas de Playwright. La aplicación y la base de datos son temporales y se eliminan al terminar. Un build correcto no equivale a un despliegue.',
  ].join('\n\n') + '\n',
);
