/**
 * ApiNotificationService
 *
 * NotificationService against the real backend: the signed-in account's in-app
 * inbox, for either role (PROJECT_BIBLE.md sections 57 and 80). Replaces
 * `MockNotificationService` with no change to the bell or the inbox.
 *
 * Endpoints: `POST /notifications/list` `{ page, limit }` (newest first, scoped
 * by the token to the caller's own account and role) and `POST
 * /notifications/read` `{ id }`. `GET /notifications` is the same handler but
 * reads its paging from a body a GET does not carry, so it is not used.
 *
 * Decisions:
 * - **Each row read by name**: `title`, `message` (the app's `body`),
 *   `createdAt`, `isRead` (the app's `read`), `type` passed through as the
 *   backend's opaque token. The backend sends no glyph, so `iconName` is
 *   absent and the card draws its fallback.
 * - **The link is built here, once, from the backend's own reference.** The
 *   backend sends no link, only `type` and `referenceId`; a `SERVICE_REQUEST`
 *   notification's reference is the request's id, which is exactly what the
 *   app's one link shape carries (`fixora://requests/<id>`,
 *   `notificationLinks.ts`). This is the service boundary translating the
 *   backend's contract, so nothing above it ever branches on `type`. Any other
 *   type, or no reference, has no link — it is marked read and opens nothing.
 * - **No unread count endpoint** (WORKING_NOTES: backend gap): the count is
 *   read from the inbox itself, every page up to `AppConfig.api.fullListMaxPages`
 *   — one request per hundred notifications, on each count. An inbox longer than
 *   that is counted in its newest part only, so the answer is a lower bound
 *   (`{ atLeast }`) and the bell says "at least", never a figure that may be
 *   wrong.
 * - **No mark-all endpoint** (backend gap): the unread ones are found the same
 *   way and marked one at a time, in order (newest first) — one request each.
 *   One that has gone in the meantime is skipped. It says nothing false about
 *   the result: every unread one marked → nothing; only the newest marked — the
 *   inbox was too long to read whole, or a mark failed after some had succeeded
 *   — → `{ complete: false }`; a failure before anything was marked rejects.
 *   Running it again finishes the rest (marking is idempotent).
 * - **No delete endpoint**: `remove` refuses clearly. Phase 1 never offers it.
 * - Push registration is Phase 2 (section 72): inert, exactly as the mock is.
 */

import { createLogger } from '@/core/logger/Logger';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import { notSupported } from '@/shared/services/api/notSupported';
import {
  optionalString,
  referenceId,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import type {
  AppNotification,
  MarkAllIncomplete,
  NotificationService,
  UnreadLowerBound,
} from '@/shared/services/types/NotificationService';
import { AppError } from '@/shared/types/error';
import type { Page, PageRequest } from '@/shared/types/pagination';

const log = createLogger('ApiNotificationService');

/** The backend's type for a notification about a service request. */
const REQUEST_NOTIFICATION_TYPE = 'SERVICE_REQUEST';

/** The app's one link shape (`notificationLinks.ts`), for a request's id. */
function requestLink(requestId: string): string {
  return `fixora://requests/${encodeURIComponent(requestId)}`;
}

function toNotification(raw: unknown): AppNotification {
  const record = requireRecord(raw, 'notification');
  const type = requireString(record, 'type', 'notification');
  const reference = referenceId(record.referenceId);
  const deepLink =
    type === REQUEST_NOTIFICATION_TYPE && reference ? requestLink(reference) : undefined;

  return {
    id: requireString(record, 'id', 'notification'),
    title: requireString(record, 'title', 'notification'),
    body: optionalString(record, 'message') ?? '',
    createdAt: requireString(record, 'createdAt', 'notification'),
    read: record.isRead === true,
    type,
    ...(deepLink ? { deepLink } : {}),
  };
}

export class ApiNotificationService extends BaseApiService implements NotificationService {
  constructor() {
    super('/notifications');
  }

  async list(request: PageRequest): Promise<Page<AppNotification>> {
    const page = await this.postPage('/list', {}, request);
    return { ...page, items: page.items.map(toNotification) };
  }

  async getUnreadCount(): Promise<number | UnreadLowerBound> {
    const { notifications, truncated } = await this.readInbox();
    const unread = notifications.filter(notification => !notification.read).length;
    return truncated ? { atLeast: unread } : unread;
  }

  async markAsRead(id: string): Promise<void> {
    await this.post<unknown>('/read', { id });
  }

  async markAllAsRead(): Promise<void | MarkAllIncomplete> {
    const { notifications, truncated } = await this.readInbox();
    const unread = notifications.filter(notification => !notification.read);
    let marked = 0;

    // One at a time, in order: a burst of parallel writes is the backend's to
    // invite with a bulk endpoint, not the app's to improvise.
    for (const notification of unread) {
      try {
        await this.markAsRead(notification.id);
        marked += 1;
      } catch (error) {
        if (error instanceof AppError && error.kind === 'notFound') {
          // Gone since it was listed: nothing left to mark.
          continue;
        }
        if (marked === 0) {
          // Nothing changed, so "not marked" is the truth.
          throw error;
        }
        // Some were marked: saying none were would be false, and so would "all".
        log.warn('Mark all stopped part way', { marked, of: unread.length, kind: AppError.from(error).kind });
        return { complete: false };
      }
    }

    log.info('Notifications marked read', { count: marked, truncated });
    return truncated ? { complete: false } : undefined;
  }

  async remove(_id: string): Promise<void> {
    throw notSupported('Removing a notification');
  }

  async registerDevice(deviceToken: string): Promise<void> {
    // Intentionally inert. Push is Phase 2 (section 72); FCM lands with its backend contract.
    log.debug('registerDevice is not connected yet', { hasToken: Boolean(deviceToken) });
  }

  async unregisterDevice(): Promise<void> {
    log.debug('unregisterDevice is not connected yet');
  }

  /**
   * The whole inbox, newest first, a page of the backend's ceiling at a time —
   * or, past the page ceiling, its newest part only (`truncated`).
   */
  private async readInbox(): Promise<{ notifications: AppNotification[]; truncated: boolean }> {
    const { items, truncated } = await this.postAllPages('/list', {});
    const seen = new Set<string>();

    // A notification arriving between two page reads shifts the next page by one.
    const notifications = items.map(toNotification).filter(notification => {
      if (seen.has(notification.id)) {
        return false;
      }
      seen.add(notification.id);
      return true;
    });
    return { notifications, truncated };
  }
}
