/**
 * Analytics
 *
 * Phase 1 tracks only the essential events (App PROJECT_BIBLE §54). Events go to
 * the logger until a provider is chosen; swapping providers changes only this file.
 * Tracking must never throw into business code.
 */

import { createLogger } from '@/core/logger/Logger';

const log = createLogger('Analytics');

export type AnalyticsEvent =
  | 'app_opened'
  | 'signup_completed'
  | 'login_completed'
  | 'category_selected'
  | 'subcategory_selected'
  | 'request_started'
  | 'vendor_selected'
  | 'vendor_selection_skipped'
  | 'request_created'
  | 'request_completed'
  | 'review_submitted'
  | 'vendor_signup'
  | 'vendor_approved'
  | 'request_viewed'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_accept_lost'
  | 'work_started'
  | 'work_completed';

export const Analytics = {
  track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
    try {
      log.info(event, properties);
    } catch {
      // Analytics must never interfere with business operations.
    }
  },
};
