/**
 * useVendorDashboard
 *
 * Everything the vendor dashboard needs, and the seam the screen is allowed to
 * touch (PROJECT_BIBLE.md section 30, Phase 3E-2).
 *
 *   Screen → hook → VendorDashboardService → implementation
 *
 * ⚠️ Two sources, kept apart. Who the vendor is — the business, its services,
 * its area — comes from the profile the vendor tree already holds
 * (`VendorProfileContext`), so the header and the business card need no request
 * of their own and are on screen before the work has loaded. The work comes
 * from `VendorDashboardService`. A slow or failed dashboard call therefore
 * darkens the work and nothing else, which is what keeps this screen from ever
 * being blank (section 47).
 *
 * The category names are a third, smaller query and fail quietly: a business
 * card without its services named is still a business card.
 *
 * One retry at a time. `useServiceQuery` already discards a superseded answer;
 * the guard here stops a second press from sending a second request at all.
 *
 * ⚠️ Read again when the work changes (Phase 3E-4). The dashboard stays mounted
 * behind the Requests tab, and a request accepted there is one fewer waiting and
 * one more under way here. `VendorWorkSync` says when; the counts are then the
 * service's again, not adjusted here — the dashboard still never decides which
 * group a request is in. The read is a refresh, so what is on screen stays
 * until the new answer replaces it, and a read already in the air is superseded
 * rather than waited for: it may have started before the change.
 *
 * Since Phase 3E-15 (owner-approved, 21/10/2026) three more things live here:
 *
 * - Section 30's Today's Requests and Rating (`useDashboardFigures`), each its
 *   own read with its own wait, failure and retry, beside the work and never
 *   in its way.
 * - The bell's count (`useUnreadNotifications`), so the pull — the page's
 *   gesture — reads everything on the page, the badge included. It used to
 *   read the work alone and leave the badge to the next focus.
 * - ⚠️ A quiet read when the Dashboard tab is shown again — not on arrival,
 *   which the mount has just read (`useNavigationEvent`, `onlyOnReturn`).
 *   Quiet: no placeholders, no spinner, what is on screen kept until each
 *   answer; a read already in the air is not joined by a second
 *   (`refreshQuietly`). The bell reads itself on every return already.
 *
 * ⚠️ A failed read with something on screen keeps it and says so, once, for
 * the page (`isStale`) — the work, today's requests or the rating, after a
 * pull or a quiet read alike. Before this, a failed pull here said nothing.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useUnreadNotifications } from '@/features/notifications/hooks/useUnreadNotificationCount';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useCategoryNames } from '@/features/vendor/hooks/useCategoryNames';
import {
  useDashboardFigures,
  type VendorFigureState,
} from '@/features/vendor/hooks/useVendorFigures';
import { useVendorProfile } from '@/features/vendor/state/VendorProfileContext';
import { useVendorWorkSync } from '@/features/vendor/state/VendorWorkSync';
import { useNavigationEvent } from '@/shared/hooks/useNavigationEvent';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { useStaleState } from '@/shared/hooks/useStaleState';
import { getService } from '@/shared/services/ServiceRegistry';
import type { VendorReviews } from '@/shared/services/types/ReviewService';
import type { VendorDashboard } from '@/shared/services/types/VendorDashboardService';
import type { VendorProfile } from '@/shared/services/types/VendorProfileService';
import type { VendorTodayRequests } from '@/shared/services/types/VendorReportService';
import type { AppError } from '@/shared/types/error';

const COPY = VENDOR_COPY.dashboard;

/**
 * How many jobs each section previews.
 *
 * Three reads as a list without turning the dashboard into the request list —
 * the same number customer Home settles on for the same reason.
 */
export const DASHBOARD_PREVIEW_LIMIT = 3;

/** Hour boundaries for the greeting. Local time, which is the vendor's own day. */
const AFTERNOON_FROM = 12;
const EVENING_FROM = 17;

/** Which greeting suits the time of day. The clock is a parameter so it can be tested. */
export function vendorGreetingFor(now: Date = new Date()): string {
  const hour = now.getHours();

  if (hour < AFTERNOON_FROM) {
    return COPY.greetingMorning;
  }
  return hour < EVENING_FROM ? COPY.greetingAfternoon : COPY.greetingEvening;
}

export interface VendorDashboardState {
  greeting: string;
  /** The owner's first name: a greeting uses the name someone is called. */
  name: string;
  /** The business, from the profile. Undefined only in the moment before sign-out unmounts the tree. */
  profile: VendorProfile | undefined;
  /** The business's services by name, in the vendor's order. Empty until they load. */
  categoryNames: string[];

  /** The work. Undefined until the first load answers. */
  dashboard: VendorDashboard | undefined;
  isLoading: boolean;
  /** Set when the work could not be loaded. */
  error: AppError | null;
  retry: () => void;

  /** Section 30's Today's Requests: today's report, read on its own. */
  today: VendorFigureState<VendorTodayRequests>;
  /** Section 30's Rating: the reviews' average and count, read on its own. */
  rating: VendorFigureState<VendorReviews>;
  /** The bell's unread count, or null while it is unknown. A failure is no badge. */
  unreadNotifications: number | null;
  /** The count is a floor (the inbox was too long to count whole): the bell says "9+" / "at least". */
  unreadIsLowerBound: boolean;

  /** Pull-to-refresh: the page's gesture, so it re-reads everything on it — the badge too. */
  refresh: () => void;
  isRefreshing: boolean;
  /** Something on the page is from before a read that failed: the work, today's figure or the rating. */
  isStale: boolean;
  /** Why, for the notice. Null unless `isStale`. */
  staleError: AppError | null;
}

export function useVendorDashboard(): VendorDashboardState {
  const { profile } = useVendorProfile();
  const categories = useCategoryNames(profile?.serviceCategoryIds ?? []);

  const query = useServiceQuery<VendorDashboard>(
    useCallback(() => getService('vendorDashboard').getDashboard(DASHBOARD_PREVIEW_LIMIT), []),
    [],
  );
  const { retry: retryQuery, refresh: refreshQuery, isLoading, data, error } = query;

  /*
    State lands a render late, and two quick presses can both get in before
    `isLoading` says so — the ref is what actually refuses the second one.

    ⚠️ Released by the answer, not by `isLoading`. A retry that fails at once
    sets loading and clears it in the same render, so `isLoading` is never seen
    to change and a guard waiting on it would stay shut for good — Try again
    would work exactly once. Every answer is a new object, success or failure,
    so that is what reopens it.
  */
  const retrying = useRef(false);
  useEffect(() => {
    retrying.current = false;
  }, [data, error]);

  const retry = useCallback(() => {
    if (retrying.current) {
      return;
    }
    retrying.current = true;
    retryQuery();
  }, [retryQuery]);

  // The work changed on another screen: read it again. Not on the first render — that read is the load.
  const { revision } = useVendorWorkSync();
  const readAt = useRef(revision);
  useEffect(() => {
    if (readAt.current === revision) {
      return;
    }
    readAt.current = revision;
    refreshQuery();
  }, [refreshQuery, revision]);

  const { today, rating } = useDashboardFigures();
  const {
    count: unreadNotifications,
    isLowerBound: unreadIsLowerBound,
    refresh: refreshUnread,
  } = useUnreadNotifications();

  const { retry: retryCategories, error: categoriesError } = categories;
  const { refresh: refreshToday, refreshQuietly: refreshTodayQuietly } = today;
  const { refresh: refreshRating, refreshQuietly: refreshRatingQuietly } = rating;
  const refresh = useCallback(() => {
    refreshQuery();
    refreshToday();
    refreshRating();
    refreshUnread();
    // Only when they failed: the names do not change between pulls.
    if (categoriesError) {
      retryCategories();
    }
  }, [categoriesError, refreshQuery, refreshRating, refreshToday, refreshUnread, retryCategories]);

  // The tab shown again: everything read again under what is on screen. Not on arrival.
  const { refreshQuietly: refreshWorkQuietly } = query;
  const readQuietly = useCallback(() => {
    refreshWorkQuietly();
    refreshTodayQuietly();
    refreshRatingQuietly();
  }, [refreshRatingQuietly, refreshTodayQuietly, refreshWorkQuietly]);
  useNavigationEvent('focus', readQuietly, { onlyOnReturn: true });

  // With the work on screen a failed read is a stale page, not an error; the figures' own rule is theirs.
  const work = useStaleState({
    hasData: data !== undefined,
    error,
    isRefreshing: query.isRefreshing,
  });
  const staleError = work.staleError ?? today.staleError ?? rating.staleError;

  const name = useMemo(
    () => profile?.ownerName.trim().split(/\s+/)[0] || COPY.greetingFallbackName,
    [profile],
  );

  return {
    // Per render, not held: a dashboard left open across noon should notice.
    greeting: vendorGreetingFor(),
    name,
    profile,
    categoryNames: categories.names,
    dashboard: data,
    isLoading,
    error,
    retry,
    today,
    rating,
    unreadNotifications,
    unreadIsLowerBound,
    refresh,
    // The pull's spinner stays while any of the page's reads it started is out.
    isRefreshing: query.isRefreshing || today.isRefreshing || rating.isRefreshing,
    isStale: staleError !== null,
    staleError,
  };
}
