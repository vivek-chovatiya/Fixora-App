/**
 * NotificationService
 *
 * The only route to notification data, and to telling the backend which
 * device receives an account's push notifications.
 *
 * Screens must never import a push SDK or touch a platform notification API.
 * The device's own side of push — its token and the messages it receives — is
 * `PushService`; this holds the two backend calls that pair a token with the
 * signed-in account (phase5-contract.md section 6.1, owner-approved
 * 28/11/2026). They were a seam here through Phase 1, so connecting them
 * changed implementations and nothing that calls this.
 */

import type { PushPlatform } from '@/shared/services/types/PushService';
import type { Page, PageRequest } from '@/shared/types/pagination';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  read: boolean;
  /**
   * Backend-defined type token. The app must not branch on specific values —
   * doing so would hardcode business categories into the client.
   */
  type: string;
  /** Glyph name supplied by the backend; resolve via `resolveRemoteIcon`. */
  iconName?: string;
  /** Target route for future deep linking. */
  deepLink?: string;
}

/**
 * The unread count when the inbox was too long to count whole: at least
 * `atLeast` unread, perhaps more. The bell says "at least" rather than a figure
 * that may be wrong (code review, 17/11/2026).
 */
export interface UnreadLowerBound {
  atLeast: number;
}

/**
 * Scoped by the session: no call takes an account, and whose notifications
 * they are is whoever is signed in, of either role. With nobody signed in every
 * call is `unauthorized`; an id that is not in this account's inbox is
 * `notFound` — whether or not somebody else has it — so another inbox can be
 * neither changed nor discovered.
 *
 * ⚠️ Marking all and removing all are each one call that does the whole inbox
 * (phase5-contract.md section 3, T133, 28/11/2026) — including pages the app
 * never loaded. Before it, "mark all" was the app marking one at a time and
 * could stop part way; it no longer can, so it either did everything or
 * rejects.
 */
export interface NotificationService {
  /** Newest first. The order is the service's; the app does not re-sort. */
  list(request: PageRequest): Promise<Page<AppNotification>>;
  /** The exact count, or `UnreadLowerBound` when it could not be counted whole. */
  getUnreadCount(): Promise<number | UnreadLowerBound>;
  /** Marking one that is already read succeeds and changes nothing. */
  markAsRead(id: string): Promise<void>;
  /** Every unread one in this account's inbox is read after it. */
  markAllAsRead(): Promise<void>;
  /**
   * Takes one out of the inbox for good — the swipe on a row. One that is
   * already gone is `notFound`, which for a removal means what was asked for
   * is already true.
   */
  remove(id: string): Promise<void>;
  /** Empties this account's inbox — "Clear all". An empty inbox succeeds. */
  removeAll(): Promise<void>;

  /**
   * Pairs this device's push token with the signed-in account
   * (`POST /devices/register` `{ token, platform }`). Registering it again
   * refreshes it; registering it from another account moves it there.
   *
   * ⚠️ The token is a credential for the device: sent here and nowhere else.
   */
  registerDevice(device: PushDeviceRegistration): Promise<void>;
  /**
   * Stops this token receiving the signed-in account's pushes
   * (`POST /devices/unregister` `{ token }`). A token that is not the
   * account's succeeds and changes nothing — it is never confirmed to exist.
   * Called while signing out, before the session ends.
   */
  unregisterDevice(token: string): Promise<void>;
}

/** What `registerDevice` sends: the token, and which platform issued it. */
export interface PushDeviceRegistration {
  token: string;
  platform: PushPlatform;
}
