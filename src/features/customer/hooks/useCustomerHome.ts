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
 */

import { useCallback, useMemo } from 'react';

import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth/state/authSlice';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useCategories } from '@/features/customer/hooks/useCategories';
import { useServiceQuery, type UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { ServiceCategory } from '@/shared/services/types/CategoryService';
import type { CustomerRequest } from '@/shared/services/types/RequestService';

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

export interface CustomerHome {
  greeting: string;
  /** First name alone: a greeting uses the name someone is called, not their record. */
  name: string;
  categories: UseServiceQueryResult<ServiceCategory[]>;
  requests: UseServiceQueryResult<CustomerRequest[]>;
  /** Pull-to-refresh. Refreshes both sections, because the gesture is the page's. */
  refresh: () => void;
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

  const { refresh: refreshCategories } = categories;
  const { refresh: refreshRequests } = requests;

  const refresh = useCallback(() => {
    refreshCategories();
    refreshRequests();
  }, [refreshCategories, refreshRequests]);

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

  return {
    greeting,
    name,
    categories,
    requests,
    refresh,
    isRefreshing: categories.isRefreshing || requests.isRefreshing,
  };
}
