/**
 * useCustomerHome
 *
 * Everything Customer Home needs, and the seam the screen is allowed to touch.
 *
 *   Screen → hook → service interface → implementation
 *
 * The screen calling `getService` itself would break that chain and have to be
 * rewritten when the backend lands.
 *
 * ⚠️ Two independent queries, deliberately not merged into one. Categories and
 * recent requests come from different backends' worth of concern and fail
 * separately, and a single combined state would mean one slow or broken call
 * blanking a section that had already arrived. Each section owns its own
 * loading, empty and error state; the screen itself is never blank, because the
 * greeting and the primary action need no data at all.
 *
 * ⚠️ A failed pull keeps what each section had and says so once, for the page.
 * Before, a refresh that failed replaced a section that was working with an
 * error — the shared query keeps the old data but reports the failure, and both
 * sections drew the failure first. Now a section's `error` is only a failure that
 * left it with nothing to show; a failure with something on screen is
 * `isStale` (the shared `useStaleState` rule, section by section), and the
 * screen draws the vendor lists' notice (3E-3) above the sections with a Try
 * again that pulls again. The shared query is unchanged.
 *
 * ⚠️ The recent requests are read again when Request Details changes one
 * (`customerRequestSync`) — Home stays mounted under it, and a cancelled request
 * must not come back to a card still saying "Searching". Only the requests: a
 * cancellation does not change the catalogue.
 *
 * ⚠️ The bell's unread count is read here too (`useUnreadNotifications`), so
 * the pull re-reads it with everything else. It used to be the screen's own,
 * and a pull left the badge as it was until the next focus (open item, 3F-2).
 * It never joins `isRefreshing` or the stale notice: a badge is a hint, and a
 * failed read is no badge, never a failure on this page.
 *
 * Whether there is a request to resume is decided here, whole: one that was
 * emptied back out is not offered (`isDraftWorthKeeping`). That check used to
 * sit in the screen, only because this hook was being edited by another slice
 * that night (3G-2).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth/state/authSlice';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { formatRequestDate } from '@/features/customer/constants/requestPresentation';
import { useCategories } from '@/features/customer/hooks/useCategories';
import { onCustomerRequestsChanged } from '@/features/customer/state/customerRequestSync';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import {
  isDraftWorthKeeping,
  type RequestDraft,
  type RequestDraftStep,
} from '@/features/customer/state/requestDraft';
import { useUnreadNotifications } from '@/features/notifications/hooks/useUnreadNotificationCount';
import { useServiceQuery, type UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import { useStaleState } from '@/shared/hooks/useStaleState';
import { getService } from '@/shared/services/ServiceRegistry';
import type { ServiceCategory } from '@/shared/services/types/CategoryService';
import type { CustomerRequest } from '@/shared/services/types/RequestService';
import type { AppError } from '@/shared/types/error';

/**
 * How many recent requests Home asks for.
 *
 * Sent to the service rather than trimmed after it arrives: this screen shows a
 * summary and hands off to the full history, so fetching a page and discarding
 * most of it would be paying for records there is no room to draw.
 */
export const HOME_RECENT_REQUEST_LIMIT = 3;

/** Hour boundaries for the greeting. Local time, which is the user's own day. */
const AFTERNOON_FROM = 12;
const EVENING_FROM = 17;

/**
 * Which greeting suits the time of day.
 *
 * Exported and taking its clock as a parameter so it can be checked at every
 * boundary without a test having to pretend to be a clock.
 */
export function greetingFor(now: Date = new Date()): string {
  const hour = now.getHours();

  if (hour < AFTERNOON_FROM) {
    return CUSTOMER_COPY.home.greetingMorning;
  }

  return hour < EVENING_FROM
    ? CUSTOMER_COPY.home.greetingAfternoon
    : CUSTOMER_COPY.home.greetingEvening;
}

/**
 * The request waiting to be picked back up, if there is one.
 *
 * Assembled here rather than on the screen because the pieces are already here:
 * the category's name comes out of the catalogue query Home runs anyway, so
 * naming the waiting request costs nothing extra. Asking the sub-category
 * service for the exact service name would cost a second round trip to caption a
 * card, which is not a trade worth making.
 */
export interface ResumableRequest {
  draft: RequestDraft;
  /** The category, once the catalogue has answered. */
  categoryName?: string;
  /** How long ago it was left, already worded. */
  startedLabel: string;
  /** The first screen that still needs the customer. */
  step: RequestDraftStep;
}

export interface CustomerHome {
  greeting: string;
  /** First name alone: a greeting uses the name someone is called, not their record. */
  name: string;
  /** `error` only when the section has nothing to show; see `isStale` for the rest. */
  categories: UseServiceQueryResult<ServiceCategory[]>;
  /** `error` only when the section has nothing to show; see `isStale` for the rest. */
  requests: UseServiceQueryResult<CustomerRequest[]>;
  /**
   * The last pull failed for a section that still shows what it had, so what is
   * on screen is from before it. One flag for the page, because the pull is the
   * page's.
   */
  isStale: boolean;
  /** Why it failed, for the notice. Null unless `isStale`. */
  staleError: AppError | null;
  /**
   * Null when there is nothing to resume, and also while storage is still being
   * read — an offer that appears a moment after the screen has been taken in is
   * worse than one that was never there. Null too for a draft the form has
   * emptied back out: the context keeps one in memory while the form that
   * emptied it may still be writing to it, and offering it would be offering
   * to resume nothing.
   */
  resume: ResumableRequest | null;
  /** The bell's unread count; null while unknown, which draws no badge. */
  unreadNotifications: number | null;
  /** The count is a floor (the inbox was too long to count whole). */
  unreadIsLowerBound: boolean;
  /**
   * Pull-to-refresh. Refreshes both sections and the bell's count, because the
   * gesture is the page's.
   */
  refresh: () => void;
  /** The sections' reads only — the badge's read draws no spinner of its own. */
  isRefreshing: boolean;
}

export function useCustomerHome(): CustomerHome {
  const user = useAppSelector(selectCurrentUser);

  // Shared with the categories screen, so the two cannot end up asking the
  // catalogue for different things.
  const categories = useCategories();

  const requests = useServiceQuery<CustomerRequest[]>(
    () => getService('request').listRecentRequests(HOME_RECENT_REQUEST_LIMIT),
    [],
  );

  /*
    The bell (section 57), read on arrival, on every return and after every
    mark by its own hook — and on the pull below, which is why it is here
    rather than on the screen.
  */
  const unread = useUnreadNotifications();

  const { refresh: refreshCategories } = categories;
  const { refresh: refreshRequests, retry: retryRequests } = requests;
  const { refresh: refreshUnread } = unread;

  const refresh = useCallback(() => {
    refreshCategories();
    refreshRequests();
    refreshUnread();
  }, [refreshCategories, refreshRequests, refreshUnread]);

  /*
    A request changed on the screen above: read the recent ones again.

    With cards on screen, under them, as a pull does. With none yet — the first
    read still out, or failed — from the start, with its placeholders: a refresh
    there clears the failure and the loading flag together, and the section
    would draw "You don't have any service requests yet" over a read in flight.
  */
  const hasRecent = useRef(false);
  hasRecent.current = requests.data !== undefined;

  useEffect(
    () =>
      onCustomerRequestsChanged(() => {
        if (hasRecent.current) {
          refreshRequests();
        } else {
          retryRequests();
        }
      }),
    [refreshRequests, retryRequests],
  );

  /*
    Recomputed per render rather than held in state.

    The greeting depends on the clock, and a value captured once would be stale
    for anyone who leaves the app open across noon — which on a home screen is
    most people. It is a string comparison against three constants, not work
    worth remembering.
  */
  const greeting = greetingFor();

  const name = useMemo(
    () => user?.firstName?.trim() || CUSTOMER_COPY.home.greetingFallbackName,
    [user],
  );

  const { draft, isRestored, savedAt, completion } = useRequestDraft();

  const resume = useMemo<ResumableRequest | null>(() => {
    // The same rule that decides whether a draft is saved decides whether it
    // is offered.
    if (!isRestored || !draft || !completion || !isDraftWorthKeeping(draft)) {
      return null;
    }

    return {
      draft,
      categoryName: categories.data?.find(category => category.id === draft.categoryId)?.name,
      // The same relative wording the request cards use, so "2 hr ago" means the
      // same thing everywhere on this screen.
      startedLabel: savedAt ? formatRequestDate(savedAt) : '',
      step: completion.step,
    };
  }, [isRestored, draft, completion, savedAt, categories.data]);

  // The catalogue's hook already tells a failed pull from a failed first read;
  // the recent requests are told apart by the same rule here.
  // With cards on screen a failure is a stale list, not an error in their place.
  const recentStale = useStaleState({
    hasData: requests.data !== undefined,
    error: requests.error,
    isRefreshing: requests.isRefreshing,
  });

  return {
    greeting,
    name,
    categories,
    requests: { ...requests, error: recentStale.error, isError: recentStale.error !== null },
    isStale: categories.isStale || recentStale.isStale,
    staleError: categories.staleError ?? recentStale.staleError,
    resume,
    unreadNotifications: unread.count,
    unreadIsLowerBound: unread.isLowerBound,
    refresh,
    isRefreshing: categories.isRefreshing || requests.isRefreshing,
  };
}
