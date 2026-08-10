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

export interface NotificationService {
  list(request: PageRequest): Promise<Page<AppNotification>>;
  getUnreadCount(): Promise<number>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  remove(id: string): Promise<void>;

  /** Future push surface. Not implemented during the UI-first phase. */
  registerDevice(deviceToken: string): Promise<void>;
  unregisterDevice(): Promise<void>;
}
