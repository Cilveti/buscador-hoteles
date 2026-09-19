import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';
import { Button } from '../../../apps/web/src/components/ui/button';
import { Input } from '../../../apps/web/src/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '../../../apps/web/src/components/ui/sheet';
import type { LabCatalog } from '../../../scripts/coding-eval-ui/api';
import { apiFetch } from './api-fetch';
import { Field, Picker, SkillsPicker } from './controls';

const strings = (value: unknown) => z.array(z.string()).safeParse(value).data ?? [];
const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const sourceSchema = z.object({ path: z.string(), content: z.string() });
const defaults = ['hoteles-domain-modeling', 'hoteles-hexagonal', 'hoteles-testing'];
type Draft = Record<string, unknown>;
type Bootstrap = { catalog: LabCatalog; tasks: { id: string; title: string }[]; example: Draft };

async function readSource(path: string, language = 'en') {
  const response = await apiFetch(
    `/api/sources?path=${encodeURIComponent(path)}&language=${language}`,
  );
  if (!response.ok) throw new Error('No se pudo cargar la fuente seleccionada.');
  return sourceSchema.parse(await response.json()).content;
}

function SourceEditor({
  title,
  readOnly = false,
  language = 'en',
  source,
  value,
  onValue,
  onHydrate,
  onRestore,
  children,
}: {
  title: string;
  readOnly?: boolean;
  language?: string;
  source: string;
  value: unknown;
  onValue: (value: string) => void;
  onHydrate: (value: string, source: string) => void;
  onRestore: () => void;
  children: ReactNode;
}) {
  const [error, setError] = useState('');
  const [original, setOriginal] = useState<{ path: string; content: string } | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setOriginal(null);
    setError('');
    if (readOnly || !source) return;
    let active = true;
    void readSource(source, language)
      .then((content) => {
        if (active) setOriginal({ path: source, content });
      })
      .catch((failure) => {
        if (active) setError(String(failure));
      });
    return () => {
      active = false;
    };
  }, [source, language, readOnly]);
  useEffect(() => {
    if (!readOnly && typeof value !== 'string' && original?.path === source)
      onHydrate(original.content, source);
  }, [value, original, source, onHydrate, readOnly]);
  const ready = typeof value === 'string';
  const modified = ready && original?.path === source && value !== original.content;
  const editor = (
    <textarea
      className="source-text"
      aria-label={title}
      spellCheck={false}
      disabled={readOnly || (!ready && !!source)}
      value={text(value)}
      onChange={(event) => onValue(event.target.value)}
      placeholder={
        readOnly
          ? 'Texto no conservado en esta ejecución'
          : source && !ready
            ? 'Cargando…'
            : 'Escribe aquí…'
      }
    />
  );
  return (
    <section className="source-editor">
      <div className="section-heading">
        <h2>{title}</h2>
        {modified && <span className="edited">Modificado</span>}
        <div className="actions">
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!source || original === null}
              onClick={onRestore}
            >
              Restaurar fuente
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
            Ampliar
          </Button>
        </div>
      </div>
      <fieldset className="composer-fields" disabled={readOnly}>
        {children}
      </fieldset>
      {error && (
        <div className="source-error" role="alert">
          {error}
          <Button type="button" variant="ghost" onClick={() => onValue(text(value))}>
            Editar manualmente
          </Button>
        </div>
      )}
      {!expanded && editor}
      <div className="editor-meta">
        <span>
          {ready
            ? `${text(value).length.toLocaleString('es-ES')} caracteres`
            : readOnly
              ? 'No conservado'
              : 'Cargando fuente'}
        </span>
        <span>{source ? source : 'Texto propio'}</span>
      </div>
      <Sheet open={expanded} onOpenChange={setExpanded}>
        <SheetContent className="source-sheet" aria-describedby={undefined}>
          <SheetTitle>{title}</SheetTitle>
          {expanded && editor}
        </SheetContent>
      </Sheet>
    </section>
  );
}

export function Composer({
  readOnly = false,
  bootstrap,
  recipes,
  draft,
  onDraft,
  name,
  onName,
  busy,
  running,
  onSave,
  onRun,
  onCheck,
  onLoad,
}: {
  readOnly?: boolean;
  bootstrap: Bootstrap | null;
  recipes: Draft[];
  draft: Draft;
  onDraft: Dispatch<SetStateAction<Draft>>;
  name: string;
  onName: (name: string) => void;
  busy: boolean;
  running: boolean;
  onSave: () => Promise<void>;
  onRun: () => Promise<void>;
  onCheck: () => Promise<void>;
  onLoad: (config: unknown, name?: string) => void;
}) {
  const [library, setLibrary] = useState(false);
  const languageChange = useRef(0);
  const [skillQuery, setSkillQuery] = useState('');
  const [skillPath, setSkillPath] = useState('');
  const [skillContent, setSkillContent] = useState('');
  const catalog = bootstrap?.catalog;
  const language = text(draft.skillLanguage, 'en');
  const overrides =
    z.record(z.string(), z.enum(['en', 'es'])).safeParse(draft.skillLanguages).data ?? {};
  const effectiveLanguage = (name: string) => overrides[name] ?? language;
  const currentTask = text(draft.task);
  const taskFile = text(
    draft.taskFile,
    catalog?.taskFiles.find((file) => file.taskId === currentTask)?.path ?? '',
  );
  const promptSource =
    text(draft.processSkill) ||
    text(draft.promptSource) ||
    (draft.promptText == null
      ? text(draft.promptFile, text(draft.candidatePrompt, 'evals/coding/prompts/candidate.md'))
      : '');
  const processName = catalog?.skills.find((skill) => skill.path === promptSource)?.name;
  const processLanguage = processName ? effectiveLanguage(processName) : language;
  async function changeLanguages(nextLanguage: string, nextOverrides: Record<string, string>) {
    const sequence = ++languageChange.current;
    const oldSource = promptSource;
    onDraft((current) => ({
      ...current,
      skillLanguage: nextLanguage,
      skillLanguages: nextOverrides,
    }));
    const oldText = oldSource
      ? await readSource(oldSource, processLanguage).catch(() => null)
      : null;
    if (sequence !== languageChange.current) return;
    onDraft((current) => ({
      ...current,
      promptText:
        current.promptText === oldText &&
        (text(current.processSkill) || text(current.promptSource)) === oldSource
          ? null
          : current.promptText,
    }));
  }

  const available = [
    ...new Set([
      ...strings(draft.skills ?? defaults),
      ...(draft.browserSkill !== false ? ['hoteles-verificar-buscador'] : []),
    ]),
  ];
  const initial = strings(draft.initialSkills);
  const checks = catalog?.candidateChecks ?? [];
  const selectedChecks =
    draft.candidateChecks == null
      ? checks.map((check) => check.id)
      : strings(draft.candidateChecks);
  const ready = typeof draft.specificationText === 'string' && typeof draft.promptText === 'string';
  function update(key: string, value: unknown) {
    if (!readOnly) onDraft((current) => ({ ...current, [key]: value }));
  }
  function sourceValue(
    key: 'specificationText' | 'promptText',
    value: string,
    expectedSource?: string,
  ) {
    if (readOnly) return;
    onDraft((current) => {
      const currentSource =
        key === 'specificationText'
          ? text(
              current.taskFile,
              catalog?.taskFiles.find((file) => file.taskId === current.task)?.path ?? '',
            )
          : text(current.processSkill) ||
            text(current.promptSource) ||
            (current.promptText == null
              ? text(
                  current.promptFile,
                  text(current.candidatePrompt, 'evals/coding/prompts/candidate.md'),
                )
              : '');
      if (
        expectedSource !== undefined &&
        (typeof current[key] === 'string' || currentSource !== expectedSource)
      )
        return current;
      return {
        ...current,
        [key]: value,
        ...(key === 'specificationText' && !current.taskFile
          ? { taskFile: currentSource || null }
          : {}),
        ...(key === 'promptText' && !current.processSkill && !current.promptSource
          ? {
              promptSource: currentSource || null,
              candidatePrompt: 'evals/coding/prompts/candidate.md',
            }
          : {}),
      };
    });
  }
  function setAvailable(value: string[]) {
    onDraft((current) => ({
      ...current,
      skills: value.filter((name) => name !== 'hoteles-verificar-buscador'),
      browserSkill: value.includes('hoteles-verificar-buscador'),
    }));
  }
  function selectTask(task: string) {
    const source = catalog?.taskFiles.find((file) => file.taskId === task)?.path ?? '';
    onDraft((current) => ({
      ...current,
      task,
      taskFile: source || null,
      specificationText: source ? null : '',
      privateAcceptance: null,
      judgeDossier: null,
    }));
  }
  function selectPrompt(path: string) {
    const isSkill = catalog?.skills.some((skill) => skill.path === path);
    onDraft((current) => ({
      ...current,
      processSkill: isSkill ? path : null,
      promptSource: isSkill ? null : path || null,
      promptFile: null,
      candidatePrompt: 'evals/coding/prompts/candidate.md',
      promptText: path ? null : '',
    }));
  }
  useEffect(() => {
    setSkillContent('');
    if (!skillPath) return;
    let active = true;
    void readSource(
      skillPath,
      effectiveLanguage(catalog?.skills.find((skill) => skill.path === skillPath)?.name ?? ''),
    )
      .then((value) => {
        if (active) setSkillContent(value);
      })
      .catch((failure) => {
        if (active) setSkillContent(String(failure));
      });
    return () => {
      active = false;
    };
  }, [skillPath, language, draft.skillLanguages, catalog]);
  function openLibrary() {
    setLibrary(true);
    setSkillPath(catalog?.skills[0]?.path ?? '');
  }
  const currentSkill = catalog?.skills.find((skill) => skill.path === skillPath);
  return (
    <form
      className={`recipe-composer${readOnly ? ' is-readonly' : ''}`}
      aria-label={readOnly ? 'Configuración de la run' : 'Configurar evaluación'}
      onSubmit={(event) => {
        event.preventDefault();
        if (!readOnly && ready) void onRun();
      }}
    >
      {!readOnly && (
        <div className="recipe-topbar">
          <Field title="Receta">
            <select
              value={recipes.some((recipe) => recipe.name === name) ? name : ''}
              onChange={(event) => {
                const recipe = recipes.find((item) => item.name === event.target.value);
                onLoad(
                  recipe?.config ?? bootstrap?.example,
                  recipe ? text(recipe.name) : undefined,
                );
              }}
            >
              <option value="">Nueva receta</option>
              {recipes.map((recipe) => (
                <option value={text(recipe.name)} key={text(recipe.name)}>
                  {text(recipe.name)}
                </option>
              ))}
            </select>
          </Field>
          <Field title="Nombre">
            <Input
              required
              pattern="[a-z0-9][a-z0-9-]{0,63}"
              value={name}
              onChange={(event) => onName(event.target.value)}
            />
          </Field>
          <div className="actions">
            <Button type="button" variant="outline" onClick={openLibrary}>
              Todas las skills
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !ready}
              onClick={() => void onSave()}
            >
              Guardar receta
            </Button>
            <Button type="submit" disabled={busy || running || !ready}>
              {busy ? 'Iniciando…' : running ? 'Ejecución en curso' : '▶ Ejecutar evaluación'}
            </Button>
          </div>
        </div>
      )}
      <fieldset className="composer-fields" disabled={readOnly}>
        <section className="compact-settings">
          <Field title="Idioma de las skills">
            <select
              value={language}
              onChange={(event) => {
                void changeLanguages(event.target.value, overrides);
              }}
            >
              <option value="en">English</option>
              <option value="es">Castellano</option>
            </select>
          </Field>
          <Field title="Arnés">
            <select
              value={text(draft.harness, 'codex')}
              onChange={(event) => {
                const harness = event.target.value;
                onDraft((current) => ({
                  ...current,
                  harness,
                  model:
                    (harness === 'opencode'
                      ? catalog?.models.opencode
                      : catalog?.models.codex)?.[0] ?? '',
                  effort: harness === 'opencode' ? 'default' : 'high',
                }));
              }}
            >
              <option value="codex">Codex</option>
              <option value="opencode">OpenCode</option>
            </select>
          </Field>
          <Picker
            title="Modelo"
            value={text(draft.model, 'gpt-5.6-luna')}
            options={
              (draft.harness === 'opencode'
                ? catalog?.models.opencode
                : catalog?.models.codex
              )?.map((value) => ({ value, label: value })) ?? []
            }
            onChange={(value) => update('model', value)}
          />
          <Field title="Esfuerzo">
            <select
              value={text(draft.effort, 'high')}
              onChange={(event) => update('effort', event.target.value)}
            >
              {['default', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
                .filter((value) => draft.harness === 'opencode' || value !== 'default')
                .map((value) => (
                  <option key={value}>{value}</option>
                ))}
            </select>
          </Field>
          <Field title="Runs">
            <Input
              type="number"
              min={1}
              max={100}
              required
              value={Number(draft.repeats ?? 1)}
              onChange={(event) => update('repeats', Number(event.target.value))}
            />
          </Field>
          <Field title="En paralelo">
            <Input
              type="number"
              min={1}
              max={4}
              required
              value={Number(draft.concurrency ?? 1)}
              onChange={(event) => update('concurrency', Number(event.target.value))}
            />
          </Field>
          <Picker
            title="Código de partida · rama o commit"
            value={text(draft.baseline, 'working-tree')}
            options={catalog?.baselines ?? []}
            onChange={(value) => update('baseline', value)}
          />
        </section>
      </fieldset>
      <div className="source-grid">
        <SourceEditor
          readOnly={readOnly}
          title="Especificación"
          source={taskFile}
          value={draft.specificationText}
          onValue={(value) => sourceValue('specificationText', value)}
          onHydrate={(value, source) => sourceValue('specificationText', value, source)}
          onRestore={() => update('specificationText', null)}
        >
          <Field title="Tarea de referencia">
            <select value={currentTask} onChange={(event) => selectTask(event.target.value)}>
              {readOnly && !bootstrap?.tasks.some((task) => task.id === currentTask) && (
                <option value={currentTask}>{currentTask}</option>
              )}
              {bootstrap?.tasks.map((task) => (
                <option value={task.id} key={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </Field>
        </SourceEditor>
        <SourceEditor
          readOnly={readOnly}
          key={`${promptSource}:${processLanguage}`}
          title="Prompt de proceso"
          language={processLanguage}
          source={promptSource}
          value={draft.promptText}
          onValue={(value) => sourceValue('promptText', value)}
          onHydrate={(value, source) => sourceValue('promptText', value, source)}
          onRestore={() => update('promptText', null)}
        >
          <Picker
            optional
            title="Fuente del prompt"
            value={promptSource}
            options={[
              ...(catalog?.skills.map((skill) => ({ value: skill.path, label: skill.name })) ?? []),
              ...(catalog?.prompts.map((prompt) => ({ value: prompt.path, label: prompt.label })) ??
                []),
            ]}
            onChange={selectPrompt}
          />
        </SourceEditor>
      </div>
      <fieldset className="composer-fields" disabled={readOnly}>
        <div className="harness-grid">
          <section className="harness-card">
            <SkillsPicker
              title="Skills al inicio"
              options={catalog?.skills ?? []}
              value={initial}
              onChange={(value) => update('initialSkills', value)}
            />
            <div className="injection-label">Inyectadas en el prompt inicial</div>
          </section>
          <section className="harness-card">
            <SkillsPicker
              title="Skills disponibles"
              options={catalog?.skills ?? []}
              value={available}
              onChange={setAvailable}
            />
          </section>
          <section className="harness-card check-settings">
            <div className="section-heading">
              <h3>Checks del candidato</h3>
              <span className="count">{selectedChecks.length}</span>
            </div>
            <div className="actions">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => update('candidateChecks', null)}
              >
                Todos
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => update('candidateChecks', [])}
              >
                Ninguno
              </Button>
            </div>
            {checks.map((check) => (
              <div className="check-option" key={check.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedChecks.includes(check.id)}
                    onChange={(event) =>
                      update(
                        'candidateChecks',
                        event.target.checked
                          ? [...selectedChecks, check.id]
                          : selectedChecks.filter((id) => id !== check.id),
                      )
                    }
                  />
                  {check.label}
                </label>
                <details>
                  <summary>Scripts</summary>
                  {check.scripts.map((script) => (
                    <code key={script}>{script}</code>
                  ))}
                </details>
              </div>
            ))}
          </section>
        </div>
        <details className="advanced">
          <summary>Idioma por skill</summary>
          <div className="form-grid three">
            {[...new Set([...available, ...initial, ...(processName ? [processName] : [])])].map(
              (name) => (
                <Field title={name} key={name}>
                  <select
                    value={overrides[name] ?? ''}
                    onChange={(event) => {
                      const next: Record<string, string> = { ...overrides };
                      if (event.target.value) next[name] = event.target.value;
                      else delete next[name];
                      void changeLanguages(language, next);
                    }}
                  >
                    <option value="">Idioma general</option>
                    <option value="en">English</option>
                    <option value="es">Castellano</option>
                  </select>
                </Field>
              ),
            )}
          </div>
        </details>
        <section className="evaluation-settings">
          <h2>Verificación externa</h2>
          <div className="evaluation-grid">
            <Picker
              optional
              title="Tests privados"
              value={text(draft.privateAcceptance)}
              options={
                catalog?.privateAcceptance
                  .filter((bundle) => bundle.taskId === currentTask)
                  .map((bundle) => ({ value: bundle.path, label: bundle.label })) ?? []
              }
              onChange={(value) => update('privateAcceptance', value || null)}
            />
            <Picker
              optional
              title="Dossier del juez"
              value={text(draft.judgeDossier)}
              options={
                catalog?.judgeDossiers
                  .filter((bundle) => bundle.taskId === currentTask)
                  .map((bundle) => ({ value: bundle.path, label: bundle.label })) ?? []
              }
              onChange={(value) => update('judgeDossier', value || null)}
            />
            <div className="judge-model">
              <span>Juez</span>
              <strong>gpt-5.6-sol · high</strong>
            </div>
          </div>
        </section>
        <details className="advanced compact-advanced">
          <summary>Opciones avanzadas</summary>
          <div className="form-grid three">
            <Field title="Límite candidato (segundos)">
              <Input
                type="number"
                min={10}
                max={7200}
                placeholder="Sin límite"
                value={draft.timeoutSeconds == null ? '' : Number(draft.timeoutSeconds)}
                onChange={(event) =>
                  update('timeoutSeconds', event.target.value ? Number(event.target.value) : null)
                }
              />
            </Field>
            <Field title="Límite por check (segundos)">
              <Input
                type="number"
                min={5}
                max={1800}
                value={Number(draft.checkTimeoutSeconds ?? 180)}
                onChange={(event) => update('checkTimeoutSeconds', Number(event.target.value))}
              />
            </Field>
            {draft.harness === 'opencode' && (
              <Field title="Máximo de pasos">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={Number(draft.maxSteps ?? 60)}
                  onChange={(event) => update('maxSteps', Number(event.target.value))}
                />
              </Field>
            )}
          </div>
          <details>
            <summary>Configuración exacta</summary>
            <pre>{JSON.stringify(draft, null, 2)}</pre>
          </details>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || running || !ready}
              onClick={() => void onCheck()}
            >
              Solo comprobar código de partida
            </Button>
          )}
        </details>
      </fieldset>
      <Sheet open={library} onOpenChange={setLibrary}>
        <SheetContent className="skill-library" aria-describedby={undefined}>
          <SheetTitle>Todas las skills</SheetTitle>
          <div className="library-grid">
            <aside>
              <Input
                aria-label="Buscar en todas las skills"
                placeholder="Buscar…"
                value={skillQuery}
                onChange={(event) => setSkillQuery(event.target.value)}
              />
              {catalog?.skills
                .filter((skill) =>
                  `${skill.name} ${skill.description ?? ''}`
                    .toLowerCase()
                    .includes(skillQuery.toLowerCase()),
                )
                .map((skill) => (
                  <button
                    type="button"
                    key={skill.path}
                    className={skillPath === skill.path ? 'selected' : ''}
                    onClick={() => setSkillPath(skill.path)}
                  >
                    {skill.name}
                  </button>
                ))}
            </aside>
            <section>
              {currentSkill && (
                <>
                  <h2>{currentSkill.name}</h2>
                  <div className="actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        selectPrompt(currentSkill.path);
                        setLibrary(false);
                      }}
                    >
                      Usar como prompt
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={initial.includes(currentSkill.name)}
                      onClick={() => update('initialSkills', [...initial, currentSkill.name])}
                    >
                      Inyectar al inicio
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={available.includes(currentSkill.name)}
                      onClick={() => setAvailable([...available, currentSkill.name])}
                    >
                      Hacer disponible
                    </Button>
                  </div>
                </>
              )}
              <pre>{skillContent || 'Cargando…'}</pre>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </form>
  );
}
