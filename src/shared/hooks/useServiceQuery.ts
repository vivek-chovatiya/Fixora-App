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
}

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

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (mode: 'load' | 'refresh') => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = await fetcherRef.current();
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        return;
      }
      setData(result);
    } catch (caught) {
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        return;
      }
      const appError = AppError.from(caught);
      log.error('query failed', { kind: appError.kind, message: appError.message });
      setError(appError);
    } finally {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setIsLoading(false);
        setIsRefreshing(false);
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

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    isError: error !== null,
    refresh,
    retry,
  };
}
