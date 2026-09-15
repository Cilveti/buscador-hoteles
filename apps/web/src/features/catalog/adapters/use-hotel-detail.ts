'use client';
import type { CatalogHotelDetailResponse } from '@hoteles/contracts/catalog';
import { useEffect, useState } from 'react';
import type { HotelDetailPort } from '../application/hotel-detail-port';

type DetailState =
  | { status: 'loading' | 'error' | 'not-found' }
  | { status: 'ready'; data: CatalogHotelDetailResponse };

export function useHotelDetail(hotelId: string, port: HotelDetailPort) {
  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is an explicit retry trigger for the same hotel.
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    port
      .findById(hotelId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState(data ? { status: 'ready', data } : { status: 'not-found' });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [hotelId, port, attempt]);
  return { state, retry: () => setAttempt((value) => value + 1) };
}
