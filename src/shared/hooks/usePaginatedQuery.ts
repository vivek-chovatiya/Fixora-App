/**
 * usePaginatedQuery
 *
 * Drives every paginated list in the application: initial load, pull to
 * refresh, loading the next page and retry.
 *
 * Designed for FlatList — `items` is a stable accumulated array, and the
 * separate loading flags let a list show a skeleton, a refresh spinner and a
 * footer spinner without conflating them.
 *
 * ⚠️ Three rules a list depends on, each found by the first screen to use it
 * (My Requests, PROJECT_BIBLE.md section 23):
 *
 * - A new question replaces the one in flight. Changing a filter or pulling to
 *   refresh while a page is loading starts the new load, and the old answer is
 *   discarded when it lands. Only loading the *next* page waits its turn — two of
 *   those at once is how a page gets skipped or fetched twice.
 * - A failure says what failed. `failedDuring` is `more` when the next page did
 *   not arrive, and the items already on screen stay there; `retry` then asks for
 *   that same page again rather than starting the list over.
 * - A page repeated is not a second record. Offset pages shift when a record is
 *   added between two reads, so the next page can begin with the last one's
 *   final item. With `getKey`, an item already in the list is not appended again.
 */

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { AppError } from '@/shared/types/error';
import type { Page, PageRequest } from '@/shared/types/pagination';

const log = createLogger('usePaginatedQuery');

type LoadMode = 'load' | 'refresh' | 'more';

export interface UsePaginatedQueryOptions<T> {
  pageSize?: number;
  enabled?: boolean;
  /**
   * An item's identity. When given, an item whose key is already in the list is
   * not appended again by a later page.
   */
  getKey?: (item: T) => string;
}

export interface UsePaginatedQueryResult<T> {
  items: T[];
  error: AppError | null;
  /**
   * Which load `error` came from: the first one, a refresh, or the next page.
   * Null when there is no error. A list keeps what it already shows when this
   * is `refresh` or `more`.
   */
  failedDuring: LoadMode | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  total: number;
  /** True once loading has settled with no results and no error. */
  isEmpty: boolean;
  loadMore: () => void;
  refresh: () => void;
  /** Repeats whatever failed: the next page, a refresh, or the first load. */
  retry: () => void;
}

export function usePaginatedQuery<T>(
  fetchPage: (request: PageRequest) => Promise<Page<T>>,
  deps: DependencyList,
  options: UsePaginatedQueryOptions<T> = {},
): UsePaginatedQueryResult<T> {
  const { pageSize = AppConfig.pagination.defaultPageSize, enabled = true } = options;

  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState<number>(AppConfig.pagination.initialPage);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [failedDuring, setFailedDuring] = useState<LoadMode | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  /** True while any load is in flight. Only a next-page load defers to it. */
  const inFlightRef = useRef(false);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const getKeyRef = useRef(options.getKey);
  getKeyRef.current = options.getKey;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (targetPage: number, mode: LoadMode) => {
      // The next page waits its turn; a new question does not.
      if (mode === 'more' && inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const isCurrent = () => mountedRef.current && requestIdRef.current === requestId;

      // Each flag set outright, so a load replacing another cannot leave the
      // other's spinner behind.
      setIsLoading(mode === 'load');
      setIsRefreshing(mode === 'refresh');
      setIsLoadingMore(mode === 'more');
      setError(null);
      setFailedDuring(null);

      /*
        A first load is a new question — a different filter, or a retry from
        nothing — so the old answer goes at once. Kept, it would sit under the new
        filter's name, and if the load then failed it would be the wrong list
        presented as the right one. A refresh keeps it: same question, newer answer.
      */
      if (mode === 'load') {
        setItems([]);
        setHasMore(false);
        setTotal(0);
      }

      try {
        const result = await fetchRef.current({ page: targetPage, pageSize });
        if (!isCurrent()) {
          return;
        }

        setItems(previous => {
          if (mode !== 'more') {
            return result.items;
          }

          const getKey = getKeyRef.current;
          if (!getKey) {
            return [...previous, ...result.items];
          }

          const seen = new Set(previous.map(getKey));
          return [...previous, ...result.items.filter(item => !seen.has(getKey(item)))];
        });
        setPage(result.page);
        setTotal(result.total);
        setHasMore(result.hasMore);
      } catch (caught) {
        if (!isCurrent()) {
          return;
        }
        const appError = AppError.from(caught);
        log.error('page load failed', { page: targetPage, mode, kind: appError.kind });
        setError(appError);
        setFailedDuring(mode);
      } finally {
        // Only the load that is still current may say loading has finished; one
        // that was replaced must not clear the flags of the one that replaced it.
        if (requestIdRef.current === requestId) {
          inFlightRef.current = false;
          if (mountedRef.current) {
            setIsLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
          }
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
    // A failure is retried through `retry`, never by scrolling on past it.
    if (!hasMore || isLoadingMore || isLoading || isRefreshing || error) {
      return;
    }
    void load(page + 1, 'more');
  }, [hasMore, isLoadingMore, isLoading, isRefreshing, error, load, page]);

  const refresh = useCallback(() => {
    void load(AppConfig.pagination.initialPage, 'refresh');
  }, [load]);

  const retry = useCallback(() => {
    if (failedDuring === 'more') {
      // The page after the last one that arrived — never page one again, which
      // would throw away everything already on screen.
      void load(page + 1, 'more');
      return;
    }
    void load(AppConfig.pagination.initialPage, failedDuring === 'refresh' ? 'refresh' : 'load');
  }, [failedDuring, load, page]);

  return {
    items,
    error,
    failedDuring,
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
