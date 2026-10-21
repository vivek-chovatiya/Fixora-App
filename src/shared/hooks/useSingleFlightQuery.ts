/**
 * useSingleFlightQuery
 *
 * `useServiceQuery`, with one rule added: while a request is in the air, asking
 * again does nothing. A second press of Try again, or a pull while the first
 * load is still running, is ignored rather than sent.
 *
 * ⚠️ The guard is held by the request, not by the screen's state. It is taken
 * when the service is called and released in a `finally` when that call
 * settles, so it is released on success and on failure alike, however quickly
 * either happens.
 *
 * That is deliberate, and it is a lesson paid for in Phase 3E-2: a guard
 * released by watching `isLoading` stays shut for good when a retry fails at
 * once, because loading is set and cleared in the same render and is never seen
 * to change — "one retry at a time" became "one retry, ever". Releasing on the
 * answer's identity would fix that and break the day a service returns the
 * same object twice. The call settling is the only signal that cannot be missed.
 *
 * `useServiceQuery` already discards a superseded answer; this stops the second
 * request being made at all, which matters for a list a vendor may pull at
 * repeatedly (PROJECT_BIBLE.md section 31.2).
 */

import { useCallback, useRef, type DependencyList } from 'react';

import {
  useServiceQuery,
  type UseServiceQueryOptions,
  type UseServiceQueryResult,
} from '@/shared/hooks/useServiceQuery';

export function useSingleFlightQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options?: UseServiceQueryOptions,
): UseServiceQueryResult<T> {
  /*
    The newest call holds the guard, and only the newest call lets it go.

    ⚠️ Not a flag that any call clears: when the inputs change mid-read the
    newer read starts while the superseded one is still running, and the older
    one's `finally` opened the guard under the newer read — a second request
    could go out beside it. Not a count of calls in the air either: a
    superseded read that never settles (a dead connection, up to the request
    timeout) would keep Try again shut after the newest read had already
    failed. Each call takes a number; only the holder of the latest number
    releases. The superseded answer is discarded by `useServiceQuery` anyway.
  */
  const busy = useRef(false);
  const generation = useRef(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  /*
    Taken synchronously: `useServiceQuery` calls the fetcher in the same tick
    as `retry()` or `refresh()`, before either returns, so a second press in
    that tick already finds the guard held.
  */
  const guarded = useCallback(async (): Promise<T> => {
    generation.current += 1;
    const mine = generation.current;
    busy.current = true;
    try {
      return await fetcherRef.current();
    } finally {
      if (generation.current === mine) {
        busy.current = false;
      }
    }
  }, []);

  const query = useServiceQuery<T>(guarded, deps, options);
  const { retry: retryQuery, refresh: refreshQuery } = query;

  const retry = useCallback(() => {
    if (!busy.current) {
      retryQuery();
    }
  }, [retryQuery]);

  const refresh = useCallback(() => {
    if (!busy.current) {
      refreshQuery();
    }
  }, [refreshQuery]);

  return { ...query, retry, refresh };
}
