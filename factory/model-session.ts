import { setTimeout } from 'node:timers/promises';
import { object } from './github';

/** Poll short HTTP requests under one deadline; do not mistake a tool turn for a final answer. */
export async function waitForModelResult(
  request: (path: string) => Promise<unknown>,
  sessionId: string,
  signal: AbortSignal,
  intervalMs = 2000,
): Promise<Record<string, unknown>> {
  while (!signal.aborted) {
    // Read the latest message; older user messages have an output-format encoding bug in 1.18.30.
    const messages = await request(`/session/${sessionId}/message?limit=1`);
    if (!Array.isArray(messages)) throw new Error('Invalid session message list');
    const latest = messages
      .map((entry) => object(object(entry).info))
      .filter((info) => info.role === 'assistant')
      .sort((a, b) => Number(object(b.time).created) - Number(object(a.time).created))[0];
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
