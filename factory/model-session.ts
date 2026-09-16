import { setTimeout } from 'node:timers/promises';
import { object } from './github';

export interface ModelProgress {
  polls: number;
  assistantMessages: number;
  completed: boolean;
  structured: boolean;
  toolCalls: number;
  tools: { name: string; status: string }[];
}

/** Poll short HTTP requests under one deadline; do not mistake a tool turn for a final answer. */
export async function waitForModelResult(
  request: (path: string) => Promise<unknown>,
  sessionId: string,
  signal: AbortSignal,
  intervalMs = 2000,
  observe?: (progress: ModelProgress) => void,
  maxToolCalls = 80,
): Promise<Record<string, unknown>> {
  let polls = 0;
  const toolCalls = new Set<string>();
  while (!signal.aborted) {
    // Read the latest message; older user messages have an output-format encoding bug in 1.18.30.
    const messages = await request(`/session/${sessionId}/message?limit=1`);
    if (!Array.isArray(messages)) throw new Error('Invalid session message list');
    const latest = messages
      .map((entry) => object(object(entry).info))
      .filter((info) => info.role === 'assistant')
      .sort((a, b) => Number(object(b.time).created) - Number(object(a.time).created))[0];
    const tools = messages.flatMap((entry) => {
      const parts = object(entry).parts;
      if (!Array.isArray(parts)) return [];
      return parts.flatMap((value) => {
        const part = object(value);
        if (part.type !== 'tool') return [];
        if (typeof part.id === 'string') toolCalls.add(part.id);
        const name = part.tool;
        const status = object(part.state).status;
        return typeof name === 'string' &&
          /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name) &&
          ['pending', 'running', 'completed', 'error'].includes(String(status))
          ? [{ name, status: String(status) }]
          : [];
      });
    });
    observe?.({
      polls: ++polls,
      toolCalls: toolCalls.size,
      assistantMessages: messages.filter((entry) => object(object(entry).info).role === 'assistant')
        .length,
      completed: latest !== undefined && object(latest.time).completed !== undefined,
      structured: latest?.structured !== undefined,
      tools,
    });
    if (toolCalls.size > maxToolCalls) throw new Error('Model tool-call limit exceeded');
    if (
      latest &&
      (latest.error !== undefined ||
        (object(latest.time).completed !== undefined &&
          (latest.structured !== undefined ||
            (latest.finish !== 'tool-calls' && latest.finish !== undefined))))
    )
      return latest;
    await setTimeout(intervalMs, undefined, { signal });
  }
  signal.throwIfAborted();
  throw new Error('Model deadline exceeded');
}
