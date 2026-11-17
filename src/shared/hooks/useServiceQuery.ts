/**
 * useServiceQuery
 *
 * Reads data from a service and exposes the loading, error and retry states
 * every screen is required to handle.
 *
 * This is the UI-first phase's data-fetching primitive. RTK Query takes over
 * caching and invalidation once ApiService implementations exist; keeping that
 * complexity out until there is real HTTP to cache is deliberate.
 *
 * @example
 * const { data, isLoading, error, retry } = useServiceQuery(
 *   () => getService('notification').getUnreadCount(),
 *   [],
 * );
 *
 * ⚠️ Three ways to read again, and only two of them show it. `retry` is the
 * error's Try again (placeholders), `refresh` is a pull (the spinner), and
 * `refreshQuietly` (Phase 3E-15, owner decision 21/10/2026) is a screen
 * checking again by itself when its tab is shown again: nothing on screen
 * changes until the answer — no placeholders, no spinner, and a failure from
 * before stays where it is rather than being cleared and drawn again. It never
 * starts a read beside one already in the air, whichever way that one began:
 * the read in the air is at least as new as the one it would have sent. And
 * it never holds a press back: `retry` and `refresh` start at once over a
 * quiet read, which is then dropped as superseded — a tap is never swallowed.
 */

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { AppError } from '@/shared/types/error';

const log = createLogger('useServiceQuery');

export interface UseServiceQueryOptions {
  /** Skips fetching while false. Use for queries that depend on a prior value. */
  enabled?: boolean;
}

export interface UseServiceQueryResult<T> {
  data: T | undefined;
  error: AppError | null;
  /** True only for the initial load, so skeletons do not reappear on refresh. */
  isLoading: boolean;
  /** True while a pull-to-refresh is in flight. */
  isRefreshing: boolean;
  isError: boolean;
  /** Re-runs the query, showing the refreshing state. */
  refresh: () => void;
  /** Re-runs the query, showing the loading state. For the error retry action. */
  retry: () => void;
  /**
   * Re-runs the query showing nothing — no loading, no refreshing, the last
   * failure kept until this read answers. Does nothing while a read is in the
   * air. For a screen reading again on its own, never for a gesture.
   */
  refreshQuietly: () => void;
}

type ReadMode = 'load' | 'refresh' | 'quiet';

export function useServiceQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options: UseServiceQueryOptions = {},
): UseServiceQueryResult<T> {
  const { enabled = true } = options;

  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /** Guards against setting state after unmount. */
  const mountedRef = useRef(true);
  /** Discards responses from superseded requests, preventing stale overwrites. */
  const requestIdRef = useRef(0);
  /**
   * The newest read has not settled. Released only by the newest read, as
   * `useSingleFlightQuery`'s guard is: a superseded read settling must not
   * open it under a newer one still in the air. Only a quiet read defers to it.
   */
  const inFlightRef = useRef(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (mode: ReadMode) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    inFlightRef.current = true;

    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else if (mode === 'load') {
      setIsLoading(true);
    }
    // A quiet read leaves the last failure on screen until it has an answer of its own.
    if (mode !== 'quiet') {
      setError(null);
    }

    try {
      const result = await fetcherRef.current();
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        return;
      }
      setData(result);
      // Already null unless this read was quiet; then the failure it kept is answered.
      setError(null);
    } catch (caught) {
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        return;
      }
      const appError = AppError.from(caught);
      log.error('query failed', { kind: appError.kind, message: appError.message });
      setError(appError);
    } finally {
      if (requestIdRef.current === requestId) {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void run('load');
    // `deps` is the caller's declared dependency list for the fetcher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  const refresh = useCallback(() => {
    void run('refresh');
  }, [run]);

  const retry = useCallback(() => {
    void run('load');
  }, [run]);

  const refreshQuietly = useCallback(() => {
    if (!enabledRef.current || inFlightRef.current) {
      return;
    }
    // Started, not awaited: `run` settles every read itself. `.catch` rather
    // than `void`, so the lint baseline (WORKING_NOTES section 5) does not grow.
    run('quiet').catch(() => undefined);
  }, [run]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    isError: error !== null,
    refresh,
    retry,
    refreshQuietly,
  };
}
