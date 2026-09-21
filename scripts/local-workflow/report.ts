import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { validateAgents } from './agents';
import type { reviewSchema } from './contracts';
import { digest } from './policy';
import type { runQa } from './qa';
import type { WorkflowState } from './run-state';

export function writeDelivery(
  state: WorkflowState,
  patch: string,
  review: z.infer<typeof reviewSchema>,
  qa: Awaited<ReturnType<typeof runQa>>,
): void {
  validateAgents(state.agents);
  const frozen = digest(patch);
  writeFileSync(join(state.directory, 'candidate.patch'), patch);
  writeFileSync(
    join(state.directory, 'RESULTADO.md'),
    `# ${state.spec.title}\n\nWorkflow **${state.mode}** completado sobre el snapshot ${state.base}.\n\n## Resultado\n${review.summary}\n\n## Evidencias de producto\n` +
      qa.results
        .map(
          (result) =>
            `- **${result.id} — ${result.status}:** ${result.observed}\n${result.evidence.map((file) => `  - [${file}](round-${state.round}/qa/${file})`).join('\n')}`,
        )
        .join('\n') +
      `\n\n[Traza del navegador](round-${state.round}/qa/trace.zip) · [Patch](candidate.patch) · [Plan](plan.md)\n\nImplementación: ${state.agents.implementer.harness}; revisión: ${state.agents.reviewer.harness}; QA: ${state.agents.qa.harness}. Sesiones separadas; usar el mismo arnés/modelo no aporta diversidad de proveedor. Checks externos verdes sobre el mismo patch SHA256 ${frozen}.\n\nAlcance de QA: componentes React, handlers HTTP y core con catálogo sintético; no verifica Payload/PostgreSQL ni SSR. No ejecuta Sonar. No ha creado PR, commit del candidato, merge ni despliegue.\n\nWorkspace: ${state.workspace}\n`,
  );
}
