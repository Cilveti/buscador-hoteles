import type { ReactNode } from 'react';

const labels: Record<string, string> = {
  summary: 'Resumen',
  tasks: 'Tareas',
  instructions: 'Qué hay que hacer',
  criteria: 'Criterios',
  findings: 'Hallazgos',
  path: 'Archivo',
  problem: 'Problema',
  criterion: 'Criterio',
  results: 'Criterios comprobados',
  observed: 'Qué se observó',
  evidence: 'Evidencias',
  files: 'Archivos',
  risks: 'Riesgos',
  blockers: 'Bloqueos',
  decisions: 'Decisiones',
  objective: 'Objetivo',
  scope: 'Alcance',
  outOfScope: 'Fuera de alcance',
  acceptance: 'Aceptación',
  rationale: 'Justificación',
  action: 'Acción',
  outcome: 'Resultado',
  status: 'Estado',
  screenshots: 'Capturas',
  history: 'Historial del navegador',
  requests: 'Peticiones HTTP',
  before: 'Observación previa',
  screenshot: 'Captura',
  baseURL: 'URL de la aplicación',
  role: 'Rol',
  name: 'Nombre',
  value: 'Valor',
  notes: 'Notas',
  errors: 'Errores',
};
const emptyLabels: Record<string, string> = {
  findings: 'No se registraron hallazgos.',
  blockers: 'Sin bloqueos declarados.',
  risks: 'No se declararon riesgos.',
  files: 'No se indicaron archivos.',
  evidence: 'Sin evidencias adjuntas.',
  results: 'No hay criterios registrados.',
};
const statuses: Record<string, { label: string; tone: string }> = {
  pass: { label: 'Correcto', tone: 'success' },
  passed: { label: 'Correcto', tone: 'success' },
  fail: { label: 'Falló', tone: 'danger' },
  failed: { label: 'Falló', tone: 'danger' },
  implemented: { label: 'Implementado', tone: 'info' },
  blocked: { label: 'Bloqueado', tone: 'warning' },
  'changes-requested': { label: 'Cambios solicitados', tone: 'warning' },
  'not-verified': { label: 'Sin verificar', tone: 'neutral' },
  pending: { label: 'Pendiente', tone: 'neutral' },
  running: { label: 'En curso', tone: 'info' },
  completed: { label: 'Completado', tone: 'info' },
};
const technicalFields = new Set(['history', 'requests', 'screenshots']);
const tagFields = new Set(['files', 'evidence', 'criteria', 'screenshots']);
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const labelFor = (field: string) =>
  labels[field] ?? field.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');

function ResultStatus({ value }: { value: string | boolean }) {
  const state =
    typeof value === 'boolean'
      ? { label: value ? 'Pasó' : 'No pasó', tone: value ? 'success' : 'danger' }
      : (statuses[value] ?? { label: value, tone: 'neutral' });
  return <span className={`result-status result-status-${state.tone}`}>{state.label}</span>;
}

function ResultField({ field, value, depth }: { field: string; value: unknown; depth: number }) {
  const content = <ResultValue value={value} field={field} depth={depth} />;
  if (technicalFields.has(field))
    return (
      <details className="result-technical">
        <summary>
          {labelFor(field)}
          {Array.isArray(value) ? ` · ${value.length}` : ''}
        </summary>
        {content}
      </details>
    );
  return (
    <section className={`result-field result-field-${field.replace(/[^a-zA-Z-]/g, '')}`}>
      <h4>{labelFor(field)}</h4>
      {content}
    </section>
  );
}

function ResultObject({ value, depth }: { value: Record<string, unknown>; depth: number }) {
  const title = typeof value.title === 'string' ? value.title : null;
  const id = typeof value.id === 'string' ? value.id : null;
  const summary = typeof value.summary === 'string' ? value.summary : null;
  const status = typeof value.status === 'string' ? value.status : null;
  const passed = typeof value.passed === 'boolean' ? value.passed : null;
  const used = new Set([
    ...(title !== null ? ['title'] : []),
    ...(id !== null ? ['id'] : []),
    ...(summary !== null ? ['summary'] : []),
    ...(status !== null ? ['status'] : []),
    ...(passed !== null ? ['passed'] : []),
  ]);
  const fields = Object.entries(value)
    .filter(([key]) => !used.has(key))
    .sort(([left], [right]) => Number(left === 'files') - Number(right === 'files'));
  return (
    <div className="result-object">
      {(title !== null || id !== null || status !== null || passed !== null) && (
        <div className="result-heading">
          {id !== null && <code className="result-tag">{id}</code>}
          {title !== null && <h3>{title}</h3>}
          {status !== null && <ResultStatus value={status} />}
          {passed !== null && <ResultStatus value={passed} />}
        </div>
      )}
      {summary !== null && <p className="result-summary">{summary || 'Sin resumen.'}</p>}
      {fields.map(([field, entry]) => (
        <ResultField key={field} field={field} value={entry} depth={depth + 1} />
      ))}
      {!Object.keys(value).length && <p className="result-empty">Sin datos registrados.</p>}
    </div>
  );
}

function ResultValue({
  value,
  field = '',
  depth = 0,
}: {
  value: unknown;
  field?: string;
  depth?: number;
}): ReactNode {
  if (value === null) return <span className="result-empty">Sin dato</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Sí' : 'No'}</span>;
  if (typeof value === 'number') return <span>{value}</span>;
  if (typeof value === 'string')
    return field === 'path' || field === 'screenshot' ? (
      <code className="result-path">{value || 'No indicado'}</code>
    ) : (
      <p className="result-text">{value || 'No indicado'}</p>
    );
  if (depth > 8) return <pre className="result-json">{JSON.stringify(value, null, 2)}</pre>;
  if (Array.isArray(value)) {
    if (!value.length)
      return <p className="result-empty">{emptyLabels[field] ?? 'Sin elementos registrados.'}</p>;
    if (value.every((entry) => typeof entry === 'string'))
      return tagFields.has(field) ? (
        <div className="result-tags">
          {value.map((entry, index) => (
            <code className="result-tag" key={`${index}-${entry}`}>
              {entry}
            </code>
          ))}
        </div>
      ) : (
        <ul className="result-list">
          {value.map((entry, index) => (
            <li key={`${index}-${entry}`}>{entry}</li>
          ))}
        </ul>
      );
    return (
      <ol className="result-cards">
        {value.map((entry, index) => (
          <li key={index}>
            <ResultValue value={entry} field={field} depth={depth + 1} />
          </li>
        ))}
      </ol>
    );
  }
  if (isObject(value)) return <ResultObject value={value} depth={depth} />;
  return <span className="result-empty">Sin dato</span>;
}

/** Use the same readable projection for final trace messages, phase outputs and handoffs. */
export function ResultContent({
  text,
  plain = 'prose',
  title,
}: {
  text: string;
  plain?: 'prose' | 'code';
  title?: string;
}) {
  const source = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1');
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    // Partial streamed or historically truncated JSON must remain inspectable.
  }
  if (!isObject(value) && !Array.isArray(value))
    return (
      <div className="result-fallback">
        {/^[[{]/.test(source) && (
          <p className="result-empty">
            JSON incompleto o no válido. Se muestra el texto disponible.
          </p>
        )}
        {plain === 'code' ? (
          <pre className="workflow-artifact-text">{text}</pre>
        ) : (
          <p className="result-text">{text}</p>
        )}
      </div>
    );
  return (
    <div className="result-content">
      {title && <h3 className="result-phase-title">{title}</h3>}
      <ResultValue value={value} />
      <details className="result-source">
        <summary>Ver JSON original</summary>
        <pre className="result-json">{text}</pre>
      </details>
    </div>
  );
}
