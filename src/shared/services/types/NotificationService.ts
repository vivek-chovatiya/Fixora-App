/**
 * NotificationService
 *
 * The only route to notification data and, in future, to push notifications.
 *
 * Screens must never import a push SDK or touch a platform notification API.
 * The device-registration methods exist on this interface now, unimplemented in
 * the mock, so that adding FCM later changes only an implementation file.
 */

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
 * Scoped by the session: no call takes an account, and whose notifications
 * they are is whoever is signed in, of either role. With nobody signed in every
 * call is `unauthorized`; an id that is not in this account's inbox is
 * `notFound` — whether or not somebody else has it — so another inbox can be
 * neither changed nor discovered.
 */
export interface NotificationService {
  /** Newest first. The order is the service's; the app does not re-sort. */
  list(request: PageRequest): Promise<Page<AppNotification>>;
  getUnreadCount(): Promise<number>;
  /** Marking one that is already read succeeds and changes nothing. */
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  /** On the contract; nothing in Phase 1 offers it (the inbox only reads and marks). */
  remove(id: string): Promise<void>;

  /** Future push surface. Not implemented during the UI-first phase. */
  registerDevice(deviceToken: string): Promise<void>;
  unregisterDevice(): Promise<void>;
}
