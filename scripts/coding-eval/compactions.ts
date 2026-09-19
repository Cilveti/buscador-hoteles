import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';

const object = z.record(z.string(), z.unknown());
const record = (value: unknown) => object.safeParse(value).data ?? {};
const text = (value: unknown) => (typeof value === 'string' ? value : null);

export type Compactions = {
  /** Exact count only when a supported source covers the complete candidate turn. */
  count: number | null;
  observedCount: number;
  source: 'codex-rollout' | 'opencode-events' | 'unavailable';
  coverage: 'complete' | 'partial' | 'unavailable';
  evidence: { event: number; timestamp: string | null; id: string | null }[];
  sourceFile?: string;
  cliVersion?: string | null;
  limitations: string[];
};

export function unavailableCompactions(reason: string): Compactions {
  return {
    count: null,
    observedCount: 0,
    source: 'unavailable',
    coverage: 'unavailable',
    evidence: [],
    limitations: [reason, 'Never inferred from token counts or model-authored text.'],
  };
}

/** CLI JSON does not guarantee a full compaction stream. An explicit notification is a lower bound. */
export function streamCompactions(events: unknown[]): Compactions {
  const evidence: Compactions['evidence'] = [];
  const seen = new Set<string>();
  for (const [event, raw] of events.entries()) {
    const item = record(raw);
    if (item.type !== 'session.compacted') continue;
    const id = text(item.id);
    const timestamp = text(item.timestamp);
    const key =
      id ?? (timestamp ? `${text(record(item.properties).sessionID)}:${timestamp}` : null);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    evidence.push({ event, timestamp, id });
  }
  if (!evidence.length)
    return unavailableCompactions(
      'The CLI JSON stream does not expose complete compaction telemetry.',
    );
  return {
    count: null,
    observedCount: evidence.length,
    source: 'opencode-events',
    coverage: 'partial',
    evidence,
    limitations: [
      'Only explicit session.compacted notifications count; CLI coverage is not guaranteed.',
      'Notifications without an ID or timestamp cannot be deduplicated.',
    ],
  };
}

/** Codex 0.154 persists one canonical `compacted` rollout record per applied compaction.
 * Legacy context_compacted events / completed contextCompaction items mirror it and are not added.
 * Source: codex-rs/rollout/src/policy.rs and history/src/rollout_payload.rs at rust-v0.154.0.
 */
export function analyzeCodexRollout(lines: string[], sessionId: string): Compactions {
  const evidence: Compactions['evidence'] = [];
  const seen = new Set<string>();
  let matchesSession = false;
  let cliVersion: string | null = null;
  let terminal = false;
  let malformed = false;
  for (const [event, line] of lines.entries()) {
    if (!line.trim()) continue;
    let item: Record<string, unknown>;
    try {
      item = record(JSON.parse(line));
    } catch {
      malformed = true;
      continue;
    }
    const payload = record(item.payload);
    if (item.type === 'session_meta') {
      matchesSession = payload.id === sessionId;
      cliVersion = text(payload.cli_version);
    }
    if (
      item.type === 'event_msg' &&
      ['task_complete', 'turn_complete'].includes(String(payload.type))
    )
      terminal = true;
    if (item.type !== 'compacted') continue;
    const timestamp = text(item.timestamp);
    const id = text(item.id);
    // Identical durable rows can occur in replayed input; mirrored legacy events are ignored above.
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    evidence.push({ event, timestamp, id });
  }
  if (!matchesSession)
    return unavailableCompactions('No rollout session_meta matches the emitted thread ID.');
  const supportedVersion = cliVersion === '0.154.0';
  const complete = terminal && !malformed && supportedVersion;
  return {
    count: complete ? evidence.length : null,
    observedCount: evidence.length,
    source: 'codex-rollout',
    cliVersion,
    coverage: complete ? 'complete' : 'partial',
    evidence,
    limitations: [
      'Counts durable applied-compaction records in the candidate thread only, not subagents, attempts or token pruning.',
      'Parser targets the Codex 0.154 rollout format; original rollout contents are not retained.',
      ...(!supportedVersion
        ? [
            'Unknown CLI version; validate its rollout persistence contract before claiming an exact count.',
          ]
        : []),
      ...(!complete
        ? [
            'Rollout is truncated, malformed or lacks a completed turn; observedCount is a lower bound.',
          ]
        : []),
    ],
  };
}

/** Scans only the newly created isolated home, never the user's session store. */
export function collectCodexCompactions(
  isolatedHome: string,
  sessionId: string | null,
): Compactions {
  if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId))
    return unavailableCompactions('The CLI did not emit a valid thread ID.');
  const sessions = join(isolatedHome, 'sessions');
  if (!existsSync(sessions))
    return unavailableCompactions('The CLI did not persist a session rollout.');
  try {
    const files: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (entry.isFile() && entry.name.endsWith(`-${sessionId}.jsonl`)) files.push(path);
      }
    };
    visit(sessions);
    const [path] = files;
    if (!path || files.length !== 1)
      return unavailableCompactions('A unique plain JSONL rollout for this thread was not found.');
    return {
      ...analyzeCodexRollout(readFileSync(path, 'utf8').split('\n'), sessionId),
      sourceFile: basename(path),
    };
  } catch {
    return unavailableCompactions(
      'The isolated rollout could not be read; the evaluation remains valid without this metric.',
    );
  }
}
