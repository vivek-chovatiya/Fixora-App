/**
 * useVendorReviews
 *
 * The signed-in vendor's reviews, and the seam the Reviews screen is allowed to
 * touch (PROJECT_BIBLE.md section 41, Phase 3E-6).
 *
 *   Screen → hook → ReviewService.getVendorReviews → implementation
 *
 * One read, with no argument: whose reviews they are is the session's to say,
 * so nothing a route or a caller holds can point it at another vendor.
 *
 * ⚠️ One request at a time, and the guard cannot stick — the request list's
 * `useSingleFlightQuery` (Phase 3E-3), released in a `finally` when the call
 * settles. Pressing Try again five times, or pulling while it loads, sends one
 * read.
 *
 * ⚠️ A failed pull says so, as on the request list. The shared query keeps what
 * was read when a refresh fails, which is right, but keeps it silently; `isStale`
 * is true in exactly that case so the screen can say the reviews may be out of
 * date. A failed *first* read has nothing to keep and is an `error`. The rule is
 * the shared `useStaleState`; the shared queries are unchanged.
 *
 * Not re-read when work changes (`VendorWorkSync`): finishing a job does not
 * write a review — the customer does, on their own phone — so there is nothing
 * for that signal to say here.
 */

import { useCallback } from 'react';

import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { useStaleState } from '@/shared/hooks/useStaleState';
import { getService } from '@/shared/services/ServiceRegistry';
import type { VendorReviews } from '@/shared/services/types/ReviewService';
import type { AppError } from '@/shared/types/error';

export interface VendorReviewsState {
  /** Undefined until the first read answers. */
  reviews: VendorReviews | undefined;
  /** True for the first read and for a retry after it failed. */
  isLoading: boolean;
  /** The first read failed and there is nothing to show. */
  error: AppError | null;
  /** Reads again, showing the loading state. For the error's Try again. */
  retry: () => void;

  /** Pull-to-refresh: reads again with the reviews left on screen. */
  refresh: () => void;
  isRefreshing: boolean;
  /** The last refresh failed; what is on screen is from before it. */
  isStale: boolean;
  /** Why the refresh failed, for the notice. Null unless `isStale`. */
  staleError: AppError | null;
}

export function useVendorReviews(): VendorReviewsState {
  const query = useSingleFlightQuery<VendorReviews>(
    useCallback(() => getService('review').getVendorReviews(), []),
    [],
  );

  // With reviews on screen a failure is a stale list, not an error page.
  const stale = useStaleState({
    hasData: query.data !== undefined,
    error: query.error,
    isRefreshing: query.isRefreshing,
  });

  return {
    reviews: query.data,
    isLoading: query.isLoading,
    error: stale.error,
    retry: query.retry,
    refresh: query.refresh,
    isRefreshing: query.isRefreshing,
    isStale: stale.isStale,
    staleError: stale.staleError,
  };
}
