/**
 * usePaginatedQuery
 *
 * Drives every paginated list in the application: initial load, pull to
 * refresh, infinite scroll and retry.
 *
 * Designed for FlatList — `items` is a stable accumulated array, and the
 * separate loading flags let a list show a skeleton, a refresh spinner and a
 * footer spinner without conflating them.
 */

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { AppError } from '@/shared/types/error';
import type { Page, PageRequest } from '@/shared/types/pagination';

const log = createLogger('usePaginatedQuery');

export interface UsePaginatedQueryOptions {
  pageSize?: number;
  enabled?: boolean;
}

export interface UsePaginatedQueryResult<T> {
  items: T[];
  error: AppError | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  total: number;
  /** True once loading has settled with no results and no error. */
  isEmpty: boolean;
  loadMore: () => void;
  refresh: () => void;
  retry: () => void;
}

export function usePaginatedQuery<T>(
  fetchPage: (request: PageRequest) => Promise<Page<T>>,
  deps: DependencyList,
  options: UsePaginatedQueryOptions = {},
): UsePaginatedQueryResult<T> {
  const { pageSize = AppConfig.pagination.defaultPageSize, enabled = true } = options;

  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState<number>(AppConfig.pagination.initialPage);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  /** Prevents overlapping loadMore calls as the user keeps scrolling. */
  const inFlightRef = useRef(false);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (targetPage: number, mode: 'load' | 'refresh' | 'more') => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else if (mode === 'more') {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await fetchRef.current({ page: targetPage, pageSize });
        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }
        setItems(previous => (mode === 'more' ? [...previous, ...result.items] : result.items));
        setPage(result.page);
        setTotal(result.total);
        setHasMore(result.hasMore);
      } catch (caught) {
        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }
        const appError = AppError.from(caught);
        log.error('page load failed', { page: targetPage, kind: appError.kind });
        setError(appError);
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current && requestIdRef.current === requestId) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [pageSize],
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void load(AppConfig.pagination.initialPage, 'load');
    // `deps` is the caller's declared dependency list, e.g. a search term.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, load, ...deps]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isLoading || isRefreshing || error) {
      return;
    }
    void load(page + 1, 'more');
  }, [hasMore, isLoadingMore, isLoading, isRefreshing, error, load, page]);

  const refresh = useCallback(() => {
    void load(AppConfig.pagination.initialPage, 'refresh');
  }, [load]);

  const retry = useCallback(() => {
    void load(AppConfig.pagination.initialPage, 'load');
  }, [load]);

  return {
    items,
    error,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    total,
    isEmpty: !isLoading && !isRefreshing && error === null && items.length === 0,
    loadMore,
    refresh,
    retry,
  };
}
