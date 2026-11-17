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

  /*
    ⚠️ The read in the air is a quiet one (Phase 3E-15). A press is never held
    back by it: Try again and a pull start at once, with their own placeholder
    or spinner, and the quiet answer is dropped when it lands (it is no longer
    the newest read). Only a quiet read defers — to anything — never the other
    way round: a tap silently swallowed is a tap the user thinks did nothing.
    `startingQuiet` is up only while a quiet read is being started, so the call
    it starts knows what it is.
  */
  const quietOut = useRef(false);
  const startingQuiet = useRef(false);

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
    quietOut.current = startingQuiet.current;
    try {
      return await fetcherRef.current();
    } finally {
      if (generation.current === mine) {
        busy.current = false;
        quietOut.current = false;
      }
    }
  }, []);

  const query = useServiceQuery<T>(guarded, deps, options);
  const { retry: retryQuery, refresh: refreshQuery, refreshQuietly: refreshQuietlyQuery } = query;

  // A press goes ahead over a quiet read, never over another press's read.
  const retry = useCallback(() => {
    if (!busy.current || quietOut.current) {
      retryQuery();
    }
  }, [retryQuery]);

  const refresh = useCallback(() => {
    if (!busy.current || quietOut.current) {
      refreshQuery();
    }
  }, [refreshQuery]);

  // The shared query already holds a quiet read back while one is out; held here too, by the same guard.
  const refreshQuietly = useCallback(() => {
    if (busy.current) {
      return;
    }
    startingQuiet.current = true;
    try {
      // Calls `guarded` before it returns, which reads `startingQuiet`.
      refreshQuietlyQuery();
    } finally {
      startingQuiet.current = false;
    }
  }, [refreshQuietlyQuery]);

  return { ...query, retry, refresh, refreshQuietly };
}
