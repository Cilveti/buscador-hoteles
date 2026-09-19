import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Button } from '../../../apps/web/src/components/ui/button';
import { Input } from '../../../apps/web/src/components/ui/input';

const recordSchema = z.record(z.string(), z.unknown());
const recordsSchema = z.array(recordSchema);
const stringsSchema = z.array(z.string());
const record = (value: unknown) => recordSchema.safeParse(value).data ?? {};
const text = (value: unknown, fallback = '—'): string =>
  value == null ? fallback : typeof value === 'object' ? JSON.stringify(value) : String(value);
const strings = (value: unknown) => stringsSchema.safeParse(value).data ?? [];
const statusNames: Record<string, string> = {
  running: 'En curso',
  starting: 'Iniciando',
  baseline: 'Comprobando base',
  candidate: 'Candidato',
  verification: 'Verificando',
  judge: 'Juez',
  evaluated: 'Evaluada',
  evaluated_pass: 'Evaluada · exitosa',
  evaluated_fail: 'Evaluada · fallida',
  tests_pass: 'Correctos',
  tests_fail: 'Fallidos',
  tests_pending: 'Pendientes',
  prepared: 'Base comprobada',
  completed: 'Finalizada',
  failed: 'Error',
  fail: 'Fallo',
  pass: 'Correcto',
  passed: 'Correcto',
  true: 'Correcto',
  false: 'Fallo',
  incomplete: 'Incompleta',
  evaluation_error: 'Error de evaluación',
  interrupted: 'Interrumpida',
  baseline_failed: 'Base con errores',
};
function Status({ value }: { value: unknown }) {
  const key = text(value);
  const tone = ['evaluated_pass', 'tests_pass', 'pass', 'passed', 'true'].includes(key)
    ? 'good'
    : [
          'evaluated_fail',
          'tests_fail',
          'evaluation_error',
          'failed',
          'fail',
          'false',
          'incomplete',
          'baseline_failed',
        ].includes(key)
      ? 'bad'
      : ['evaluated', 'completed', 'prepared'].includes(key)
        ? 'info'
        : '';
  return (
    <span className={`status ${tone}`}>
      {key === 'running' && <span className="spinner" aria-hidden="true" />}
      {statusNames[key] ?? key}
    </span>
  );
}
function shortDate(value: unknown) {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}
function durationMs(row: RunRow) {
  if (row.runId == null) return null;
  const start = Date.parse(text(row.startedAt));
  const end = Date.parse(text(row.finishedAt, new Date().toISOString()));
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
}
function duration(value: unknown) {
  if (typeof value !== 'number') return '—';
  const seconds = Math.floor(value / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
function listLabel(value: unknown) {
  const values = strings(value);
  return values.length ? values.join(' · ') : 'Ninguna';
}
function checkLabel(value: unknown) {
  if (value == null) return 'Por defecto';
  if (Array.isArray(value)) return strings(value).join(' · ') || 'Ninguno';
  if (typeof value === 'object')
    return (
      Object.entries(record(value))
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => key)
        .join(' · ') || 'Ninguno'
    );
  return text(value);
}
type RunRow = Record<string, unknown> & {
  campaign: string;
  config: Record<string, unknown>;
  runId: unknown;
  baseline: unknown;
};
function runStatus(row: RunRow) {
  if (row.outcome === 'evaluation_error') return 'evaluation_error';
  if (row.status !== 'evaluated') return row.status;
  if (row.outcome === 'incomplete') return 'incomplete';
  if (row.outcome === 'pass' || (row.outcome == null && row.passed === true))
    return 'evaluated_pass';
  if (row.outcome === 'fail' || (row.outcome == null && row.passed === false))
    return 'evaluated_fail';
  return 'evaluated';
}
const testGates = [
  ['repositoryChecksPassed', 'Checks del proyecto'],
  ['candidateTestsPassed', 'Tests del candidato'],
  ['taskAcceptancePassed', 'Aceptación visible'],
  ['privateAcceptancePassed', 'Aceptación privada'],
] as const;
function testStatus(row: RunRow) {
  const gates = testGates.map(([key]) => row[key]);
  if (row.repositoryChecksPassed === true && !gates.includes(false)) return 'tests_pass';
  // A false gate during an evaluation error may be an interrupted check, not a failed assertion.
  if (row.outcome === 'evaluation_error') return 'Sin concluir';
  if (gates.includes(false)) return 'tests_fail';
  if (['running', 'starting', 'baseline', 'candidate', 'verification'].includes(text(row.status)))
    return 'tests_pending';
  return '—';
}
type Column = {
  id: string;
  label: string;
  width: number;
  value: (row: RunRow) => unknown;
  render?: (value: unknown, row: RunRow) => ReactNode;
  numeric?: boolean;
};
const configColumn = (id: string, label: string, width = 130): Column => ({
  id,
  label,
  width,
  value: (row) => row.config[id],
});
const yesNo = (value: unknown) => (value == null ? '—' : value ? 'Sí' : 'No');
const hashRender = (value: unknown) => <code>{text(value).slice(0, 10)}</code>;
const columns: Column[] = [
  {
    id: 'status',
    label: 'Estado',
    width: 170,
    value: runStatus,
    render: (value) => <Status value={value} />,
  },
  { id: 'startedAt', label: 'Fecha', width: 116, value: (row) => row.startedAt, render: shortDate },
  configColumn('task', 'Tarea', 170),
  configColumn('model', 'Modelo', 140),
  configColumn('harness', 'Arnés', 110),
  configColumn('effort', 'Esfuerzo', 95),
  configColumn('skillLanguage', 'Idioma skills', 105),
  configColumn('skillLanguages', 'Idiomas específicos', 160),
  {
    id: 'tests',
    label: 'Tests',
    width: 100,
    value: testStatus,
    render: (value, row) => (
      <span
        title={testGates
          .map(
            ([key, label]) =>
              `${label}: ${row[key] === true ? 'Correcto' : row[key] === false ? 'Fallo' : 'Sin dato / no aplicado'}`,
          )
          .join('\n')}
      >
        <Status value={value} />
      </span>
    ),
  },
  {
    id: 'score',
    label: 'Nota juez',
    width: 90,
    numeric: true,
    value: (row) => row.score,
    render: (value) => (typeof value === 'number' ? `${value.toFixed(1)} / 10` : '—'),
  },
  {
    id: 'judgeTaskVerdict',
    label: 'Juez',
    width: 110,
    value: (row) => row.judgeTaskVerdict,
    render: (value) => <Status value={value} />,
  },
  {
    id: 'taskAcceptancePassed',
    label: 'Aceptación visible',
    width: 154,
    value: (row) => row.taskAcceptancePassed,
    render: (value) => <Status value={value} />,
  },
  {
    id: 'privateAcceptancePassed',
    label: 'Aceptación privada',
    width: 157,
    value: (row) => row.privateAcceptancePassed,
    render: (value) => <Status value={value} />,
  },
  { id: 'duration', label: 'Duración', width: 104, value: durationMs, render: duration },
  {
    id: 'baseline',
    label: 'Commit base',
    width: 113,
    value: (row) => row.baseline,
    render: hashRender,
  },
  {
    id: 'baselineRef',
    label: 'Rama / referencia',
    width: 172,
    value: (row) => row.config.baseline,
  },
  { ...configColumn('skills', 'Skills disponibles', 220), render: listLabel },
  { ...configColumn('initialSkills', 'Skills iniciales', 220), render: listLabel },
  { ...configColumn('candidateChecks', 'Checks del candidato', 225), render: checkLabel },
  {
    ...configColumn('processSkill', 'Skill de proceso', 176),
    render: (value) => text(value).replace('.agents/skills/', '').replace('/SKILL.md', ''),
  },
  {
    id: 'input',
    label: 'Entrada',
    width: 128,
    value: (row) =>
      row.config.specificationText != null || row.config.promptText != null
        ? 'Editada'
        : row.config.promptFile
          ? 'Prompt completo'
          : row.config.taskFile
            ? 'Tarea + skill'
            : 'Plantilla',
  },
  {
    id: 'specificationHash',
    label: 'Hash especificación',
    width: 167,
    value: (row) =>
      record(row.candidatePrompt).specificationSha256 ??
      record(row.candidatePrompt).taskFileSha256 ??
      record(row.inputProvenance).specificationSha256 ??
      row.specificationHash,
    render: hashRender,
  },
  {
    id: 'promptHash',
    label: 'Hash prompt',
    width: 137,
    value: (row) =>
      record(row.candidatePrompt).sha256 ??
      record(row.inputProvenance).promptSha256 ??
      row.promptHash,
    render: hashRender,
  },
  { ...configColumn('selfVerify', 'Autoverificar', 126), render: yesNo },
  { ...configColumn('browserSkill', 'Navegador', 110), render: yesNo },
  { ...configColumn('privateAcceptance', 'Suite privada', 126), render: yesNo },
  { ...configColumn('judgeDossier', 'Dossier', 100), render: yesNo },
  {
    id: 'compactions',
    label: 'Compactaciones',
    width: 149,
    numeric: true,
    value: (row) => record(row.compactions).count ?? record(record(row.process).compactions).count,
  },
  { ...configColumn('repeats', 'Repeticiones', 118), numeric: true },
  { ...configColumn('concurrency', 'Paralelo', 92), numeric: true },
  {
    ...configColumn('timeoutSeconds', 'Límite candidato', 151),
    render: (value) => (value == null ? 'Sin límite' : `${text(value)} s`),
  },
  {
    ...configColumn('checkTimeoutSeconds', 'Límite check', 122),
    render: (value) => (value == null ? '—' : `${text(value)} s`),
  },
  {
    ...configColumn('maxSteps', 'Pasos máx.', 115),
    numeric: true,
    render: (value, row) => (row.config.harness === 'opencode' ? text(value) : '—'),
  },
  { id: 'campaign', label: 'Campaña', width: 272, value: (row) => row.campaign },
  {
    id: 'estimatedApiCostUsd',
    label: 'Coste est.',
    width: 96,
    numeric: true,
    value: (row) => row.estimatedApiCostUsd,
    render: (value) => (typeof value === 'number' ? `$${value.toFixed(3)}` : '—'),
  },
];
const defaults = [
  {
    name: 'Resumen',
    columns: ['startedAt', 'task', 'model', 'tests', 'score', 'duration', 'estimatedApiCostUsd'],
  },
  {
    name: 'Arnés',
    columns: [
      'task',
      'model',
      'harness',
      'effort',
      'skillLanguage',
      'skillLanguages',
      'skills',
      'initialSkills',
      'candidateChecks',
      'baselineRef',
    ],
  },
  {
    name: 'Verificación',
    columns: [
      'task',
      'tests',
      'score',
      'judgeTaskVerdict',
      'taskAcceptancePassed',
      'privateAcceptancePassed',
      'candidateChecks',
      'judgeDossier',
    ],
  },
  {
    name: 'Coste y proceso',
    columns: [
      'startedAt',
      'task',
      'model',
      'estimatedApiCostUsd',
      'duration',
      'compactions',
      'effort',
      'concurrency',
    ],
  },
];
const viewSchema = z.object({ name: z.string().min(1), columns: z.array(z.string()) });
const preferencesSchema = z.object({
  active: z.string(),
  columns: z.array(z.string()),
  custom: z.array(viewSchema),
  sort: z.object({ key: z.string(), descending: z.boolean() }),
  query: z.string().default(''),
  status: z.string().default('all'),
  pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(25),
});
type Preferences = z.infer<typeof preferencesSchema>;
const storageKey = 'harness-lab.run-table.v2';
const initialPreferences: Preferences = {
  active: 'Resumen',
  columns: defaults[0]?.columns ?? [],
  custom: [],
  sort: { key: 'startedAt', descending: true },
  query: '',
  status: 'all',
  pageSize: 25,
};
function loadPreferences(): Preferences {
  try {
    const saved = preferencesSchema.safeParse(
      JSON.parse(localStorage.getItem(storageKey) ?? 'null'),
    );
    if (saved.success) return saved.data;
    const legacy = preferencesSchema.safeParse(
      JSON.parse(localStorage.getItem('harness-lab.run-table.v1') ?? 'null'),
    );
    if (!legacy.success) return initialPreferences;
    const migrateColumns = (ids: string[]) =>
      ids.filter((id) => id !== 'status' && id !== 'passed');
    const preset = defaults.find((view) => view.name === legacy.data.active);
    return {
      ...legacy.data,
      columns: preset?.columns ?? migrateColumns(legacy.data.columns),
      custom: legacy.data.custom.map((view) => ({
        ...view,
        columns: migrateColumns(view.columns),
      })),
      sort: {
        ...legacy.data.sort,
        key: legacy.data.sort.key === 'passed' ? 'status' : legacy.data.sort.key,
      },
    };
  } catch {
    return initialPreferences;
  }
}

/** Column choices and saved views belong to this browser, independently of campaign recipes. */
export function RunsTable({
  campaigns,
  onSelect,
  onConfiguration,
  onDuplicate,
  campaignFilter,
}: {
  campaigns: Record<string, unknown>[];
  onSelect: (selection: { campaign: string; run: string }) => void;
  onConfiguration: (selection: { campaign: string; run: string }) => void;
  onDuplicate: (config: Record<string, unknown>) => void;
  campaignFilter?: string;
}) {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [columnQuery, setColumnQuery] = useState('');
  const [viewName, setViewName] = useState('');
  const [page, setPage] = useState(0);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    if (campaignFilter) {
      setPreferences((current) => ({ ...current, query: campaignFilter, status: 'all' }));
      setPage(0);
    }
  }, [campaignFilter]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
      setStorageError('');
    } catch {
      setStorageError('No se ha podido guardar esta vista en el navegador.');
    }
  }, [preferences]);
  const runRows = useMemo(
    () =>
      campaigns.flatMap((campaign): RunRow[] => {
        const runs = recordsSchema.safeParse(campaign.runs).data ?? [];
        return (
          runs.length
            ? runs
            : [{ id: null, status: campaign.status, startedAt: campaign.startedAt }]
        ).map((run) => ({
          inputProvenance: campaign.inputProvenance,
          candidatePrompt: campaign.candidatePrompt,
          ...run,
          campaign: text(campaign.id),
          config: record(campaign.config),
          baseline: campaign.baselineCommit,
          runId: run.id,
        }));
      }),
    [campaigns],
  );
  const visible = columns.filter(
    (column) => column.id !== 'status' && preferences.columns.includes(column.id),
  );
  const filtered = runRows
    .filter(
      (row) =>
        JSON.stringify(row).toLowerCase().includes(preferences.query.toLowerCase()) &&
        (preferences.status === 'all' ||
          (preferences.status === 'runs'
            ? row.runId != null
            : text(row.status) === preferences.status)),
    )
    .sort((a, b) => {
      const column = columns.find((item) => item.id === preferences.sort.key);
      const av = column?.value(a);
      const bv = column?.value(b);
      if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1;
      return (
        (typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : text(av).localeCompare(text(bv))) * (preferences.sort.descending ? -1 : 1)
      );
    });
  const maxPage = Math.max(0, Math.ceil(filtered.length / preferences.pageSize) - 1);
  const currentPage = Math.min(page, maxPage);
  const displayed = filtered.slice(
    currentPage * preferences.pageSize,
    (currentPage + 1) * preferences.pageSize,
  );
  function chooseView(name: string) {
    const view = [...defaults, ...preferences.custom].find((item) => item.name === name);
    if (view) setPreferences((current) => ({ ...current, active: name, columns: view.columns }));
  }
  function toggleColumn(id: string) {
    setPreferences((current) => ({
      ...current,
      active: '',
      columns: current.columns.includes(id)
        ? current.columns.filter((item) => item !== id)
        : [...current.columns, id],
    }));
  }
  const selectedView = [...defaults, ...preferences.custom].find(
    (view) => view.name === preferences.active,
  );
  const isCustom = preferences.custom.some((view) => view.name === preferences.active);
  const name = viewName.trim();
  function saveView() {
    if (!name || defaults.some((view) => view.name === name)) return;
    setPreferences((current) => ({
      ...current,
      active: name,
      custom: [
        ...current.custom.filter((view) => view.name !== name),
        { name, columns: current.columns },
      ],
    }));
    setViewName('');
  }
  return (
    <section className="runs-workspace" aria-label="Tabla de ejecuciones">
      <div className="runs-views">
        <fieldset className="runs-view-tabs" aria-label="Vistas de ejecuciones">
          {defaults.map((view) => (
            <Button
              key={view.name}
              type="button"
              size="sm"
              variant={preferences.active === view.name ? 'secondary' : 'ghost'}
              aria-pressed={preferences.active === view.name}
              onClick={() => chooseView(view.name)}
            >
              {view.name}
            </Button>
          ))}
        </fieldset>
        {preferences.custom.length > 0 && (
          <select
            aria-label="Vista guardada"
            value={isCustom ? preferences.active : ''}
            onChange={(event) => chooseView(event.target.value)}
          >
            <option value="">Mis vistas</option>
            {preferences.custom.map((view) => (
              <option key={view.name} value={view.name}>
                {view.name}
              </option>
            ))}
          </select>
        )}
        <details
          className="runs-columns"
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.currentTarget.open = false;
          }}
        >
          <summary>
            Columnas <span>{visible.length + 2}</span>
            <span aria-hidden="true">⌄</span>
          </summary>
          <div className="runs-columns-menu">
            <div className="runs-column-heading">
              <strong>{selectedView?.name ?? 'Vista personalizada'}</strong>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => chooseView(preferences.active || 'Resumen')}
              >
                Restablecer
              </Button>
            </div>
            <Input
              aria-label="Buscar columnas"
              placeholder="Buscar columnas…"
              value={columnQuery}
              onChange={(event) => setColumnQuery(event.target.value)}
            />
            <div className="runs-column-options">
              <label className="runs-column-fixed">
                <input type="checkbox" checked disabled />
                Estado · siempre visible
              </label>
              <label className="runs-column-fixed">
                <input type="checkbox" checked disabled />
                Run · siempre visible
              </label>
              {columns
                .filter((column) => column.id !== 'status')
                .filter((column) => column.label.toLowerCase().includes(columnQuery.toLowerCase()))
                .map((column) => (
                  <label key={column.id}>
                    <input
                      type="checkbox"
                      checked={preferences.columns.includes(column.id)}
                      onChange={() => toggleColumn(column.id)}
                    />
                    {column.label}
                  </label>
                ))}
            </div>
            <div className="runs-save-view">
              <Input
                aria-label="Nombre de la vista"
                placeholder="Nombre de la vista"
                value={viewName}
                maxLength={60}
                onChange={(event) => setViewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    saveView();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!name || defaults.some((view) => view.name === name)}
                onClick={saveView}
              >
                {preferences.custom.some((view) => view.name === name)
                  ? 'Actualizar'
                  : 'Guardar vista'}
              </Button>
            </div>
            {isCustom && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPreferences((current) => ({
                    ...current,
                    active: 'Resumen',
                    columns: initialPreferences.columns,
                    custom: current.custom.filter((view) => view.name !== current.active),
                  }))
                }
              >
                Eliminar vista «{preferences.active}»
              </Button>
            )}
          </div>
        </details>
      </div>
      <div className="runs-filters">
        <Input
          aria-label="Buscar ejecuciones"
          placeholder="Buscar tarea, modelo, skill…"
          value={preferences.query}
          onChange={(event) => {
            setPreferences((current) => ({ ...current, query: event.target.value }));
            setPage(0);
          }}
        />
        <select
          aria-label="Filtrar estado"
          value={preferences.status}
          onChange={(event) => {
            setPreferences((current) => ({ ...current, status: event.target.value }));
            setPage(0);
          }}
        >
          <option value="all">Todos los estados</option>
          <option value="runs">Solo runs</option>
          <option value="running">En curso</option>
          <option value="evaluated">Evaluadas</option>
          <option value="failed">Error</option>
          <option value="interrupted">Interrumpidas</option>
          <option value="incomplete">Incompletas</option>
          <option value="prepared">Base comprobada</option>
          <option value="baseline_failed">Base con errores</option>
        </select>
        <span className="runs-total">{filtered.length} registros</span>
      </div>
      {storageError && <p role="alert">{storageError}</p>}
      <div className="runs-grid-scroll">
        <table
          className="runs-grid"
          aria-label="Ejecuciones"
          style={{ minWidth: 332 + visible.reduce((sum, column) => sum + column.width, 0) }}
        >
          <colgroup>
            <col style={{ width: 170 }} />
            <col style={{ width: 70 }} />
            {visible.map((column) => (
              <col key={column.id} style={{ width: column.width }} />
            ))}
            <col style={{ width: 92 }} />
          </colgroup>
          <thead>
            <tr>
              <th
                scope="col"
                aria-sort={
                  preferences.sort.key === 'status'
                    ? preferences.sort.descending
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      sort: {
                        key: 'status',
                        descending:
                          current.sort.key === 'status' ? !current.sort.descending : false,
                      },
                    }))
                  }
                >
                  Estado
                </button>
              </th>
              <th scope="col">Run</th>
              {visible.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={column.numeric ? 'numeric' : ''}
                  aria-sort={
                    preferences.sort.key === column.id
                      ? preferences.sort.descending
                        ? 'descending'
                        : 'ascending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setPreferences((current) => ({
                        ...current,
                        sort: {
                          key: column.id,
                          descending:
                            current.sort.key === column.id ? !current.sort.descending : false,
                        },
                      }))
                    }
                  >
                    {column.label}
                    <span aria-hidden="true">
                      {preferences.sort.key === column.id
                        ? preferences.sort.descending
                          ? ' ↓'
                          : ' ↑'
                        : ''}
                    </span>
                  </button>
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((row) => (
              <tr key={`${row.campaign}-${text(row.runId)}`}>
                <td>
                  <Status value={runStatus(row)} />
                </td>
                <td title={row.campaign}>
                  {row.runId != null ? (
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`Abrir run ${text(row.runId)} de ${row.campaign}`}
                      onClick={() => onSelect({ campaign: row.campaign, run: text(row.runId) })}
                    >
                      {text(row.runId)} ↗
                    </button>
                  ) : (
                    <span title="Campaña sin run">—</span>
                  )}
                </td>
                {visible.map((column) => {
                  const value = column.value(row);
                  return (
                    <td key={column.id} className={column.numeric ? 'numeric' : ''}>
                      <div className="runs-cell" title={text(value)}>
                        {column.render ? column.render(value, row) : text(value)}
                      </div>
                    </td>
                  );
                })}
                <td>
                  {row.runId != null && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      title="Ver configuración"
                      aria-label={`Ver configuración de run ${text(row.runId)} de ${row.campaign}`}
                      onClick={() =>
                        onConfiguration({ campaign: row.campaign, run: text(row.runId) })
                      }
                    >
                      ⚙
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onDuplicate({ ...row.config, baseline: row.baseline ?? row.config.baseline })
                    }
                  >
                    {row.runId == null ? 'Ejecutar' : 'Duplicar'}
                  </Button>
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr>
                <td colSpan={visible.length + 3} className="empty">
                  Sin ejecuciones
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="runs-pagination">
        <select
          aria-label="Filas por página"
          value={preferences.pageSize}
          onChange={(event) => {
            const pageSize = preferencesSchema.shape.pageSize.parse(Number(event.target.value));
            setPreferences((current) => ({ ...current, pageSize }));
            setPage(0);
          }}
        >
          <option value={25}>25 filas</option>
          <option value={50}>50 filas</option>
          <option value={100}>100 filas</option>
        </select>
        <span>
          {filtered.length
            ? `${currentPage * preferences.pageSize + 1}–${Math.min((currentPage + 1) * preferences.pageSize, filtered.length)} de ${filtered.length}`
            : '0 registros'}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
          aria-label="Página anterior"
        >
          ←
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage >= maxPage}
          onClick={() => setPage(currentPage + 1)}
          aria-label="Página siguiente"
        >
          →
        </Button>
      </div>
    </section>
  );
}
