import {
  AlertCircle,
  Check,
  ChevronDown,
  Circle,
  FileCode2,
  LoaderCircle,
  Terminal,
  Wrench,
} from 'lucide-react';
import { Collapsible } from 'radix-ui';
import { useEffect, useState } from 'react';
import type { TraceItem } from '../../../scripts/workflow-observer/trace';
import { ResultContent } from './result-content';

type Action = TraceItem & { kind: 'command' | 'tool' | 'file' };
type Block = { kind: 'actions'; items: Action[] } | { kind: 'event'; item: TraceItem };

/** CLI events repeat the same item as it starts and completes; keep its latest state in its original position. */
export function collapseTraceItems(items: TraceItem[]): TraceItem[] {
  const result: TraceItem[] = [];
  const positions = new Map<string, number>();
  for (const item of items) {
    const key = item.itemId ? `${item.kind}:${item.itemId}` : null;
    const position = key ? positions.get(key) : undefined;
    if (position === undefined) {
      if (key) positions.set(key, result.length);
      result.push(item);
    } else {
      const previous = result[position];
      if (!previous) continue;
      result[position] = {
        ...item,
        index: previous.index,
        body: item.body || previous.body,
      };
    }
  }
  return result;
}

function isAction(item: TraceItem): item is Action {
  return item.kind === 'command' || item.kind === 'tool' || item.kind === 'file';
}

function blocks(items: TraceItem[]): Block[] {
  const result: Block[] = [];
  for (const item of collapseTraceItems(items)) {
    if (isAction(item)) {
      const last = result.at(-1);
      if (last?.kind === 'actions') last.items.push(item);
      else result.push({ kind: 'actions', items: [item] });
    } else result.push({ kind: 'event', item });
  }
  return result;
}

function statusKind(status: string | null) {
  if (status === 'failed' || status === 'error') return 'failed';
  if (status === 'in_progress' || status === 'running') return 'running';
  if (status === 'completed' || status === 'complete') return 'done';
  return 'unknown';
}

function StatusIcon({ status }: { status: string | null }) {
  const kind = statusKind(status);
  if (kind === 'failed') return <AlertCircle aria-hidden="true" />;
  if (kind === 'running') return <LoaderCircle aria-hidden="true" className="trace-spinning" />;
  if (kind === 'done') return <Check aria-hidden="true" />;
  return <Circle aria-hidden="true" />;
}

function formatBody(body: string) {
  if (!body.startsWith('{') && !body.startsWith('[')) return body;
  try {
    return JSON.stringify(JSON.parse(body) as unknown, null, 2);
  } catch {
    return body;
  }
}

function actionTitle(item: Action) {
  if (item.kind === 'command') {
    const command =
      item.title.match(/^\/bin\/(?:zsh|bash) -lc (['"])([\s\S]*)\1$/)?.[2] ?? item.title;
    const firstLine = command.split('\n')[0] ?? '';
    return firstLine.length > 96 ? `${firstLine.slice(0, 95)}…` : firstLine;
  }
  if (item.kind !== 'file') return item.title;
  try {
    const value: unknown = JSON.parse(item.body);
    if (!Array.isArray(value)) return item.title;
    const paths = value.flatMap((change) =>
      change && typeof change === 'object' && 'path' in change && typeof change.path === 'string'
        ? [change.path.split('/').at(-1) ?? change.path]
        : [],
    );
    return paths.length === 1
      ? paths[0]
      : paths.length > 1
        ? `${paths.length} archivos`
        : item.title;
  } catch {
    return item.title;
  }
}

function ActionRow({ item }: { item: Action }) {
  const failed = statusKind(item.status) === 'failed';
  const [open, setOpen] = useState(false);
  const label =
    item.kind === 'command' ? 'Comando' : item.kind === 'file' ? 'Archivo' : 'Herramienta';
  const Icon = item.kind === 'command' ? Terminal : item.kind === 'file' ? FileCode2 : Wrench;
  return (
    <Collapsible.Root
      className={`trace-action ${failed ? 'trace-action-failed' : ''}`}
      open={open}
      onOpenChange={setOpen}
    >
      <Collapsible.Trigger className="trace-action-trigger">
        <Icon aria-hidden="true" />
        <span className="trace-action-name">
          <small>{label}</small>
          <strong>{actionTitle(item)}</strong>
        </span>
        <span className={`trace-action-state ${statusKind(item.status)}`}>
          <StatusIcon status={item.status} />
          <span>
            {failed
              ? 'Falló'
              : statusKind(item.status) === 'running'
                ? 'En curso'
                : statusKind(item.status) === 'done'
                  ? 'Hecho'
                  : 'Registrado'}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className="trace-chevron" />
      </Collapsible.Trigger>
      <Collapsible.Content className="trace-action-content">
        {item.kind === 'command' && (
          <>
            <small>Comando completo</small>
            <pre>{item.title}</pre>
          </>
        )}
        {item.kind === 'command' && item.body && <small>Salida</small>}
        {item.body ? <pre>{formatBody(item.body)}</pre> : <p>Sin salida registrada.</p>}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function ActionGroup({ items }: { items: Action[] }) {
  const failed = items.some((item) => statusKind(item.status) === 'failed');
  const running = items.some((item) => statusKind(item.status) === 'running');
  const [open, setOpen] = useState(failed);
  useEffect(() => {
    if (failed) setOpen(true);
  }, [failed]);
  return (
    <Collapsible.Root
      className={`trace-action-group ${failed ? 'trace-group-failed' : ''}`}
      open={open}
      onOpenChange={setOpen}
    >
      <Collapsible.Trigger className="trace-group-trigger">
        <span className="trace-group-icon">
          <StatusIcon status={failed ? 'failed' : running ? 'running' : 'completed'} />
        </span>
        <span>
          {items.length} {items.length === 1 ? 'acción' : 'acciones'}
        </span>
        {failed && (
          <small>
            {items.filter((item) => statusKind(item.status) === 'failed').length} con fallo
          </small>
        )}
        {running && !failed && <small>En curso</small>}
        <ChevronDown aria-hidden="true" className="trace-chevron" />
      </Collapsible.Trigger>
      <Collapsible.Content className="trace-group-content">
        {items.map((item) => (
          <ActionRow key={item.itemId ?? item.index} item={item} />
        ))}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function EventRow({ item, resultTitle }: { item: TraceItem; resultTitle?: string }) {
  if (item.kind === 'lifecycle') {
    const title =
      {
        'turn · started': 'Turno iniciado',
        'turn · completed': 'Turno terminado',
        'turn · failed': 'Turno fallido',
      }[item.title] ?? item.title;
    return (
      <div className="trace-lifecycle">
        <span>{title}</span>
      </div>
    );
  }
  if (item.kind === 'error')
    return (
      <div className="trace-event-error" role="alert">
        <AlertCircle aria-hidden="true" />
        <div>
          <strong>{item.title}</strong>
          {item.body && <pre>{formatBody(item.body)}</pre>}
        </div>
      </div>
    );
  return (
    <div className="trace-message">
      <ResultContent text={item.body || 'Mensaje vacío'} title={resultTitle} />
    </div>
  );
}

export function TraceTimeline({
  items,
  loading,
  resultTitle,
}: {
  items: TraceItem[];
  loading: boolean;
  resultTitle?: string;
}) {
  return (
    <section className="workflow-trace-events" aria-label="Eventos de la traza">
      {blocks(items).map((block) =>
        block.kind === 'actions' ? (
          <ActionGroup
            key={`actions-${block.items[0]?.itemId ?? block.items[0]?.index}`}
            items={block.items}
          />
        ) : (
          <EventRow
            key={`event-${block.item.itemId ?? block.item.index}`}
            item={block.item}
            resultTitle={resultTitle}
          />
        ),
      )}
      {loading && <p role="status">Leyendo traza…</p>}
      {!loading && items.length === 0 && (
        <p className="workflow-empty">Aún no hay eventos visibles.</p>
      )}
    </section>
  );
}
