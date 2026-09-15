'use client';
import type { CatalogQuery, CatalogResponse } from '@hoteles/contracts/catalog';
import { useEffect, useState } from 'react';
import type { CatalogPort } from '../application/catalog-port';
import { changeQuery, initialQuery, readQuery, serializeQuery } from '../application/query';

type LoadState =
  | { status: 'loading'; data: CatalogResponse | null }
  | { status: 'ready'; data: CatalogResponse }
  | { status: 'error'; data: CatalogResponse | null };

export function useCatalog(port: CatalogPort) {
  const [query, setQuery] = useState(initialQuery);
  const [initialized, setInitialized] = useState(false);
  const [state, setState] = useState<LoadState>({ status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const restore = () => {
      setQuery(readQuery(new URLSearchParams(window.location.search)));
      setInitialized(true);
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is an explicit retry trigger even when query and port have not changed.
  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();
    setState((previous) => ({ status: 'loading', data: previous.data }));
    port
      .search(query, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState((previous) => ({ status: 'error', data: previous.data }));
      });
    return () => controller.abort();
  }, [query, port, initialized, attempt]);

  function update(patch: Partial<CatalogQuery>) {
    const next = changeQuery(query, patch);
    const parameters = serializeQuery(next);
    window.history.pushState(
      null,
      '',
      `${window.location.pathname}${parameters ? `?${parameters}` : ''}`,
    );
    setQuery(next);
  }

  return { query, state, update, retry: () => setAttempt((value) => value + 1) };
}
