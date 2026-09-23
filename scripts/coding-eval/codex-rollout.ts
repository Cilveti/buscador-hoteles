import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';

const id = z.string().min(1);
const optionalId = id.nullable().optional();
const finiteNumber = z.number().finite();
const tokenCount = z.number().int().nonnegative().safe();
const loosePayload = z.record(z.string(), z.unknown());
const rowSchema = z.object({
  type: z.string(),
  timestamp: z.string().optional(),
  ordinal: z.number().int().optional(),
  payload: loosePayload,
});
const sessionMetaSchema = z.object({
  id,
  parent_thread_id: optionalId,
  cli_version: z.string().optional(),
});
const turnContextSchema = z.object({
  turn_id: id,
  model: z.string().min(1).optional(),
});
const usageSchema = z.object({
  input_tokens: tokenCount,
  cached_input_tokens: tokenCount,
  cache_write_input_tokens: tokenCount.optional().default(0),
  output_tokens: tokenCount,
  reasoning_output_tokens: tokenCount.optional().default(0),
  total_tokens: tokenCount.optional(),
});
const usageRecordSchema = z.object({
  response_id: id,
  thread_id: id,
  turn_id: id,
  usage: usageSchema,
  model: z.string().min(1).optional(),
});
const taskEventSchema = z.object({
  type: z.enum(['task_started', 'task_complete', 'turn_aborted']),
  turn_id: id,
  started_at: finiteNumber.optional(),
  completed_at: finiteNumber.optional(),
  duration_ms: finiteNumber.nonnegative().optional(),
});
const itemCompletedSchema = z.object({
  type: z.literal('item_completed'),
  thread_id: id,
  turn_id: id,
  item: z.object({
    id: z.string().optional(),
    type: z.string(),
    command: z.union([z.string(), z.array(z.string())]).optional(),
    exit_code: z.number().int().nullable().optional(),
  }),
});
const threadSettingsSchema = z.object({
  type: z.literal('thread_settings_applied'),
  thread_id: id,
  thread_settings: z
    .object({
      model: z.string().min(1).optional(),
    })
    .optional(),
});
const compactedSchema = z.object({
  latest_token_usage_record: z
    .object({
      thread_id: id.optional(),
    })
    .optional(),
});

export type Coverage = 'complete' | 'partial' | 'unsupported';
export type ThreadState = 'completed' | 'aborted' | 'incomplete' | 'unknown';
export type TokenUsage = {
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
};
export type HeuristicSignal = {
  observed: boolean;
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  unknownOutcomeCalls: number;
  coverage: 'heuristic';
};
export type ThreadCollaboration = {
  threadId: string;
  parentThreadId: string | null;
  children: string[];
  depth: number;
  cliVersion: string | null;
  models: string[];
  state: ThreadState;
  wallTimeMs: number | null;
  usage: TokenUsage | null;
  usageResponses: number;
  compactions: {
    count: number | null;
    observedCount: number;
    coverage: Coverage;
  };
  signals: {
    browser: HeuristicSignal;
    verify: HeuristicSignal;
  };
  coverage: Coverage;
};
export type CodexCollaboration = {
  schemaVersion: 1;
  source: 'codex-rollout' | 'unavailable';
  coverage: Coverage;
  rootThreadId: string | null;
  cliVersions: string[];
  threads: ThreadCollaboration[];
  totals: {
    threadCount: number;
    subagentCount: number;
    states: Record<ThreadState, number>;
    wallTimeMs: number | null;
    usage: TokenUsage | null;
    usageByModel: { model: string; responses: number; usage: TokenUsage }[];
    uniqueUsageResponses: number;
    duplicateUsageRecords: number;
    conflictingUsageRecords: number;
    excludedUsageRecords: number;
  };
  compactions: {
    root: ThreadCollaboration['compactions'] | null;
    subagents: { threadId: string; compactions: ThreadCollaboration['compactions'] }[];
    observedTotal: number;
  };
  limitations: string[];
};

type ParsedRow = z.infer<typeof rowSchema>;
type ThreadFile = {
  path: string;
  threadId: string;
  parentThreadId: string | null;
  cliVersion: string | null;
  rows: ParsedRow[];
  malformedLines: number;
};

const emptyUsage = (): TokenUsage => ({
  input_tokens: 0,
  cached_input_tokens: 0,
  cache_write_input_tokens: 0,
  output_tokens: 0,
  reasoning_output_tokens: 0,
  total_tokens: 0,
});

function addUsage(target: TokenUsage, source: TokenUsage): void {
  target.input_tokens += source.input_tokens;
  target.cached_input_tokens += source.cached_input_tokens;
  target.cache_write_input_tokens += source.cache_write_input_tokens;
  target.output_tokens += source.output_tokens;
  target.reasoning_output_tokens += source.reasoning_output_tokens;
  target.total_tokens += source.total_tokens;
}

function normalizeUsage(usage: z.infer<typeof usageSchema>): TokenUsage {
  return {
    input_tokens: usage.input_tokens,
    cached_input_tokens: usage.cached_input_tokens,
    cache_write_input_tokens: usage.cache_write_input_tokens,
    output_tokens: usage.output_tokens,
    reasoning_output_tokens: usage.reasoning_output_tokens,
    total_tokens: usage.total_tokens ?? usage.input_tokens + usage.output_tokens,
  };
}

function unsupported(rootThreadId: string | null, reason: string): CodexCollaboration {
  return {
    schemaVersion: 1,
    source: 'unavailable',
    coverage: 'unsupported',
    rootThreadId,
    cliVersions: [],
    threads: [],
    totals: {
      threadCount: 0,
      subagentCount: 0,
      states: { completed: 0, aborted: 0, incomplete: 0, unknown: 0 },
      wallTimeMs: null,
      usage: null,
      usageByModel: [],
      uniqueUsageResponses: 0,
      duplicateUsageRecords: 0,
      conflictingUsageRecords: 0,
      excludedUsageRecords: 0,
    },
    compactions: { root: null, subagents: [], observedTotal: 0 },
    limitations: [reason, 'Prompts, messages, command text and command output are never retained.'],
  };
}

function rolloutFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path);
    }
  };
  visit(root);
  return files.sort();
}

function parseThreadFile(path: string): ThreadFile | null {
  const rows: ParsedRow[] = [];
  let malformedLines = 0;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = rowSchema.safeParse(JSON.parse(line));
      if (parsed.success) rows.push(parsed.data);
      else malformedLines += 1;
    } catch {
      malformedLines += 1;
    }
  }
  const fileName = basename(path, '.jsonl');
  const metadata = rows
    .filter((row) => row.type === 'session_meta')
    .map((row) => sessionMetaSchema.safeParse(row.payload))
    .filter((result) => result.success)
    .map((result) => result.data);
  const canonical = metadata.find((item) => fileName.endsWith(item.id));
  if (!canonical) return null;
  return {
    path,
    threadId: canonical.id,
    parentThreadId: canonical.parent_thread_id ?? null,
    cliVersion: canonical.cli_version ?? null,
    rows,
    malformedLines,
  };
}

function versionCoverage(version: string | null): Coverage {
  if (version === '0.154.0') return 'complete';
  if (version?.startsWith('0.154.0-alpha.')) return 'partial';
  return 'unsupported';
}

function commandText(command: string | string[] | undefined): string {
  if (typeof command === 'string') return command;
  return command?.join(' ') ?? '';
}

function signal(): HeuristicSignal {
  return {
    observed: false,
    calls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    unknownOutcomeCalls: 0,
    coverage: 'heuristic',
  };
}

function observeSignal(target: HeuristicSignal, exitCode: number | null | undefined): void {
  target.observed = true;
  target.calls += 1;
  if (exitCode === 0) target.successfulCalls += 1;
  else if (typeof exitCode === 'number') target.failedCalls += 1;
  else target.unknownOutcomeCalls += 1;
}

const browserCommand = /playwright|test:(?:eval-)?browser|eval:browser|browser\/server/i;
const verifyCommand =
  /\b(?:bun|npm|pnpm)\s+(?:run\s+)?verify\b|scripts[/\\]verification[/\\]verify\.ts/i;

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/**
 * Summarizes the isolated Codex rollout store before it is deleted. The summary deliberately
 * excludes prompt/message contents, tool inputs, command text/output and credential material.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: keeping extraction in this boundary prevents private rollout rows from escaping into durable intermediate structures.
export function collectCodexCollaboration(
  isolatedHome: string,
  rootThreadId: string | null,
): CodexCollaboration {
  if (!rootThreadId) return unsupported(null, 'The CLI did not emit a root thread ID.');
  try {
    const parsedFiles = rolloutFiles(join(isolatedHome, 'sessions'))
      .map(parseThreadFile)
      .filter((file): file is ThreadFile => file !== null);
    const filesByThread = new Map<string, ThreadFile>();
    const duplicateThreadFiles = new Set<string>();
    for (const file of parsedFiles) {
      if (filesByThread.has(file.threadId)) duplicateThreadFiles.add(file.threadId);
      else filesByThread.set(file.threadId, file);
    }
    if (!filesByThread.has(rootThreadId))
      return unsupported(rootThreadId, 'No canonical rollout matches the emitted root thread ID.');

    const connected = new Set([rootThreadId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const file of filesByThread.values()) {
        if (
          !connected.has(file.threadId) &&
          file.parentThreadId !== null &&
          connected.has(file.parentThreadId)
        ) {
          connected.add(file.threadId);
          changed = true;
        }
      }
    }
    const files = [...connected]
      .map((threadId) => filesByThread.get(threadId))
      .filter((file): file is ThreadFile => file !== undefined);
    const turnModels = new Map<string, Set<string>>();
    const threadModels = new Map<string, Set<string>>();
    const turnThreads = new Map<string, Set<string>>();
    const taskEvents = new Map<string, z.infer<typeof taskEventSchema>>();
    const commands = new Map<
      string,
      { threadId: string; command: string; exitCode: number | null | undefined }
    >();
    const usageRows: {
      responseId: string;
      threadId: string;
      turnId: string;
      model: string | null;
      usage: TokenUsage;
    }[] = [];
    let invalidUsageRecords = 0;

    for (const file of files) {
      for (const row of file.rows) {
        if (row.type === 'turn_context') {
          const context = turnContextSchema.safeParse(row.payload);
          if (context.success && context.data.model) {
            const models = turnModels.get(context.data.turn_id) ?? new Set<string>();
            models.add(context.data.model);
            turnModels.set(context.data.turn_id, models);
          }
        }
        if (row.type === 'token_usage_record') {
          const parsed = usageRecordSchema.safeParse(row.payload);
          if (!parsed.success) {
            invalidUsageRecords += 1;
            continue;
          }
          const threads = turnThreads.get(parsed.data.turn_id) ?? new Set<string>();
          threads.add(parsed.data.thread_id);
          turnThreads.set(parsed.data.turn_id, threads);
          usageRows.push({
            responseId: parsed.data.response_id,
            threadId: parsed.data.thread_id,
            turnId: parsed.data.turn_id,
            model: parsed.data.model ?? null,
            usage: normalizeUsage(parsed.data.usage),
          });
        }
        if (row.type !== 'event_msg') continue;
        const settings = threadSettingsSchema.safeParse(row.payload);
        if (settings.success && settings.data.thread_settings?.model) {
          const models = threadModels.get(settings.data.thread_id) ?? new Set<string>();
          models.add(settings.data.thread_settings.model);
          threadModels.set(settings.data.thread_id, models);
        }
        const item = itemCompletedSchema.safeParse(row.payload);
        if (item.success) {
          const threads = turnThreads.get(item.data.turn_id) ?? new Set<string>();
          threads.add(item.data.thread_id);
          turnThreads.set(item.data.turn_id, threads);
          if (item.data.item.type === 'command_execution') {
            const key =
              item.data.item.id ?? `${item.data.thread_id}:${item.data.turn_id}:${row.ordinal}`;
            commands.set(key, {
              threadId: item.data.thread_id,
              command: commandText(item.data.item.command),
              exitCode: item.data.item.exit_code,
            });
          }
        }
        const task = taskEventSchema.safeParse(row.payload);
        if (task.success) taskEvents.set(`${task.data.type}:${task.data.turn_id}`, task.data);
      }
    }

    for (const usage of usageRows) {
      if (usage.model) continue;
      const models = turnModels.get(usage.turnId);
      if (models?.size === 1) usage.model = [...models][0] ?? null;
      if (!usage.model) {
        const modelsForThread = threadModels.get(usage.threadId);
        if (modelsForThread?.size === 1) usage.model = [...modelsForThread][0] ?? null;
      }
    }

    type UsageBucket = {
      rows: typeof usageRows;
      model: string;
      responseId: string;
    };
    const usageBuckets = new Map<string, UsageBucket>();
    let excludedUsageRecords = invalidUsageRecords;
    for (const row of usageRows) {
      if (!row.model) {
        excludedUsageRecords += 1;
        continue;
      }
      const key = `${row.responseId}\u0000${row.model}`;
      const bucket = usageBuckets.get(key) ?? {
        rows: [],
        model: row.model,
        responseId: row.responseId,
      };
      bucket.rows.push(row);
      usageBuckets.set(key, bucket);
    }
    const acceptedUsage: (typeof usageRows)[number][] = [];
    let duplicateUsageRecords = 0;
    let conflictingUsageRecords = 0;
    for (const bucket of usageBuckets.values()) {
      duplicateUsageRecords += Math.max(0, bucket.rows.length - 1);
      const [first] = bucket.rows;
      if (!first) continue;
      const conflict = bucket.rows.some(
        (row) =>
          row.threadId !== first.threadId ||
          JSON.stringify(row.usage) !== JSON.stringify(first.usage),
      );
      if (conflict) {
        conflictingUsageRecords += 1;
        excludedUsageRecords += bucket.rows.length;
      } else acceptedUsage.push(first);
    }

    const markerHashes = new Map<string, Set<string>>();
    const explicitMarkers = new Map<string, Set<string>>();
    for (const file of files) {
      const hashes = new Set<string>();
      for (const row of file.rows) {
        if (row.type !== 'compacted') continue;
        const hash = stableHash(row);
        const parsed = compactedSchema.safeParse(row.payload);
        const explicitThread = parsed.success
          ? (parsed.data.latest_token_usage_record?.thread_id ?? null)
          : null;
        if (explicitThread && connected.has(explicitThread)) {
          const explicit = explicitMarkers.get(explicitThread) ?? new Set<string>();
          explicit.add(hash);
          explicitMarkers.set(explicitThread, explicit);
        } else hashes.add(hash);
      }
      markerHashes.set(file.threadId, hashes);
    }

    const ownMarkers = new Map<string, Set<string>>();
    for (const file of files) {
      const inherited = file.parentThreadId ? markerHashes.get(file.parentThreadId) : undefined;
      const own = new Set(explicitMarkers.get(file.threadId) ?? []);
      for (const hash of markerHashes.get(file.threadId) ?? []) {
        if (!inherited?.has(hash)) own.add(hash);
      }
      ownMarkers.set(file.threadId, own);
    }

    const depths = new Map<string, number>([[rootThreadId, 0]]);
    const depthOf = (threadId: string): number => {
      const known = depths.get(threadId);
      if (known !== undefined) return known;
      const parent = filesByThread.get(threadId)?.parentThreadId;
      const depth = parent && connected.has(parent) ? depthOf(parent) + 1 : 0;
      depths.set(threadId, depth);
      return depth;
    };
    const cliVersions = [
      ...new Set(files.map((file) => file.cliVersion).filter((v): v is string => v !== null)),
    ].sort();
    const threadResults: ThreadCollaboration[] = [];
    let structuralPartial =
      duplicateThreadFiles.size > 0 || parsedFiles.some((file) => !connected.has(file.threadId));

    for (const file of files.sort(
      (a, b) => depthOf(a.threadId) - depthOf(b.threadId) || a.threadId.localeCompare(b.threadId),
    )) {
      const models = new Set(threadModels.get(file.threadId) ?? []);
      const turns = new Set<string>();
      for (const [turnId, threads] of turnThreads) {
        if (threads.has(file.threadId)) {
          turns.add(turnId);
          for (const model of turnModels.get(turnId) ?? []) models.add(model);
          if (threads.size !== 1) structuralPartial = true;
        }
      }
      const startedTurns = [...taskEvents.values()].filter(
        (event) => event.type === 'task_started' && turns.has(event.turn_id),
      );
      const terminalTurns = [...taskEvents.values()].filter(
        (event) =>
          (event.type === 'task_complete' || event.type === 'turn_aborted') &&
          turns.has(event.turn_id),
      );
      const terminalByTurn = new Map(terminalTurns.map((event) => [event.turn_id, event]));
      const hasIncompleteTurn = startedTurns.some((event) => !terminalByTurn.has(event.turn_id));
      const lastTerminal = terminalTurns
        .sort((a, b) => (a.completed_at ?? 0) - (b.completed_at ?? 0))
        .at(-1);
      const state: ThreadState = hasIncompleteTurn
        ? 'incomplete'
        : lastTerminal?.type === 'turn_aborted'
          ? 'aborted'
          : lastTerminal?.type === 'task_complete'
            ? 'completed'
            : 'unknown';
      const durations = terminalTurns
        .map((event) => event.duration_ms)
        .filter((duration): duration is number => duration !== undefined);
      const wallTimeMs =
        durations.length === terminalTurns.length && durations.length > 0
          ? Math.round(durations.reduce((sum, duration) => sum + duration, 0))
          : null;
      const threadUsageRows = acceptedUsage.filter((row) => row.threadId === file.threadId);
      const usage = threadUsageRows.length ? emptyUsage() : null;
      if (usage) for (const row of threadUsageRows) addUsage(usage, row.usage);
      const browser = signal();
      const verify = signal();
      for (const command of commands.values()) {
        if (command.threadId !== file.threadId) continue;
        if (browserCommand.test(command.command)) observeSignal(browser, command.exitCode);
        if (verifyCommand.test(command.command)) observeSignal(verify, command.exitCode);
      }
      const baseCoverage = versionCoverage(file.cliVersion);
      const compactionObserved = ownMarkers.get(file.threadId)?.size ?? 0;
      const compactionCoverage: Coverage =
        baseCoverage === 'unsupported'
          ? 'unsupported'
          : baseCoverage === 'complete' && state === 'completed' && file.malformedLines === 0
            ? 'complete'
            : 'partial';
      const coverage: Coverage =
        baseCoverage === 'unsupported'
          ? 'unsupported'
          : baseCoverage === 'complete' &&
              file.malformedLines === 0 &&
              state === 'completed' &&
              wallTimeMs !== null
            ? 'complete'
            : 'partial';
      threadResults.push({
        threadId: file.threadId,
        parentThreadId: file.parentThreadId,
        children: files
          .filter((child) => child.parentThreadId === file.threadId)
          .map((child) => child.threadId)
          .sort(),
        depth: depthOf(file.threadId),
        cliVersion: file.cliVersion,
        models: [...models].sort(),
        state,
        wallTimeMs,
        usage,
        usageResponses: threadUsageRows.length,
        compactions: {
          count: compactionCoverage === 'complete' ? compactionObserved : null,
          observedCount: compactionObserved,
          coverage: compactionCoverage,
        },
        signals: { browser, verify },
        coverage,
      });
    }

    const usageByModel = new Map<string, { responses: number; usage: TokenUsage }>();
    const totalUsage = acceptedUsage.length ? emptyUsage() : null;
    for (const row of acceptedUsage) {
      if (totalUsage) addUsage(totalUsage, row.usage);
      const model = row.model;
      if (!model) continue;
      const entry = usageByModel.get(model) ?? { responses: 0, usage: emptyUsage() };
      entry.responses += 1;
      addUsage(entry.usage, row.usage);
      usageByModel.set(model, entry);
    }
    const states: Record<ThreadState, number> = {
      completed: 0,
      aborted: 0,
      incomplete: 0,
      unknown: 0,
    };
    for (const thread of threadResults) states[thread.state] += 1;
    const completeWallTimes = threadResults.map((thread) => thread.wallTimeMs);
    const wallTimeMs = completeWallTimes.every((duration) => duration !== null)
      ? completeWallTimes.reduce<number>((sum, duration) => sum + (duration ?? 0), 0)
      : null;
    const root = threadResults.find((thread) => thread.threadId === rootThreadId) ?? null;
    const hasUnsupported = threadResults.some((thread) => thread.coverage === 'unsupported');
    const hasPartial = threadResults.some((thread) => thread.coverage === 'partial');
    const usageUncertain = excludedUsageRecords > 0 || conflictingUsageRecords > 0;
    const coverage: Coverage =
      root?.coverage === 'unsupported'
        ? 'unsupported'
        : hasUnsupported || hasPartial || structuralPartial || usageUncertain
          ? 'partial'
          : 'complete';
    return {
      schemaVersion: 1,
      source: 'codex-rollout',
      coverage,
      rootThreadId,
      cliVersions,
      threads: threadResults,
      totals: {
        threadCount: threadResults.length,
        subagentCount: Math.max(0, threadResults.length - 1),
        states,
        wallTimeMs,
        usage: totalUsage,
        usageByModel: [...usageByModel.entries()]
          .map(([model, value]) => ({ model, ...value }))
          .sort((a, b) => a.model.localeCompare(b.model)),
        uniqueUsageResponses: acceptedUsage.length,
        duplicateUsageRecords,
        conflictingUsageRecords,
        excludedUsageRecords,
      },
      compactions: {
        root: root?.compactions ?? null,
        subagents: threadResults
          .filter((thread) => thread.threadId !== rootThreadId)
          .map((thread) => ({ threadId: thread.threadId, compactions: thread.compactions })),
        observedTotal: threadResults.reduce(
          (sum, thread) => sum + thread.compactions.observedCount,
          0,
        ),
      },
      limitations: [
        'Coverage is complete only for the validated Codex 0.154.0 rollout contract and terminal, well-formed threads.',
        'Alpha CLI versions are parsed as observed evidence but remain partial until their persistence contract is validated.',
        'Usage sums unique response_id/model pairs; missing, ambiguous or conflicting records are excluded rather than guessed.',
        'Thread wall time sums reported terminal-turn durations and is not CPU time or critical-path elapsed time.',
        'Browser and verification signals are heuristic command-name matches, not proof of behavioral coverage.',
        'Prompts, messages, command text and command output are never retained.',
      ],
    };
  } catch {
    return unsupported(rootThreadId, 'The isolated rollout store could not be summarized safely.');
  }
}
