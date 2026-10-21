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
 *
 * ⚠️ `refreshQuietly` (Phase 3E-15, owner decision 21/10/2026) is the list
 * checking again by itself when its tab is shown again, and it must look like
 * nothing happened until it has an answer: no placeholders, no spinner, the
 * failure from before left in place, and the scroll position kept.
 *
 * - It reads every page on screen, not page one alone, which would cut a list
 *   scrolled into its third page back to its first under the customer's thumb.
 * - ⚠️ Page by page, at the list's own page size — the same requests a
 *   customer scrolling would make — never one request for all of them. One
 *   long page would lean on the backend accepting a page size it never agreed
 *   to (any limit it sets would fail every return to a long list); this asks
 *   nothing a scroll does not. The price is one request per page shown on each
 *   return. It stops early at a page that says there is no more, and the list
 *   is swapped in whole only when the last page lands — never page one over a
 *   list still showing pages two and three. Superseded (a filter, a pull, a
 *   retry) or unmounted part-way, it is dropped without a word.
 * - The page counter, `hasMore` and `total` are what it actually read, so the
 *   next "load more" asks for the page after them.
 * - It never starts beside a load in the air, and it never holds a press back:
 *   a pull or Try again (whatever had failed) starts at once with its own
 *   placeholder or spinner, and the quiet read is dropped. A tap is never
 *   swallowed. A next page asked for by scrolling while it is out is not lost
 *   either: one is held, and asked for once the quiet read lands — if there is
 *   still more and nothing newer has replaced the read.
 * - A failure is reported as the pull it stands in for (`refresh`), or as a
 *   first load when nothing was on screen, so `retry` does what it would have
 *   done — except that a next page that had already failed stays the failure:
 *   `retry` still carries on from the page after the last one that arrived.
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
  /**
   * Reads every page on screen again, one by one, showing nothing until the
   * last lands. Does nothing while any load is in the air. For a screen reading
   * again on its own, never for a gesture.
   */
  refreshQuietly: () => void;
}

/** `previous` with the items of `next` it does not already hold, in order. */
function appendUnseen<T>(previous: T[], next: T[], getKey: ((item: T) => string) | undefined): T[] {
  if (!getKey) {
    return [...previous, ...next];
  }

  const seen = new Set(previous.map(getKey));
  return [...previous, ...next.filter(item => !seen.has(getKey(item)))];
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

  /** Read by a quiet read, which must know what is on screen when it starts and when it fails. */
  const shownRef = useRef<{ hasItems: boolean; page: number }>({
    hasItems: false,
    page: AppConfig.pagination.initialPage,
  });
  shownRef.current = { hasItems: items.length > 0, page };

  /** A quiet read is out, and is the newest read. */
  const quietRef = useRef(false);
  /** A next page was asked for while it was out: one, asked for when it lands. */
  const moreHeldRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (targetPage: number, mode: LoadMode) => {
      // The next page waits its turn; a new question does not. Nor does a press
      // over a quiet read: Try again on a failed next page goes ahead, and the
      // quiet read is dropped (only `loadMore` itself is held for it, below).
      if (mode === 'more' && inFlightRef.current && !quietRef.current) {
        return;
      }
      inFlightRef.current = true;
      // Anything started here is newer than a quiet read still out, and than the page it held.
      quietRef.current = false;
      moreHeldRef.current = false;

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

        setItems(previous =>
          mode === 'more' ? appendUnseen(previous, result.items, getKeyRef.current) : result.items,
        );
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

  /*
    The quiet read. No flag is set while it is out — nothing on screen moves
    until the last page lands — and nothing is cleared, so a stale failure stays
    where it is until there is an answer to replace it.
  */
  const readQuietly = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    quietRef.current = true;
    moreHeldRef.current = false;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isCurrent = () => mountedRef.current && requestIdRef.current === requestId;

    const first = AppConfig.pagination.initialPage;
    const { hasItems, page: reached } = shownRef.current;
    const pagesShown = hasItems ? reached - first + 1 : 1;

    // The page after what was read, when a next page was held for it.
    let nextPage: number | null = null;

    try {
      let read: T[] = [];
      let last: Page<T> | undefined;
      for (let target = first; target < first + pagesShown; target += 1) {
        const result = await fetchRef.current({ page: target, pageSize });
        if (!isCurrent()) {
          return;
        }
        read = appendUnseen(read, result.items, getKeyRef.current);
        last = result;
        if (!result.hasMore) {
          break;
        }
      }

      if (last) {
        setItems(read);
        setPage(last.page);
        setTotal(last.total);
        setHasMore(last.hasMore);
        setError(null);
        setFailedDuring(null);
        if (moreHeldRef.current && last.hasMore) {
          nextPage = last.page + 1;
        }
      }
    } catch (caught) {
      if (!isCurrent()) {
        return;
      }
      const appError = AppError.from(caught);
      log.error('quiet read failed', { pagesShown, kind: appError.kind });
      setError(appError);
      // A next page that already failed stays the failure; with nothing on
      // screen a retry must start from placeholders, as after a first load.
      const standsInFor: LoadMode = shownRef.current.hasItems ? 'refresh' : 'load';
      setFailedDuring(current => current ?? standsInFor);
    } finally {
      if (requestIdRef.current === requestId) {
        inFlightRef.current = false;
        quietRef.current = false;
        moreHeldRef.current = false;
      }
    }

    if (nextPage !== null && isCurrent()) {
      // `.catch` rather than `void`: the lint baseline (WORKING_NOTES section 5) does not grow.
      load(nextPage, 'more').catch(() => undefined);
    }
  }, [load, pageSize]);

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
    // Held, not dropped, while a quiet read is out: it lands as the page counter moves.
    if (quietRef.current) {
      moreHeldRef.current = true;
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

  const refreshQuietly = useCallback(() => {
    if (!enabled) {
      return;
    }
    // Started, not awaited: it settles every read itself. `.catch` rather than
    // `void`, so the lint baseline (WORKING_NOTES section 5) does not grow.
    readQuietly().catch(() => undefined);
  }, [enabled, readQuietly]);

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
    refreshQuietly,
  };
}
