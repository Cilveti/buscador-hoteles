import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { Button } from '../../../apps/web/src/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '../../../apps/web/src/components/ui/sheet';
import type { Job, LabCatalog } from '../../../scripts/coding-eval-ui/api';
import { apiFetch } from './api-fetch';
import { Composer } from './composer';
import { RunsTable } from './run-table';
import { WorkflowRoom } from './workflow-room';

const object = z.record(z.string(), z.unknown());
const list = z.array(object);
const bootstrapSchema = z.object({
  token: z.string(),
  tasks: z.array(z.object({ id: z.string(), title: z.string() })),
  example: object,
  catalog: z.custom<LabCatalog>(),
});
const record = (value: unknown) => object.safeParse(value).data ?? {};
const rows = (value: unknown) => list.safeParse(value).data ?? [];
const label = (value: unknown, missing = 'Sin dato') =>
  value === null || value === undefined
    ? missing
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const money = (value: unknown) => (typeof value === 'number' ? `$${value.toFixed(3)}` : '—');
const strings = (value: unknown) => z.array(z.string()).safeParse(value).data ?? [];
const statuses: Record<string, string> = {
  interrupted: 'Interrumpida',
  running: 'En curso',
  starting: 'Iniciando',
  baseline: 'Comprobando base',
  candidate: 'Candidato',
  verification: 'Verificando',
  judge: 'Juez',
  evaluated: 'Evaluada',
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
  baseline_failed: 'Base con errores',
};
function duration(start: unknown, end: unknown) {
  const ms = Date.parse(label(end, new Date().toISOString())) - Date.parse(label(start));
  if (!Number.isFinite(ms)) return '—';
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
function date(value: unknown) {
  const time = new Date(label(value));
  return Number.isNaN(time.getTime())
    ? '—'
    : time.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}
function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
function Status({ value }: { value: unknown }) {
  return (
    <span
      className={`status ${['pass', 'passed', 'true'].includes(label(value)) ? 'good' : ['evaluation_error', 'failed', 'fail', 'incomplete', 'baseline_failed', 'false'].includes(label(value)) ? 'bad' : ['evaluated', 'prepared', 'completed'].includes(label(value)) ? 'info' : ''}`}
    >
      {value === 'running' && <Spinner />}
      {statuses[label(value)] ?? label(value, '—')}
    </span>
  );
}
function JsonBlock({ value }: { value: unknown }) {
  return <pre>{pretty(value ?? null)}</pre>;
}

const criterionTitles: Record<string, string> = {
  functionality: 'Funcionalidad',
  codeQuality: 'Calidad de código',
  testQuality: 'Calidad de tests',
  projectGuidelines: 'Directrices y skills',
  verificationProcess: 'Verificación',
  reportAccuracy: 'Informe final',
};
function Checks({ value }: { value: unknown }) {
  const checks = rows(record(value).checks);
  if (!checks.length) return <p className="muted small">No hay checks registrados.</p>;
  return (
    <div className="check-table">
      <table>
        <thead>
          <tr>
            <th>Comprobación</th>
            <th>Resultado</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={label(check.id)}>
              <td>{label(check.id)}</td>
              <td>
                <Status value={check.status} />
              </td>
              <td>
                {typeof check.durationMs === 'number'
                  ? `${(check.durationMs / 1000).toFixed(1)} s`
                  : 'Sin dato'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Judgment({ value, error, scale = 2 }: { value: unknown; error: unknown; scale?: number }) {
  const judgment = record(value);
  if (!Object.keys(judgment).length)
    return (
      <p className="muted small">{label(error, 'El juez todavía no ha emitido un resultado.')}</p>
    );
  return (
    <>
      <div className="criterion-grid">
        {Object.entries(criterionTitles).map(([key, title]) => {
          const criterion = record(judgment[key]);
          return (
            <div className="criterion" key={key}>
              <div>
                <strong>{title}</strong>
                <span>
                  {typeof criterion.score === 'number'
                    ? `${criterion.score} / ${scale}`
                    : 'Sin dato'}
                </span>
              </div>
              <p>{label(criterion.explanation)}</p>
              {z.array(z.string()).safeParse(criterion.evidence).data?.length ? (
                <details>
                  <summary>Evidencia</summary>
                  <ul>
                    {z
                      .array(z.string())
                      .parse(criterion.evidence)
                      .map((evidence) => (
                        <li key={evidence}>{evidence}</li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>
      {rows(judgment.findings).length > 0 && (
        <section className="findings">
          <h3>Hallazgos</h3>
          {rows(judgment.findings).map((finding) => (
            <article key={`${label(finding.file)}-${label(finding.detail)}`}>
              <Status value={finding.severity} />
              <strong>{label(finding.file)}</strong>
              <p>{label(finding.detail)}</p>
              {finding.deterministicCheck != null && (
                <small>Check: {label(finding.deterministicCheck)}</small>
              )}
            </article>
          ))}
        </section>
      )}
      <details>
        <summary>Datos completos y limitaciones</summary>
        <JsonBlock value={value} />
      </details>
    </>
  );
}

function Lab() {
  const [bootstrap, setBootstrap] = useState<z.infer<typeof bootstrapSchema> | null>(null);
  const [campaigns, setCampaigns] = useState<Record<string, unknown>[]>([]);
  const [recipes, setRecipes] = useState<Record<string, unknown>[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [view, setView] = useState<
    'runs' | 'recipes' | 'configuration' | 'workflows' | 'evaluation-trace'
  >('runs');
  const [evaluationTraceRef, setEvaluationTraceRef] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ campaign: string; run: string } | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [configurationRun, setConfigurationRun] = useState<{
    campaign: string;
    run: string;
  } | null>(null);
  const [configuration, setConfiguration] = useState<Record<string, unknown> | null>(null);
  const [artifact, setArtifact] = useState('');
  const [recipeName, setRecipeName] = useState('nueva-evaluacion');
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<Record<string, unknown> | null>(null);
  const [campaignFilter, setCampaignFilter] = useState('');
  const [clock, setClock] = useState(Date.now());
  async function api(path: string, body?: unknown): Promise<unknown> {
    const response = await apiFetch(
      path,
      body
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Lab-Token': bootstrap?.token ?? '' },
            body: JSON.stringify(body),
          }
        : {},
    );
    const data: unknown = await response.json();
    if (!response.ok) throw new Error(label(record(data).error));
    return data;
  }
  async function refresh() {
    const results = await Promise.all([
      api('/api/campaigns'),
      api('/api/recipes'),
      api('/api/jobs'),
    ]);
    setCampaigns(list.parse(results[0]));
    setRecipes(list.parse(results[1]));
    setJobs(z.custom<Job[]>().parse(results[2]));
  }
  useEffect(() => {
    void api('/api/bootstrap')
      .then((data) => {
        const value = bootstrapSchema.parse(data);
        setBootstrap(value);
        setDraft((current) => (Object.keys(current).length ? current : value.example));
      })
      .catch((failure) => setError(String(failure)));
    void refresh().catch((failure) => setError(String(failure)));
    const timer = setInterval(() => {
      setClock(Date.now());
      void refresh().catch((failure) => setError(String(failure)));
    }, 2500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setDetail(null);
    setArtifact('');
    if (!selected) return;
    let active = true;
    void api(
      `/api/campaigns/${encodeURIComponent(selected.campaign)}/runs/${encodeURIComponent(selected.run)}`,
    )
      .then((data) => {
        if (active) setDetail(object.parse(data));
      })
      .catch((failure) => {
        if (active) setError(String(failure));
      });
    const timer = setInterval(() => {
      void api(
        `/api/campaigns/${encodeURIComponent(selected.campaign)}/runs/${encodeURIComponent(selected.run)}`,
      )
        .then((data) => {
          if (active) setDetail(object.parse(data));
        })
        .catch((failure) => {
          if (active) setError(String(failure));
        });
    }, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected]);
  useEffect(() => {
    if (!jobId) {
      setJobDetail(null);
      return;
    }
    let active = true;
    void api(`/api/jobs/${encodeURIComponent(jobId)}`)
      .then((data) => {
        if (active) setJobDetail(object.parse(data));
      })
      .catch((failure) => {
        if (active) setError(String(failure));
      });
    return () => {
      active = false;
    };
  }, [jobId, clock]);
  useEffect(() => {
    setConfiguration(null);
    if (view !== 'configuration' || !configurationRun) return;
    let active = true;
    const path = `/api/campaigns/${encodeURIComponent(configurationRun.campaign)}/runs/${encodeURIComponent(configurationRun.run)}`;
    async function loadConfiguration() {
      const run = record(await api(path));
      const config = record(run.config);
      const artifacts = strings(run.artifacts);
      async function frozenText(name: string, fallback: unknown) {
        if (!artifacts.includes(name)) return typeof fallback === 'string' ? fallback : null;
        const response = await apiFetch(`${path}/artifacts/${name}`);
        if (!response.ok) throw new Error(`No se pudo cargar el texto guardado: ${name}`);
        return response.text();
      }
      const [specificationText, promptText] = await Promise.all([
        frozenText('specification', config.specificationText),
        frozenText(artifacts.includes('process') ? 'process' : 'processSkill', config.promptText),
      ]);
      if (active)
        setConfiguration({
          ...config,
          baseline: run.baselineCommit ?? config.baseline,
          candidateChecks: record(run.candidateChecks).enabled ?? config.candidateChecks,
          specificationText,
          promptText,
        });
    }
    void loadConfiguration().catch((failure) => {
      if (active) setError(String(failure));
    });
    return () => {
      active = false;
    };
  }, [view, configurationRun]);
  function openConfiguration(selection: { campaign: string; run: string }) {
    setConfiguration(null);
    setConfigurationRun(selection);
    setSelected(null);
    setError('');
    setNotice('');
    setView('configuration');
  }
  function loadRecipe(config: unknown, name = 'nueva-evaluacion') {
    const loaded = record(config);
    // Import a legacy complete prompt intact into the specification editor.
    setDraft(
      loaded.promptFile && loaded.specificationText == null && loaded.promptText == null
        ? {
            ...loaded,
            taskFile: loaded.promptFile,
            specificationText: null,
            promptFile: null,
            processSkill: null,
            promptSource: null,
            promptText: '',
            candidatePrompt: 'evals/coding/prompts/candidate.md',
          }
        : loaded,
    );
    setRecipeName(name);
    setView('recipes');
    setSelected(null);
    setNotice('');
    setError('');
  }
  async function saveAndLaunch(mode?: 'prepare' | 'run') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/api/recipes', { name: recipeName, config: draft });
      if (mode) {
        const job = record(await api('/api/jobs', { name: recipeName, mode }));
        setJobId(label(job.id));
        setView('runs');
      } else setNotice('Receta guardada');
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }
  async function openArtifact(name: string) {
    if (!selected) return;
    setBusy(true);
    setArtifact('');
    try {
      const response = await apiFetch(
        `/api/campaigns/${encodeURIComponent(selected.campaign)}/runs/${encodeURIComponent(selected.run)}/artifacts/${name}`,
      );
      if (!response.ok) throw new Error(label(record(await response.json()).error));
      setArtifact(await response.text());
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
  const activeJob = jobs.find((job) => job.status === 'running');
  const chosenJob = jobs.find((job) => job.id === jobId);
  const flatRuns = campaigns.flatMap((campaign) => {
    const attempts = rows(campaign.runs);
    return (
      attempts.length
        ? attempts
        : [{ id: null, status: campaign.status, startedAt: campaign.startedAt }]
    ).map((run) => ({
      ...run,
      campaign: label(campaign.id),
      config: record(campaign.config),
      baseline: campaign.baselineCommit,
      runId: run.id,
    }));
  });
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <span>H</span>Harness lab
        </div>
        <Button
          variant={view === 'runs' || view === 'evaluation-trace' ? 'secondary' : 'ghost'}
          onClick={() => setView('runs')}
        >
          Evaluaciones{' '}
          <span className="count">{flatRuns.filter((run) => run.runId != null).length}</span>
        </Button>
        <Button
          variant={view === 'workflows' ? 'secondary' : 'ghost'}
          onClick={() => setView('workflows')}
        >
          Workflows
        </Button>
        <Button
          variant={view === 'recipes' ? 'secondary' : 'ghost'}
          onClick={() => setView('recipes')}
        >
          Recetas
        </Button>
        <div className="sidebar-bottom">
          <span className="live-dot" />
          Local
        </div>
      </aside>
      <main>
        <header>
          <h1>
            {view === 'workflows'
              ? 'Workflows'
              : view === 'evaluation-trace'
                ? 'Evaluación · recorrido'
                : view === 'runs'
                  ? 'Evaluaciones'
                  : view === 'configuration'
                    ? `Configuración · Run ${configurationRun?.run}`
                    : 'Configurar evaluación'}
          </h1>
          <div className="actions">
            {view === 'configuration' && (
              <>
                <span className="status info">Solo lectura</span>
                <Button variant="outline" onClick={() => setView('runs')}>
                  Volver a evaluaciones
                </Button>
              </>
            )}
            {view === 'runs' && (
              <Button onClick={() => loadRecipe(bootstrap?.example)}>＋ Nueva evaluación</Button>
            )}
            {view === 'evaluation-trace' && (
              <Button variant="outline" onClick={() => setView('runs')}>
                Volver a evaluaciones
              </Button>
            )}
            {view !== 'workflows' && view !== 'evaluation-trace' && (
              <Button
                variant="outline"
                aria-label="Actualizar evaluaciones"
                onClick={() => void refresh().catch((failure) => setError(String(failure)))}
              >
                ↻ Actualizar
              </Button>
            )}
          </div>
        </header>
        {error && (
          <div role="alert" className="alert">
            <span>{error}</span>
            <Button variant="ghost" onClick={() => setError('')}>
              Cerrar
            </Button>
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
            <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}>
              ×
            </button>
          </div>
        )}
        {activeJob && view !== 'workflows' && view !== 'evaluation-trace' && (
          <button
            type="button"
            className="active-job"
            onClick={() => {
              setJobId(activeJob.id);
              setView('runs');
            }}
          >
            <Spinner />
            <strong>{activeJob.recipe}</strong>
            <span>{statuses[activeJob.phase] ?? 'En curso'}</span>
            <span>{duration(activeJob.startedAt, null)}</span>
            <span className="push-right">Ver progreso →</span>
          </button>
        )}
        {view === 'workflows' ? (
          <WorkflowRoom token={bootstrap?.token ?? ''} />
        ) : view === 'evaluation-trace' ? (
          <WorkflowRoom
            key={evaluationTraceRef}
            token={bootstrap?.token ?? ''}
            scope="evaluation"
            initialRef={evaluationTraceRef}
          />
        ) : view === 'configuration' ? (
          configuration ? (
            <>
              <div className="configuration-origin">{configurationRun?.campaign}</div>
              <Composer
                key={`${configurationRun?.campaign}/${configurationRun?.run}`}
                readOnly
                bootstrap={bootstrap}
                recipes={[]}
                draft={configuration}
                onDraft={() => {}}
                name=""
                onName={() => {}}
                busy={false}
                running={false}
                onSave={async () => {}}
                onRun={async () => {}}
                onCheck={async () => {}}
                onLoad={() => {}}
              />
            </>
          ) : (
            <div role="status">
              <Spinner />
              {error ? 'Configuración no disponible' : 'Cargando configuración…'}
            </div>
          )
        ) : view === 'recipes' ? (
          <Composer
            bootstrap={bootstrap}
            recipes={recipes}
            draft={draft}
            onDraft={setDraft}
            name={recipeName}
            onName={setRecipeName}
            busy={busy}
            running={!!activeJob}
            onSave={() => saveAndLaunch()}
            onRun={() => saveAndLaunch('run')}
            onCheck={() => saveAndLaunch('prepare')}
            onLoad={loadRecipe}
          />
        ) : (
          <>
            {jobs.length > 0 && (
              <div className="job-selector">
                <label htmlFor="job-history">Actividad</label>
                <select
                  id="job-history"
                  value={jobId ?? ''}
                  onChange={(event) => setJobId(event.target.value || null)}
                >
                  <option value="">Seleccionar trabajo</option>
                  {jobs.map((job) => (
                    <option value={job.id} key={job.id}>
                      {date(job.startedAt)} · {job.recipe} ·{' '}
                      {job.mode === 'prepare' ? 'Solo comprobación' : 'Evaluación'} ·{' '}
                      {statuses[job.status] ?? job.status}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {chosenJob && (
              <section className="job-panel" aria-label="Progreso de ejecución">
                <div className="section-heading">
                  <h2>{chosenJob.recipe}</h2>
                  <Status value={chosenJob.status} />
                  <span>{duration(chosenJob.startedAt, chosenJob.finishedAt)}</span>
                  <Button variant="ghost" onClick={() => setJobId(null)}>
                    Cerrar
                  </Button>
                </div>
                <div className="job-progress" role="status">
                  {chosenJob.status === 'running' && <Spinner />}
                  <strong>{statuses[chosenJob.phase] ?? label(chosenJob.phase)}</strong>
                  <span>
                    {chosenJob.completedRuns} / {chosenJob.totalRuns} runs
                  </span>
                </div>
                {chosenJob.mode === 'prepare' && chosenJob.status === 'completed' && (
                  <div className="completion-action">
                    <span>Código de partida comprobado. No se ha ejecutado ningún candidato.</span>
                    <Button onClick={() => loadRecipe(chosenJob.config, chosenJob.recipe)}>
                      Configurar y ejecutar →
                    </Button>
                  </div>
                )}
                {chosenJob.campaignId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCampaignFilter(chosenJob.campaignId ?? '');
                      setJobId(null);
                    }}
                  >
                    Ver resultados de esta campaña
                  </Button>
                )}
                <details open={chosenJob.status === 'failed'}>
                  <summary>Log de ejecución</summary>
                  <pre className="log">{label(jobDetail?.logTail, 'Esperando salida…')}</pre>
                </details>
              </section>
            )}
            <RunsTable
              campaignFilter={campaignFilter}
              campaigns={campaigns}
              onSelect={setSelected}
              onConfiguration={openConfiguration}
              onDuplicate={(config) => loadRecipe(config, 'variante')}
            />
          </>
        )}
      </main>
      {selected && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <SheetContent
            className="detail-panel"
            showCloseButton={false}
            aria-describedby={undefined}
          >
            <div className="detail-heading">
              <SheetTitle>Run {selected.run}</SheetTitle>
              <Button
                variant="outline"
                onClick={() => {
                  setEvaluationTraceRef(`evaluation:${selected.campaign}:${selected.run}`);
                  setSelected(null);
                  setView('evaluation-trace');
                }}
              >
                Ver recorrido
              </Button>
              <Button variant="outline" onClick={() => openConfiguration(selected)}>
                Ver configuración
              </Button>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Cerrar
              </Button>
            </div>
            {!detail ? (
              <div role="status">
                <Spinner />
                Cargando…
              </div>
            ) : (
              <>
                <div className="result-grid">
                  <div>
                    <span>Calidad</span>
                    <strong>
                      {typeof detail.score === 'number'
                        ? `${detail.score.toFixed(1)} / 10`
                        : 'Sin nota'}
                    </strong>
                  </div>
                  <div>
                    <span>Resultado</span>
                    <Status value={detail.outcome ?? detail.passed} />
                  </div>
                  <div>
                    <span>Juez</span>
                    <Status value={detail.judgeTaskVerdict} />
                  </div>
                  <div>
                    <span>Aceptación visible</span>
                    <Status value={detail.taskAcceptancePassed} />
                  </div>
                  <div>
                    <span>Aceptación privada</span>
                    <Status value={detail.privateAcceptancePassed} />
                  </div>
                </div>
                {detail.verificationRevision != null && (
                  <div role="status">Verificación corregida · Resultado original conservado</div>
                )}
                {Array.isArray(detail.evaluationIssues) && detail.evaluationIssues.length > 0 && (
                  <div role="alert">{detail.evaluationIssues.map(String).join(' · ')}</div>
                )}
                <details open>
                  <summary>Checks externos</summary>
                  <Checks value={detail.verification} />
                  {detail.candidateTestVerification != null && (
                    <Checks value={detail.candidateTestVerification} />
                  )}
                  {detail.privateAcceptanceVerification != null && (
                    <Checks value={detail.privateAcceptanceVerification} />
                  )}
                </details>
                <details open>
                  <summary>Juicio y hallazgos</summary>
                  <Judgment
                    value={detail.judgment}
                    error={detail.judgmentError}
                    scale={detail.scoreScale === 10 ? 10 : 2}
                  />
                </details>
                <details>
                  <summary>Skills y compactaciones</summary>
                  <JsonBlock
                    value={{
                      availableSkills: detail.availableSkills,
                      injected: detail.candidatePrompt,
                      ...record(detail.process),
                    }}
                  />
                </details>
                <details>
                  <summary>Configuración</summary>
                  <JsonBlock
                    value={{
                      config: detail.config,
                      baseline: detail.baselineCommit,
                      judgeDossier: detail.judgeDossier,
                      privateAcceptance: detail.privateAcceptance,
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      loadRecipe(
                        { ...record(detail.config), baseline: detail.baselineCommit },
                        'variante',
                      )
                    }
                  >
                    Duplicar evaluación
                  </Button>
                </details>
                <details>
                  <summary>Costes</summary>
                  <JsonBlock value={detail.cost} />
                </details>
                <details>
                  <summary>Artefactos y traza</summary>
                  <div className="actions">
                    {strings(detail.artifacts).map((name) => (
                      <Button
                        disabled={busy}
                        variant="outline"
                        size="sm"
                        key={name}
                        onClick={() => void openArtifact(name)}
                      >
                        {name}
                      </Button>
                    ))}
                  </div>
                  {artifact && <pre>{artifact}</pre>}
                </details>
              </>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Lab />);
