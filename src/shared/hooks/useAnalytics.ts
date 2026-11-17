/**
 * useAnalytics
 *
 * How a screen, component or feature hook records one of PROJECT_BIBLE.md
 * section 54's events — without touching the registry, which a screen never
 * does (CLAUDE.md section 4).
 *
 *   const { track } = useAnalytics();
 *   track('vendor_selected', { vendorId });
 *
 * `track` is `trackEvent` from `shared/services/telemetry.ts`, so it inherits
 * every rule that file keeps: it returns nothing and is never awaited, it never
 * throws, it does nothing when no analytics service is registered (a test that
 * reset the registry keeps working), and it drops a property whose key looks
 * personal.
 *
 * ⚠️ The result is the same object on every render, so `track` is safe in a
 * dependency array and can never be the reason an effect re-runs. Keep it that
 * way: an event inside an effect that re-ran on every render would be sent on
 * every render.
 *
 * It is a hook rather than a plain import so that a provider needing React
 * context later changes this file and no call site.
 */

import { trackEvent } from '@/shared/services/telemetry';
import type {
  AnalyticsEventName,
  AnalyticsProperties,
} from '@/shared/services/types/AnalyticsService';

export interface UseAnalyticsResult {
  /** Records one event. Fire and forget: returns nothing, never throws. */
  track: (event: AnalyticsEventName, properties?: AnalyticsProperties) => void;
}

const ANALYTICS: UseAnalyticsResult = Object.freeze({ track: trackEvent });

export function useAnalytics(): UseAnalyticsResult {
  return ANALYTICS;
}
