/**
 * useVendorFigures
 *
 * The figures the vendor app reads on their own, away from the screens that
 * own them (Phase 3E-15, approved by the owner on 21/10/2026), composed on the
 * device from services that already exist — nothing new is asked of the
 * backend:
 *
 *   Dashboard → useVendorDashboard → useDashboardFigures → VendorReportService.getTodayRequests()
 *                                                        → useVendorRating
 *   Profile   →                      useVendorRating     → ReviewService.getVendorReviews()
 *
 * Written for section 30's Today's Requests and Rating on the dashboard; the
 * rating is also section 38's, on the Profile tab's reviews row (lead
 * decision, 21/10/2026). One read of it per screen, by the same hook, so the
 * two cannot be read differently.
 *
 * ⚠️ Each figure is its own read, kept apart from the others and from the
 * screen around it: its own single-flight query (`useSingleFlightQuery`) with
 * its own wait, failure and retry, so a slow or failed rating never holds back
 * today's figure, and neither can blank the work or the profile. Nothing here
 * waits for anything else.
 *
 * ⚠️ The figures are the services' and are shown as given. Today's requests is
 * `VendorReportService.getTodayRequests` — the `today` report's total, on the
 * mock and on the live backend alike (`ApiVendorReportService`). The rating is
 * the reviews' own average and count; nothing here averages the list it comes
 * with. Accepted and In Progress as
 * separate counts are not here: no existing answer carries them, and the
 * dashboard's own counts put both in `active` (see WORKING_NOTES open items).
 *
 * ⚠️ A failed read with a figure on screen keeps the figure (`useStaleState`);
 * the dashboard says once, for the page, that it may be out of date. A failed
 * read with nothing on screen is the figure's own `error` — which the profile
 * simply does not draw.
 *
 * Not read again when work changes (`VendorWorkSync`): answering a request
 * changes neither how many reached the vendor today nor what customers said.
 */

import { useCallback } from 'react';

import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { useStaleState } from '@/shared/hooks/useStaleState';
import { getService } from '@/shared/services/ServiceRegistry';
import type { VendorReviews } from '@/shared/services/types/ReviewService';
import type { VendorTodayRequests } from '@/shared/services/types/VendorReportService';
import type { AppError } from '@/shared/types/error';

/** One figure's read, as a screen draws it. */
export interface VendorFigureState<T> {
  /** The last answer. Undefined until the first read answers. */
  data: T | undefined;
  /** The first read, or a retry after it failed, is out. */
  isLoading: boolean;
  /** The read failed and there is nothing to show. Null whenever something is on screen. */
  error: AppError | null;
  /** Reads again from the placeholder. For the figure's own Try again. */
  retry: () => void;
  /**
   * The page's pull: reads again with the figure left on screen. With nothing
   * on screen the failure is cleared as it starts, and the dashboard's card
   * draws its placeholder until the answer (`DashboardFigure`) — never an
   * empty card.
   */
  refresh: () => void;
  /** Reads again showing nothing until the answer (the tab shown again). */
  refreshQuietly: () => void;
  isRefreshing: boolean;
  /** A figure is on screen and the read after it failed. */
  isStale: boolean;
  /** Why, for the page's notice. Null unless `isStale`. */
  staleError: AppError | null;
}

export interface DashboardFiguresState {
  /**
   * Today's requests (section 30), on their own (`getTodayRequests`): the
   * `today` report's total, the mock's or the backend's (Phase 4B, 24/11/2026).
   */
  today: VendorFigureState<VendorTodayRequests>;
  /** The vendor's average and count (section 30's Rating; section 41's figures). */
  rating: VendorFigureState<VendorReviews>;
}

function useFigure<T>(fetcher: () => Promise<T>): VendorFigureState<T> {
  const query = useSingleFlightQuery<T>(fetcher, []);

  const stale = useStaleState({
    hasData: query.data !== undefined,
    error: query.error,
    isRefreshing: query.isRefreshing,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: stale.error,
    retry: query.retry,
    refresh: query.refresh,
    refreshQuietly: query.refreshQuietly,
    isRefreshing: query.isRefreshing,
    isStale: stale.isStale,
    staleError: stale.staleError,
  };
}

/** The signed-in vendor's average and count, read on their own. */
export function useVendorRating(): VendorFigureState<VendorReviews> {
  return useFigure<VendorReviews>(useCallback(() => getService('review').getVendorReviews(), []));
}

/** Section 30's two figures for the dashboard, each its own read. */
export function useDashboardFigures(): DashboardFiguresState {
  const today = useFigure<VendorTodayRequests>(
    useCallback(() => getService('vendorReports').getTodayRequests(), []),
  );
  const rating = useVendorRating();

  return { today, rating };
}
