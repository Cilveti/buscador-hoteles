import { closeSync, openSync, readSync, statSync, writeSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

export type TraceItem = {
  index: number;
  kind: 'message' | 'command' | 'tool' | 'file' | 'error' | 'lifecycle';
  title: string;
  body: string;
  status: string | null;
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const string = (value: unknown) => (typeof value === 'string' ? value : null);
const limit = (value: string, size = 12_000) =>
  value.length > size ? `${value.slice(0, size)}\n… salida truncada` : value;

function project(raw: unknown, index: number): TraceItem | null {
  const event = object(raw);
  const type = string(event.type) ?? string(event.event) ?? '';
  const item = object(event.item);
  const itemType = string(item.type) ?? '';
  const status = string(item.status);
  if (itemType.includes('reasoning') || type.includes('reasoning')) return null;
  if (type === 'thread.started')
    return {
      index,
      kind: 'lifecycle',
      title: 'Sesión iniciada',
      body: string(event.thread_id) ?? '',
      status: null,
    };
  if (type === 'turn.started' || type === 'turn.completed' || type === 'turn.failed')
    return { index, kind: 'lifecycle', title: type.replaceAll('.', ' · '), body: '', status: null };
  if (type === 'error' || type.endsWith('.failed'))
    return {
      index,
      kind: 'error',
      title: type || 'Error',
      body: limit(JSON.stringify(event)),
      status: 'failed',
    };
  if (itemType === 'agent_message')
    return {
      index,
      kind: 'message',
      title: 'Agente',
      body: limit(string(item.text) ?? ''),
      status,
    };
  if (itemType === 'command_execution')
    return {
      index,
      kind: 'command',
      title: string(item.command) ?? 'Comando',
      body: limit(string(item.aggregated_output) ?? ''),
      status,
    };
  if (itemType === 'file_change')
    return {
      index,
      kind: 'file',
      title: 'Cambio de archivos',
      body: limit(JSON.stringify(item.changes ?? item)),
      status,
    };
  if (itemType.includes('tool') || itemType.includes('collab'))
    return { index, kind: 'tool', title: itemType, body: limit(JSON.stringify(item)), status };
  // Unknown JSONL is still inspectable, but never render private reasoning text.
  if (type.startsWith('item.') && itemType)
    return { index, kind: 'tool', title: itemType, body: limit(JSON.stringify(item)), status };
  return null;
}

/** Keep inspectable tool activity and outputs before bulk raw eval traces are deleted. */
export function archiveTrace(source: string, target: string) {
  const input = openSync(source, 'r');
  const output = openSync(target, 'w', 0o600);
  const buffer = Buffer.alloc(65_536);
  const decoder = new StringDecoder('utf8');
  let pending = '';
  let lines = 0;
  let events = 0;
  const writeLine = (line: string) => {
    const index = lines++;
    if (!line.trim()) return;
    try {
      const event = project(JSON.parse(line) as unknown, index);
      if (event) {
        writeSync(output, `${JSON.stringify(event)}\n`);
        events++;
      }
    } catch {
      // An incomplete last event is not evidence; the finished events still survive.
    }
  };
  try {
    while (true) {
      const length = readSync(input, buffer, 0, buffer.length, null);
      if (length === 0) break;
      pending += decoder.write(buffer.subarray(0, length));
      let newline = pending.indexOf('\n');
      while (newline >= 0) {
        writeLine(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
        newline = pending.indexOf('\n');
      }
    }
    pending += decoder.end();
    if (pending) writeLine(pending);
  } finally {
    closeSync(input);
    closeSync(output);
  }
  return events;
}

/** Read a bounded page backwards; `before` is the cursor for older events. */
export function tracePage(
  file: string,
  before?: number,
  maxBytes = 2_000_000,
): { items: TraceItem[]; truncated: boolean; before: number | null } {
  const size = statSync(file).size;
  const end = Math.min(before ?? size, size);
  const length = Math.min(end, maxBytes);
  const start = end - length;
  const buffer = Buffer.alloc(length);
  const descriptor = openSync(file, 'r');
  try {
    readSync(descriptor, buffer, 0, length, start);
  } finally {
    closeSync(descriptor);
  }
  const firstNewline = start > 0 ? buffer.indexOf(10) : -1;
  const first = firstNewline < 0 ? start : start + firstNewline + 1;
  const text = buffer.subarray(first - start).toString('utf8');
  const projected = file.endsWith('.projected.jsonl');
  let offset = first;
  const items = text.split('\n').flatMap((line) => {
    const index = offset;
    offset += Buffer.byteLength(line) + 1;
    if (!line.trim()) return [];
    try {
      const parsed: unknown = JSON.parse(line);
      const item = projected ? (parsed as TraceItem) : project(parsed, index);
      return item ? [item] : [];
    } catch {
      return [];
    }
  });
  return { items, truncated: first > 0, before: first > 0 ? first : null };
}
