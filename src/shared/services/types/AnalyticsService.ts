/**
 * AnalyticsService
 *
 * The only route to product analytics (PROJECT_BIBLE.md section 54).
 *
 * Section 54 asks for "only essential events", and the list is closed: an event
 * name is one of exactly the nineteen it names, so an event nobody approved
 * cannot be sent by a typo or a good idea at a call site — adding one is an edit
 * here, in review. Screen views, funnels, timings and user traits are absent on
 * purpose; they are the business intelligence section 78 puts in Phase 2.
 *
 * Every method is synchronous and returns nothing, and that is the contract that
 * carries section 54's last rule — analytics "must not interfere with business
 * operations". A caller never awaits it, so a slow provider cannot slow a sign
 * in; an implementation never throws, so a broken provider cannot fail one. A
 * real provider queues and sends in the background, behind this interface.
 *
 * Code reaches it through `trackEvent` / `identifyUser` in
 * `shared/services/telemetry.ts`, or `useAnalytics` in a component — never
 * through `getService`, which throws when nothing is registered.
 *
 * ⚠️ Properties are ids, counts, enums and flags — never personal data. No name,
 * phone number, email, address, location, note, review text or code of any
 * kind; a one-time code in particular must never be attached to an event
 * (section 7A). An analytics provider is a third party keeping its own copy
 * for years, and a phone number sent once cannot be called back. `trackEvent`
 * drops a key that looks personal, but that is a net under this rule, not the
 * rule.
 *
 * ⚠️ `vendor_approved` is listed because section 54 lists it, but nothing in the
 * app emits it. Approval was replaced by automatic activation (section 29,
 * superseded by 7A.2), which the backend performs — so it is the backend's event
 * to send, and a client sending it too would count every vendor twice.
 */

/** Section 54's customer events. `app_opened` is sent for either role. */
export type CustomerAnalyticsEvent =
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
  | 'review_submitted';

/** Section 54's vendor events. */
export type VendorAnalyticsEvent =
  | 'vendor_signup'
  | 'vendor_approved'
  | 'request_viewed'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_accept_lost'
  | 'work_started'
  | 'work_completed';

export type AnalyticsEventName = CustomerAnalyticsEvent | VendorAnalyticsEvent;

/**
 * What an event may carry.
 *
 * Flat, and primitive values only: nothing nested, so nothing can ride along
 * inside an object nobody looked into — a whole request or user record is
 * exactly how a phone number would end up in an event.
 */
export type AnalyticsProperties = Readonly<Record<string, string | number | boolean>>;

/**
 * Who the events that follow belong to.
 *
 * ⚠️ Id and role, and nothing else, ever. TypeScript accepts a whole `AuthUser`
 * where this is expected, so callers copy the two fields out rather than passing
 * the user along.
 */
export interface AnalyticsUser {
  id: string;
  role: string;
}

export interface AnalyticsService {
  /** Records one event. Fire and forget: never awaited, never throws. */
  track(event: AnalyticsEventName, properties?: AnalyticsProperties): void;

  /**
   * Attributes the events that follow to a signed-in user, or — with `null`,
   * on sign out — to nobody. Never throws.
   */
  identify(user: AnalyticsUser | null): void;
}
