import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import * as ui from '@clack/prompts';
import { z } from 'zod';

export const candidateCheckIds = [
  'lint',
  'typecheck',
  'tests',
  'architecture',
  'browser',
  'acceptance',
] as const;
export type CandidateCheck = (typeof candidateCheckIds)[number];

export const configSchema = z
  .object({
    task: z.string().regex(/^[a-z0-9-]+$/),
    harness: z.enum(['codex', 'opencode']).default('codex'),
    model: z.string().min(1).default('gpt-5.6-luna'),
    effort: z.enum(['default', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']).default('high'),
    baseline: z.string().min(1).default('working-tree'),
    repeats: z.number().int().min(1).max(100).default(1),
    concurrency: z.number().int().min(1).max(4).default(1),
    timeoutSeconds: z.number().int().min(10).max(7200).nullable().default(null),
    checkTimeoutSeconds: z.number().int().min(5).max(1800).default(180),
    maxSteps: z.number().int().min(1).max(500).default(60),
    selfVerify: z.boolean().default(true),
    browserSkill: z.boolean().default(true),
    skills: z
      .array(z.string().regex(/^[a-z0-9-]+$/))
      .default(['hoteles-domain-modeling', 'hoteles-hexagonal', 'hoteles-testing']),
    skillLanguage: z.enum(['en', 'es']).default('en'),
    skillLanguages: z.record(z.string().regex(/^[a-z0-9-]+$/), z.enum(['en', 'es'])).default({}),
    candidatePrompt: z.string().default('evals/coding/prompts/candidate.md'),
    promptFile: z.string().min(1).nullable().default(null),
    taskFile: z.string().min(1).nullable().default(null),
    processSkill: z.string().min(1).nullable().default(null),
    specificationText: z.string().nullable().default(null),
    promptText: z.string().nullable().default(null),
    promptSource: z.string().min(1).nullable().default(null),
    initialSkills: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
    candidateChecks: z.array(z.enum(candidateCheckIds)).nullable().default(null),
    instructions: z.string().nullable().default(null),
    judgeDossier: z.string().min(1).nullable().default(null),
    privateAcceptance: z.string().min(1).nullable().default(null),
    prepareOnly: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.specificationText === null &&
        value.promptText === null &&
        value.promptSource === null &&
        Boolean(value.taskFile) !== Boolean(value.processSkill)) ||
      (value.promptFile &&
        value.taskFile &&
        value.specificationText === null &&
        value.promptText === null)
    )
      context.addIssue({
        code: 'custom',
        path: ['taskFile'],
        message: 'Usa taskFile y processSkill juntos, sin promptFile.',
      });
    if (value.harness === 'codex' && value.effort === 'default')
      context.addIssue({
        code: 'custom',
        path: ['effort'],
        message: 'Codex requiere effort explícito.',
      });
    if (value.harness === 'opencode' && !value.model.includes('/'))
      context.addIssue({
        code: 'custom',
        path: ['model'],
        message: 'OpenCode requiere proveedor/modelo.',
      });
  });
export type EvalConfig = z.infer<typeof configSchema>;
export const taskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    acceptanceCommand: z.array(z.string()).min(1).optional(),
    browser: z.boolean(),
    expectedSkills: z.array(z.string()),
  })
  .passthrough();
export type EvalTask = z.infer<typeof taskSchema>;
export const JUDGE = { harness: 'codex', model: 'gpt-5.6-sol', effort: 'high' } as const;
export function listTasks(project: string): EvalTask[] {
  const folder = resolve(project, 'evals/coding/tasks');
  return readdirSync(folder, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) =>
      taskSchema.parse(JSON.parse(readFileSync(resolve(folder, e.name, 'task.json'), 'utf8'))),
    );
}
const optionNames = [
  'task',
  'harness',
  'model',
  'effort',
  'baseline',
  'repeats',
  'concurrency',
  'timeout-seconds',
  'check-timeout-seconds',
  'max-steps',
  'self-verify',
  'browser-skill',
  'skills',
  'skill-language',
  'candidate-prompt',
  'prompt-file',
  'task-file',
  'process-skill',
  'instructions',
  'judge-dossier',
  'private-acceptance',
  'config',
] as const;
const booleanValue = (value: string) =>
  z
    .enum(['on', 'off'])
    .transform((v) => v === 'on')
    .parse(value);
function cliValue(name: string, value: unknown): unknown {
  const numeric = new Set([
    'repeats',
    'concurrency',
    'timeout-seconds',
    'check-timeout-seconds',
    'max-steps',
  ]);
  return name === 'timeout-seconds' && value === 'off'
    ? null
    : numeric.has(name)
      ? Number(value)
      : name === 'self-verify' || name === 'browser-skill'
        ? booleanValue(String(value))
        : name === 'skills'
          ? String(value).split(',').filter(Boolean)
          : value;
}
export function parseConfig(args: string[]): EvalConfig {
  const { values } = parseArgs({
    args,
    options: {
      ...Object.fromEntries(optionNames.map((name) => [name, { type: 'string' as const }])),
      config: { type: 'string' },
      'prepare-only': { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  const source: unknown = values.config
    ? JSON.parse(readFileSync(String(values.config), 'utf8'))
    : {};
  const fields = z.record(z.string(), z.unknown()).parse(source);
  for (const [name, value] of Object.entries(values)) {
    if (name === 'config') continue;
    const key = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    fields[key] = cliValue(name, value);
  }
  const config = configSchema.parse(fields);
  if (config.harness === 'opencode' && !config.model.includes('/'))
    throw new Error('OpenCode requiere proveedor/modelo, por ejemplo google/gemini-3.8-flash.');
  return config;
}
export const HELP = `Evaluación de agentes de código · buscador convencional
  bun run eval:coding                         CLI interactiva
  bun run eval:coding --list                  Casos disponibles
  bun run eval:coding --task advanced-filters --model gpt-5.6-luna --effort high
  bun run eval:coding --task advanced-filters --self-verify off --browser-skill on
  bun run eval:coding --config evals/coding/example.json --prepare-only

Flags: --task --harness codex|opencode --model --effort --baseline working-tree|REF
--repeats N --concurrency N --timeout-seconds off|N --check-timeout-seconds N
--max-steps N (solo OpenCode; candidato sin timeout por defecto)
--self-verify on|off --browser-skill on|off --skills nombre,nombre (vacío = ninguna)
--skill-language en|es (overrides por skill: skillLanguages en JSON)
--candidate-prompt ARCHIVO --instructions ARCHIVO --config JSON --prepare-only
--prompt-file ARCHIVO (prompt completo exacto; sustituye plantilla, tarea, instructions y self-verify)
--task-file ESPECIFICACION --process-skill SKILL.md (requisitos + skill inyectada; sin self-verify duplicado)
--judge-dossier DIRECTORIO --private-acceptance DIRECTORIO (bundles fuera de Git; solo evaluador)
--reverify-delivery DIRECTORIO_RUN (repite checks y juez; conserva candidato/original)
--rejudge-run DIRECTORIO_RUN --judge-dossier DIRECTORIO (nuevo juicio; conserva el original)
--clean-finished (elimina worktrees y evidencias temporales de campañas terminadas; conserva resultados finales)

Juez fijo: Codex gpt-5.6-sol high. --prepare-only congela entrada y ejecuta baseline,
sin llamadas a modelos. Resultados: .agent-evals/<campaña>/ (ignorado).
`;
export async function interactiveConfig(project: string): Promise<EvalConfig | null> {
  ui.intro('Evaluación de agentes · buscador convencional');
  const cancellation = new Error('Interactive evaluation cancelled');
  const value = await ui
    .group(
      {
        task: () =>
          ui.select({
            message: 'Tarea',
            options: listTasks(project).map((t) => ({ value: t.id, label: t.title })),
          }),
        harness: () =>
          ui.select({
            message: 'Arnés candidato',
            options: [
              { value: 'codex', label: 'Codex' },
              { value: 'opencode', label: 'OpenCode' },
            ],
          }),
        model: ({ results }) =>
          ui.text({
            message: 'Identificador del modelo',
            initialValue: results.harness === 'codex' ? 'gpt-5.6-luna' : 'google/gemini-3.8-flash',
          }),
        effort: ({ results }) =>
          ui.select({
            message: 'Thinking',
            options: [
              ...(results.harness === 'opencode' ? ['default'] : []),
              'minimal',
              'low',
              'medium',
              'high',
              'xhigh',
              'max',
            ].map((value) => ({
              value,
              label: value,
            })),
            initialValue: 'high',
          }),
        baseline: () =>
          ui.text({ message: 'Baseline: working-tree o ref Git', initialValue: 'working-tree' }),
        inputMode: () =>
          ui.select({
            message: 'Entrada del candidato',
            options: [
              { value: 'task-skill', label: 'Especificación + skill de proceso inyectada' },
              { value: 'file', label: 'Prompt completo exacto' },
              { value: 'composed', label: 'Composición anterior' },
            ],
            initialValue: 'task-skill',
          }),
        taskFile: ({ results }) =>
          results.inputMode === 'task-skill'
            ? ui.text({
                message: 'Especificación de requisitos',
                initialValue: `evals/coding/tasks/${results.task}/specification.md`,
              })
            : Promise.resolve(''),
        processSkill: ({ results }) =>
          results.inputMode === 'task-skill'
            ? ui.text({
                message: 'Skill de proceso que se inyectará completa',
                initialValue: '.agents/skills/abordar-tarea/SKILL.md',
              })
            : Promise.resolve(''),
        promptFile: ({ results }) =>
          results.inputMode !== 'file'
            ? Promise.resolve('')
            : ui.text({
                message: 'Archivo de prompt completo (opcional; sustituye toda la composición)',
                defaultValue: '',
              }),
        selfVerify: ({ results }) =>
          results.promptFile || results.taskFile
            ? Promise.resolve(false)
            : ui.confirm({
                message: '¿Pedir explícitamente verify y comprobación de la app?',
                initialValue: true,
              }),
        browserSkill: () =>
          ui.confirm({
            message: '¿Ofrecer la skill de arranque y Playwright?',
            initialValue: true,
          }),
        skills: () =>
          ui.text({
            message: 'Skills del proyecto, separadas por comas',
            initialValue: 'hoteles-domain-modeling,hoteles-hexagonal,hoteles-testing',
          }),
        repeats: () => ui.text({ message: 'Repeticiones', initialValue: '1' }),
        concurrency: () => ui.text({ message: 'Concurrencia', initialValue: '1' }),
        timeoutSeconds: () =>
          ui.text({
            message: 'Segundos máximos por candidato (off = sin timeout)',
            initialValue: 'off',
          }),
        checkTimeoutSeconds: () =>
          ui.text({ message: 'Segundos máximos por check', initialValue: '180' }),
        maxSteps: () =>
          ui.text({
            message: 'Pasos máximos en OpenCode (no aplica a Codex)',
            initialValue: '60',
          }),
        candidatePrompt: ({ results }) =>
          results.promptFile || results.taskFile
            ? Promise.resolve('evals/coding/prompts/candidate.md')
            : ui.text({
                message: 'Prompt base del candidato',
                initialValue: 'evals/coding/prompts/candidate.md',
              }),
        instructions: ({ results }) =>
          results.promptFile || results.taskFile
            ? Promise.resolve('')
            : ui.text({
                message: 'Archivo de instrucciones adicional (opcional)',
                defaultValue: '',
              }),
        prepareOnly: () =>
          ui.confirm({
            message: '¿Solo preparar y verificar baseline, sin modelos?',
            initialValue: false,
          }),
      },
      {
        onCancel: () => {
          ui.cancel('Cancelado.');
          throw cancellation;
        },
      },
    )
    .catch((error: unknown) => {
      if (error === cancellation) return null;
      throw error;
    });
  if (!value?.task) return null;
  return configSchema.parse({
    ...Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'inputMode')),
    taskFile: value.taskFile || null,
    processSkill: value.processSkill || null,
    skills: value.skills.split(',').filter(Boolean),
    repeats: Number(value.repeats),
    concurrency: Number(value.concurrency),
    timeoutSeconds: value.timeoutSeconds === 'off' ? null : Number(value.timeoutSeconds),
    checkTimeoutSeconds: Number(value.checkTimeoutSeconds),
    maxSteps: Number(value.maxSteps),
    instructions: value.instructions || null,
    promptFile: value.promptFile || null,
  });
}
