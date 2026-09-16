import { config } from './config';
import { object, string } from './github';
import type { Task } from './state';

// Model prose is explanatory data, never a source of gate results or publication authority.
export function prose(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('@', '@\u200b')
    .replaceAll('\r', '')
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

const qualityStart = '<!-- factory:quality:start -->';
const qualityEnd = '<!-- factory:quality:end -->';
export function qualitySection(state: 'pending' | 'success' | 'failure', runUrl: string): string {
  const message = {
    pending:
      '**Pendiente:** Sonar está analizando esta propuesta. Espera al resultado antes de revisarla para integrar.',
    success:
      '**Superado:** Sonar ha aprobado el quality gate de este commit. La decisión de integrar sigue siendo humana.',
    failure:
      '**Bloqueado:** Sonar no ha completado el quality gate con éxito. Revisa el análisis antes de integrar.',
  }[state];
  return `${qualityStart}\n### Calidad de código\n\n${message}\n\n[Ver análisis y ejecución](${runUrl})\n${qualityEnd}`;
}

/** Replace only our section so later operator notes are preserved. */
export function updateQuality(body: string, state: 'success' | 'failure', runUrl: string): string {
  const start = body.indexOf(qualityStart);
  const end = body.indexOf(qualityEnd, start);
  if (start < 0 || end < start) throw new Error('Missing managed quality section');
  return body.slice(0, start) + qualitySection(state, runUrl) + body.slice(end + qualityEnd.length);
}

export function publicationEvidence(
  task: Task,
  patchSha: string,
  proposal: unknown,
  review: unknown,
) {
  const change = object(proposal);
  const verdict = object(review);
  for (const item of [change, verdict]) {
    if (item.baseSha !== task.baseSha || item.patchSha !== patchSha)
      throw new Error('Publication evidence does not match the verified patch');
  }
  if (change.specificationSha !== task.specificationSha)
    throw new Error('Proposal summary belongs to another specification');
  if (
    verdict.source !== 'reviewer' ||
    verdict.status !== 'pass' ||
    !Array.isArray(verdict.findings) ||
    verdict.findings.length
  )
    throw new Error('Publication requires an independent passing review');
  return { summary: string(change.summary), review: string(verdict.summary) };
}

export function pullRequestBody(input: { task: Task; runUrl: string; summary: string }): string {
  const { task, runUrl, summary } = input;
  return [
    `## Qué cambia\n\nPropuesta para #${task.issue}.\n\n${prose(summary)}`,
    `## Qué se ha comprobado\n\n- Lint, tipos y tests de comportamiento: superados.\n- Aplicación real y base de datos temporal: pruebas de navegador superadas.\n- Build de producción: superado.\n- Revisión independiente del código y de la evidencia: sin defectos que bloqueen esta propuesta.\n\n[Consultar logs, capturas y trazas](${runUrl}) (artefactos disponibles durante siete días).`,
    qualitySection('pending', runUrl),
    `## Qué necesita una persona\n\nComprobar que el cambio resuelve la intención de la tarea y revisar el diff. Si GitHub muestra **Approve workflows to run**, autorizar esa CI adicional y esperar sus resultados antes de decidir si se integra. Aprobar una ejecución no aprueba el código. La PR queda en borrador; no se ha fusionado ni desplegado.`,
  ].join('\n\n');
}

export function taskOutcome(task: Task, runUrl: string, detail: string): string {
  const outcomes: Record<Task['status'], string> = {
    ready: 'La tarea está preparada.',
    running: 'El agente está trabajando.',
    publishing: 'Las comprobaciones han pasado. Se está publicando la propuesta.',
    retry:
      'La propuesta necesita una corrección. Se enviarán el parche y los fallos al siguiente intento.',
    'waiting-human': 'Hace falta una decisión humana para continuar.',
    review: 'La propuesta está lista para revisión humana: checks, revisor y Sonar superados.',
    rejected: 'Permiso rechazado. La tarea se ha detenido.',
    cancelled: 'Tarea cancelada. El agente ya no puede publicar una propuesta para esta ejecución.',
    exhausted:
      'Se han agotado los intentos. La tarea se detiene para que una persona revise los fallos.',
    failed:
      'La ejecución ha fallado. Revisa la fase que falló antes de solicitar una recuperación.',
  };
  const budget =
    task.attempts >= config.limits.attempts && task.status === 'failed'
      ? ' No quedan intentos disponibles para esta tarea.'
      : '';
  return `## ${task.status === 'review' ? 'Propuesta preparada' : 'Estado de la tarea'}\n\n${outcomes[task.status]}${budget}\n\nIntentos utilizados: **${task.attempts}/${config.limits.attempts}**.\n\n${detail}\n\n[Ver ejecución y evidencia](${runUrl}).`;
}
