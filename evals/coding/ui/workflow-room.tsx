import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../apps/web/src/components/ui/button';
import type { AgentConfig, AgentRole, AgentTarget } from '../../../scripts/local-workflow/agents';
import type {
  StepStatus,
  WorkflowAgent,
  WorkflowDefinition,
  WorkflowRun,
} from '../../../scripts/workflow-observer/contracts';
import { placeAgents } from '../../../scripts/workflow-observer/step-agents';
import type { TraceItem } from '../../../scripts/workflow-observer/trace';
import { apiFetch } from './api-fetch';
import { ResultContent } from './result-content';
import { TraceTimeline } from './trace-timeline';

type Catalog = {
  definitions: WorkflowDefinition[];
  specs: { path: string; id: string; title: string; objective: string }[];
  harnesses: string[];
  agentDefaults: AgentConfig;
};
const roleNames: Record<AgentRole, string> = {
  'research-product': 'Investigación de producto',
  'research-verification': 'Investigación técnica',
  planner: 'Planificación',
  implementer: 'Implementación',
  reviewer: 'Review',
  qa: 'QA',
};
const agentNames: Record<string, string> = { ...roleNames, candidate: 'Candidato' };
const efforts = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const;
const modelSuggestions = ['gpt-6-luna', 'gpt-6-sol', 'gpt-6-astra', 'gpt-5.6-luna'];

function AgentFields({
  name,
  target,
  harnesses,
  onChange,
}: {
  name: string;
  target: AgentTarget;
  harnesses: string[];
  onChange: (patch: Partial<AgentTarget>) => void;
}) {
  return (
    <>
      <label>
        Arnés {name}
        <select
          value={target.harness}
          onChange={(event) => onChange({ harness: event.target.value })}
        >
          {harnesses.map((harness) => (
            <option key={harness} value={harness}>
              {harness === 'codex' ? 'Codex' : harness}
            </option>
          ))}
        </select>
      </label>
      <label>
        Modelo {name}
        <input
          list="workflow-model-suggestions"
          value={target.model ?? ''}
          maxLength={100}
          placeholder="Predeterminado del arnés"
          onChange={(event) => onChange({ model: event.target.value.trim() || undefined })}
        />
      </label>
      <label>
        Esfuerzo {name}
        <select
          value={target.reasoningEffort ?? ''}
          onChange={(event) =>
            onChange({
              reasoningEffort: efforts.find((effort) => effort === event.target.value),
            })
          }
        >
          <option value="">Predeterminado del modelo</option>
          {efforts.map((effort) => (
            <option key={effort} value={effort}>
              {effort}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
const labels: Record<StepStatus, string> = {
  pending: 'Pendiente',
  running: 'En curso',
  passed: 'Correcto',
  failed: 'Falló',
  blocked: 'Bloqueado',
  unknown: 'Sin evidencia',
};
const symbols: Record<StepStatus, string> = {
  pending: '○',
  running: '◉',
  passed: '✓',
  failed: '×',
  blocked: '!',
  unknown: '?',
};
function status(status: StepStatus) {
  return (
    <span className={`workflow-status ${status}`}>
      <span aria-hidden="true">{symbols[status]}</span> {labels[status]}
    </span>
  );
}
function elapsed(ms: number | null) {
  if (ms === null) return '—';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
function date(value: string | null) {
  if (!value) return '—';
  const time = new Date(value);
  return Number.isNaN(time.getTime())
    ? '—'
    : time.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}
async function getJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error(String((value as { error?: unknown }).error ?? response.statusText));
  return value as T;
}
async function streamRun(ref: string, signal: AbortSignal, receive: (run: WorkflowRun) => void) {
  const response = await apiFetch(`/api/workflows/${encodeURIComponent(ref)}/stream`, { signal });
  if (!response.ok || !response.body) throw new Error('No se pudo conectar a la traza en vivo.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const data = frame.split('\n').find((line) => line.startsWith('data: '));
      if (!data || frame.startsWith('event: error')) continue;
      try {
        receive(JSON.parse(data.slice(6)) as WorkflowRun);
      } catch {
        /* next frame may be valid */
      }
    }
  }
}

export function WorkflowRoom({
  token,
  initialRef,
  scope = 'local',
}: {
  token: string;
  initialRef?: string | null;
  scope?: 'local' | 'evaluation';
}) {
  const local = scope === 'local';
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selected, setSelected] = useState<string | null>(initialRef ?? null);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [copiedAgent, setCopiedAgent] = useState<string | null>(null);
  const [trace, setTrace] = useState<{
    items: TraceItem[];
    truncated: boolean;
    before: number | null;
  } | null>(null);
  const [older, setOlder] = useState<{ items: TraceItem[]; before: number | null } | null>(null);
  const [artifact, setArtifact] = useState<{ label: string; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [specPath, setSpecPath] = useState('');
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    default: { harness: 'codex' },
    roles: {},
  });
  const agentSettingsEdited = useRef(false);
  const [mode, setMode] = useState<'normal' | 'ralph'>('normal');
  const [planReview, setPlanReview] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');
  const [showLaunch, setShowLaunch] = useState(false);
  useEffect(() => {
    if (!local) return;
    void getJson<Catalog>('/api/workflows/catalog')
      .then((value) => {
        setCatalog(value);
        setSpecPath((current) => current || value.specs[0]?.path || '');
        if (!agentSettingsEdited.current) setAgentConfig(value.agentDefaults);
      })
      .catch((failure) => setError(String(failure)));
    const refresh = () =>
      void getJson<WorkflowRun[]>('/api/workflows?source=local')
        .then(setRuns)
        .catch((failure) => setError(String(failure)));
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [local]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setRun(null);
    setAgentId(null);
    setCopiedAgent(null);
    setTrace(null);
    setOlder(null);
    setArtifact(null);
    const receive = (value: WorkflowRun) => setRun(value);
    const refresh = () =>
      void getJson<WorkflowRun>(`/api/workflows/${encodeURIComponent(selected)}`)
        .then(receive)
        .catch((failure) => setError(String(failure)));
    refresh();
    void streamRun(selected, controller.signal, receive).catch((failure) => {
      if (!controller.signal.aborted) setError(`${String(failure)} Actualizando por intervalos.`);
    });
    const timer = setInterval(refresh, 5000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [selected]);
  useEffect(() => {
    if (!selected || !agentId) return;
    setTrace(null);
    setOlder(null);
    const refresh = () =>
      void getJson<{ items: TraceItem[]; truncated: boolean; before: number | null }>(
        `/api/workflows/${encodeURIComponent(selected)}/agents/${agentId}/trace`,
      )
        .then(setTrace)
        .catch((failure) => setError(String(failure)));
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, [selected, agentId]);
  const visible = useMemo(
    () =>
      runs.filter((item) =>
        `${item.title} ${item.runId}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [runs, query],
  );
  const selectedAgent = run?.agents.find((item) => item.id === agentId);
  const traceItems = [...(older?.items ?? []), ...(trace?.items ?? [])].filter(
    (item, index, items) => items.findIndex((other) => other.index === item.index) === index,
  );
  const olderCursor = older === null ? trace?.before : older.before;
  const placedAgents = run ? placeAgents(run) : null;
  function agentRows(agents: WorkflowAgent[]) {
    return (
      <div className="workflow-step-agents">
        {agents.map((agent, index) => {
          const name = agentNames[agent.role] ?? agent.role;
          const repeated = agents.filter((item) => item.role === agent.role).length > 1;
          const position = agents
            .slice(0, index + 1)
            .filter((item) => item.role === agent.role).length;
          return (
            <div key={agent.id} className="workflow-step-agent">
              <div className="workflow-step-agent-info">
                <strong>{repeated ? `${name} ${position}` : name}</strong>
                {status(agent.status)}
                <small>
                  {agent.harness} · {agent.model ?? 'modelo por defecto'} ·{' '}
                  {elapsed(agent.durationMs)}
                  {agent.role === 'qa' ? ' de modelo' : ''}
                </small>
              </div>
              <div className="workflow-agent-actions">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!agent.traceAvailable}
                  onClick={() => {
                    setAgentId(agent.id);
                    setArtifact(null);
                  }}
                >
                  {agent.traceAvailable ? 'Ver traza en vivo' : 'Traza no conservada'}
                </Button>
                {agent.output && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setArtifact({ label: `${name} · resultado`, text: agent.output ?? '' });
                      setAgentId(null);
                    }}
                  >
                    Ver resultado
                  </Button>
                )}
                {agent.resumeCommand && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(agent.resumeCommand ?? '')
                        .then(() => setCopiedAgent(agent.id))
                        .catch((failure) => setError(`No se pudo copiar: ${String(failure)}`))
                    }
                  >
                    {copiedAgent === agent.id ? 'Comando copiado' : 'Copiar comando para reabrir'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  function updateDefault(patch: Partial<AgentTarget>) {
    agentSettingsEdited.current = true;
    setAgentConfig((current) => ({
      ...current,
      default: { ...current.default, ...patch },
    }));
  }
  function updateRole(role: AgentRole, patch: Partial<AgentTarget>) {
    agentSettingsEdited.current = true;
    setAgentConfig((current) => ({
      ...current,
      roles: {
        ...current.roles,
        [role]: { ...(current.roles[role] ?? current.default), ...patch },
      },
    }));
  }
  function customizeRole(role: AgentRole, enabled: boolean) {
    agentSettingsEdited.current = true;
    setAgentConfig((current) => {
      const roles = { ...current.roles };
      if (enabled) roles[role] = { ...current.default };
      else delete roles[role];
      return { ...current, roles };
    });
  }
  async function loadOlder() {
    if (!selected || !agentId || !olderCursor) return;
    try {
      const page = await getJson<{ items: TraceItem[]; before: number | null }>(
        `/api/workflows/${encodeURIComponent(selected)}/agents/${agentId}/trace?before=${olderCursor}`,
      );
      setOlder((current) => ({
        items: [...page.items, ...(current?.items ?? [])],
        before: page.before,
      }));
    } catch (failure) {
      setError(String(failure));
    }
  }
  async function launch() {
    if (!specPath) return;
    setLaunching(true);
    setError('');
    try {
      const response = await apiFetch('/api/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-lab-token': token },
        body: JSON.stringify({ definitionId: 'delivery', specPath, agentConfig, mode, planReview }),
      });
      const value = (await response.json()) as { ref?: string; error?: string };
      if (!response.ok || !value.ref) throw new Error(value.error ?? 'No se pudo iniciar.');
      setSelected(value.ref);
      setShowLaunch(false);
      setRuns(await getJson<WorkflowRun[]>('/api/workflows?source=local'));
    } catch (failure) {
      setError(String(failure));
    } finally {
      setLaunching(false);
    }
  }
  async function openArtifact(id: string, label: string) {
    if (!selected) return;
    try {
      const response = await apiFetch(
        `/api/workflows/${encodeURIComponent(selected)}/artifacts/${id}`,
      );
      if (!response.ok) throw new Error(((await response.json()) as { error: string }).error);
      setArtifact({ label, text: await response.text() });
    } catch (failure) {
      setError(String(failure));
    }
  }
  async function approvePlan() {
    if (!selected) return;
    setLaunching(true);
    setError('');
    try {
      const response = await apiFetch(
        `/api/workflows/${encodeURIComponent(selected)}/approve-plan`,
        { method: 'POST', headers: { 'x-lab-token': token } },
      );
      const value = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(value.error ?? 'No se pudo reanudar.');
      setRun(await getJson<WorkflowRun>(`/api/workflows/${encodeURIComponent(selected)}`));
    } catch (failure) {
      setError(String(failure));
    } finally {
      setLaunching(false);
    }
  }
  return (
    <div className={`workflow-room ${local ? '' : 'evaluation-trace'}`}>
      <div className="workflow-toolbar">
        <div>
          <h2>{local ? 'Sala de control' : 'Recorrido de la evaluación'}</h2>
          <p>
            {local
              ? 'Workflows normales: fases, agentes y evidencias en tiempo real.'
              : 'Fases, agentes, checks y trazas de esta ejecución evaluada.'}
          </p>
        </div>
        {local && (
          <Button onClick={() => setShowLaunch((value) => !value)}>
            {showLaunch ? 'Cerrar' : '＋ Lanzar workflow'}
          </Button>
        )}
      </div>
      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>
            Cerrar
          </button>
        </div>
      )}
      {local && showLaunch && (
        <section className="workflow-launch" aria-label="Lanzar workflow">
          <div className="workflow-launch-intro">
            <strong>Nuevo workflow local</strong>
            <span>Trabaja en un snapshot aislado. No integra ni publica cambios.</span>
          </div>
          <label>
            Tarea{' '}
            <select value={specPath} onChange={(event) => setSpecPath(event.target.value)}>
              {catalog?.specs.map((spec) => (
                <option key={spec.path} value={spec.path}>
                  {spec.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Implementación{' '}
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as 'normal' | 'ralph')}
            >
              <option value="normal">Plan completo</option>
              <option value="ralph">Por subtareas</option>
            </select>
          </label>
          <div className="workflow-agent-settings">
            <div className="workflow-agent-heading">
              <strong>Agentes del workflow</strong>
              <span>
                El modelo y esfuerzo principales se aplican salvo donde personalices una fase. Solo
                Codex tiene adaptador instalado por ahora; los modelos sugeridos dependen de tu
                acceso.
              </span>
            </div>
            <datalist id="workflow-model-suggestions">
              {modelSuggestions.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <div className="workflow-agent-fields">
              <AgentFields
                name="principal"
                target={agentConfig.default}
                harnesses={catalog?.harnesses ?? [agentConfig.default.harness]}
                onChange={updateDefault}
              />
            </div>
            <details className="workflow-agent-overrides">
              <summary>Personalizar por fase</summary>
              <div className="workflow-agent-roles">
                {(Object.keys(roleNames) as AgentRole[]).map((role) => {
                  const target = agentConfig.roles[role];
                  return (
                    <section key={role}>
                      <label className="workflow-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(target)}
                          onChange={(event) => customizeRole(role, event.target.checked)}
                        />
                        Personalizar {roleNames[role]}
                      </label>
                      {target && (
                        <div className="workflow-agent-fields">
                          <AgentFields
                            name={`de ${roleNames[role]}`}
                            target={target}
                            harnesses={catalog?.harnesses ?? [target.harness]}
                            onChange={(patch) => updateRole(role, patch)}
                          />
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </details>
          </div>
          <label className="workflow-checkbox">
            <input
              type="checkbox"
              checked={planReview}
              onChange={(event) => setPlanReview(event.target.checked)}
            />{' '}
            Parar para aprobar el plan
          </label>
          <Button disabled={launching || !specPath} onClick={() => void launch()}>
            {launching ? 'Preparando…' : 'Iniciar y observar →'}
          </Button>
        </section>
      )}
      <div className={`workflow-columns ${local ? '' : 'detail-only'}`}>
        {local && (
          <aside className="workflow-list">
            <div className="workflow-filter">
              <input
                aria-label="Buscar workflows"
                placeholder="Buscar tarea o run"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="workflow-list-items">
              {visible.map((item) => (
                <button
                  type="button"
                  key={item.ref}
                  className={`workflow-list-item ${selected === item.ref ? 'selected' : ''}`}
                  onClick={() => setSelected(item.ref)}
                >
                  <span className="workflow-list-top">
                    <strong>{item.title}</strong>
                    {status(item.status)}
                  </span>
                  <small>
                    Workflow · {date(item.startedAt)}
                    {item.score !== null ? ` · ${item.score.toFixed(1)}/10` : ''}
                  </small>
                  <span className="workflow-list-message">{item.message}</span>
                </button>
              ))}
              {!visible.length && (
                <p className="workflow-empty">No hay ejecuciones para este filtro.</p>
              )}
            </div>
          </aside>
        )}
        <section className="workflow-detail" aria-label="Detalle del workflow">
          {!selected ? (
            <div className="workflow-empty-state">
              <h2>Elige una ejecución</h2>
              <p>Verás sus fases, agentes, checks, feedback y trazas conforme avanzan.</p>
            </div>
          ) : !run ? (
            <div role="status" className="workflow-empty-state">
              Cargando ejecución…
            </div>
          ) : (
            <>
              <div className="workflow-detail-head">
                <div>
                  <span className="workflow-eyebrow">
                    {run.source === 'evaluation' ? 'Evaluación' : 'Workflow local'} ·{' '}
                    {run.definitionId}
                  </span>
                  <h2>{run.title}</h2>
                  <small>{run.runId}</small>
                </div>
                {status(run.status)}
              </div>
              <p className="workflow-message">{run.message}</p>
              {run.source === 'local' && run.rawStatus === 'waiting-plan' && (
                <Button disabled={launching} onClick={() => void approvePlan()}>
                  {launching ? 'Reanudando…' : 'Aprobar este plan y continuar →'}
                </Button>
              )}
              <div className="workflow-facts">
                <span>
                  <strong>{run.agents.length}</strong> agentes
                </span>
                <span>
                  <strong>
                    {run.checks.filter((item) => item.status === 'passed').length}/
                    {run.checks.length}
                  </strong>{' '}
                  checks registrados
                </span>
                <span>
                  <strong>{run.round ?? '—'}</strong> ronda
                </span>
                {run.score !== null && (
                  <span>
                    <strong>{run.score.toFixed(1)}/10</strong> nota
                  </span>
                )}
              </div>
              <section className="workflow-section">
                <h3>Recorrido</h3>
                <ol className="workflow-timeline">
                  {run.steps.map((step) => (
                    <li key={step.id} className={`step-${step.status}`}>
                      <span className="workflow-step-icon">{symbols[step.status]}</span>
                      <div>
                        <div className="workflow-step-head">
                          <strong>{step.title}</strong>
                          {status(step.status)}
                          <time>{date(step.at)}</time>
                        </div>
                        <p>{step.message}</p>
                        {placedAgents?.byStep.get(step.id)?.length
                          ? agentRows(placedAgents.byStep.get(step.id) ?? [])
                          : null}
                      </div>
                    </li>
                  ))}
                  {placedAgents?.unplaced.length ? (
                    <li className="step-unknown">
                      <span className="workflow-step-icon">?</span>
                      <div>
                        <div className="workflow-step-head">
                          <strong>Sin fase identificada</strong>
                          {status('unknown')}
                        </div>
                        <p>No hay evidencia suficiente para asociar estas sesiones a un paso.</p>
                        {agentRows(placedAgents.unplaced)}
                      </div>
                    </li>
                  ) : null}
                </ol>
              </section>
              <section className="workflow-section">
                <h3>Checks</h3>
                {run.checks.length ? (
                  <div className="workflow-checks">
                    {run.checks.map((check, index) => (
                      <div key={`${check.group}/${check.id}/${index}`}>
                        <span>
                          {status(check.status)} <strong>{check.id}</strong>
                          <small>{check.group}</small>
                        </span>
                        <span>{elapsed(check.durationMs)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="workflow-empty">
                    Todavía no hay checks. Sin evidencia no se marca nada en verde.
                  </p>
                )}
              </section>
              <section className="workflow-section">
                <h3>Feedback y decisiones</h3>
                {run.handoffs.length ? (
                  run.handoffs.map((handoff) => (
                    <details className="workflow-handoff" key={handoff.id}>
                      <summary>
                        <span>{handoff.kind}</span>
                        <strong>{handoff.title}</strong>
                      </summary>
                      <ResultContent text={handoff.content} plain="code" />
                    </details>
                  ))
                ) : (
                  <p className="workflow-empty">No hay feedback registrado.</p>
                )}
              </section>
              <section className="workflow-section">
                <h3>Artefactos</h3>
                <div className="workflow-artifacts">
                  {run.artifacts
                    .filter((item) => item.available)
                    .map((item) => (
                      <Button
                        key={item.id}
                        size="sm"
                        variant="outline"
                        onClick={() => void openArtifact(item.id, item.label)}
                      >
                        {item.label}
                      </Button>
                    ))}
                </div>
              </section>
            </>
          )}
        </section>
      </div>
      {agentId && (
        <div className="workflow-overlay">
          <button
            type="button"
            className="workflow-backdrop"
            aria-label="Cerrar traza"
            onClick={() => setAgentId(null)}
          />
          <section
            className="workflow-trace-panel"
            role="dialog"
            aria-label="Traza del agente"
            aria-modal="true"
          >
            <div className="workflow-trace-head">
              <div>
                <span className="workflow-eyebrow">Traza del agente</span>
                <h2>
                  {selectedAgent
                    ? (agentNames[selectedAgent.role] ?? selectedAgent.role)
                    : 'Agente'}
                </h2>
                <small>{selectedAgent?.model ?? 'Modelo no registrado'}</small>
              </div>
              <Button variant="outline" onClick={() => setAgentId(null)}>
                Cerrar
              </Button>
            </div>
            {selectedAgent?.sessionId && (
              <p className="workflow-session-id">
                Sesión: {selectedAgent.sessionId}
                {selectedAgent.resumeCommand ? ' · Reanudable en Codex CLI' : ' · No reanudable'}
              </p>
            )}
            {olderCursor && (
              <p className="workflow-truncated">
                Hay eventos anteriores.{' '}
                <Button size="sm" variant="outline" onClick={() => void loadOlder()}>
                  Cargar anteriores
                </Button>
              </p>
            )}
            <TraceTimeline items={traceItems} loading={!trace} />
          </section>
        </div>
      )}
      {artifact && (
        <div className="workflow-overlay">
          <button
            type="button"
            className="workflow-backdrop"
            aria-label="Cerrar artefacto"
            onClick={() => setArtifact(null)}
          />
          <section
            className="workflow-trace-panel"
            role="dialog"
            aria-label={artifact.label}
            aria-modal="true"
          >
            <div className="workflow-trace-head">
              <h2>{artifact.label}</h2>
              <Button variant="outline" onClick={() => setArtifact(null)}>
                Cerrar
              </Button>
            </div>
            <ResultContent text={artifact.text} plain="code" />
          </section>
        </div>
      )}
    </div>
  );
}
