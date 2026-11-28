/**
 * ApiNotificationService
 *
 * NotificationService against the real backend: the signed-in account's in-app
 * inbox, for either role (PROJECT_BIBLE.md sections 57 and 80). Replaces
 * `MockNotificationService` with no change to the bell or the inbox.
 *
 * Endpoints: `POST /notifications/list` `{ page, limit }` (newest first, scoped
 * by the token to the caller's own account and role), `POST
 * /notifications/read` `{ id }`, `POST /notifications/delete` `{ id }`, and
 * — phase5-contract.md section 3 (T133, 28/11/2026) — `POST
 * /notifications/read-all` `{}` and `POST /notifications/delete-all` `{}`.
 * `GET /notifications` is the same handler as the list but reads its paging
 * from a body a GET does not carry, so it is not used.
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
 * - **Mark all and clear all are one request each** (contract §3), the
 *   backend's own bulk updates of the caller's inbox — every page, loaded or
 *   not. They answer `{ updated }` and `{ deleted }`; the app reads neither
 *   figure, because the inbox read afterwards is what it shows. ⚠️ Mark all
 *   used to be the app reading the inbox and marking the unread ones one at a
 *   time, which could stop part way and had to say "only the newest"; with
 *   the endpoint it cannot, so it either did everything or rejects.
 * - **Removing one** is the backend's soft delete (Phase 4B contract §8,
 *   24/11/2026): gone from the list after. One that is not in this inbox —
 *   another account's, the same id under the other role, already removed — is
 *   404 `NOTIFICATION_NOT_FOUND`, kind `notFound`, as the interface says; it is
 *   never confirmed to exist. Clearing all is the same soft delete for the
 *   whole inbox (contract §3).
 * - **The device's push token** (phase5-contract.md section 6.1, owner-approved
 *   28/11/2026) is `POST /devices/register` `{ token, platform }` and `POST
 *   /devices/unregister` `{ token }`, exactly those keys. They sit under
 *   `/devices`, not `/notifications`, so they go through `DeviceTokens`, a
 *   BaseApiService of their own, rather than this one's base path. Neither
 *   answer is read: `registered` and `removed` change nothing the app does, and
 *   unregistering a token that is not this account's is `removed: false`, never
 *   an error. Unregistering is part of signing out, so its 401 — a session the
 *   server already ended — is kept from the unauthorized handler, as
 *   `/auth/logout`'s is.
 */

import { BaseApiService } from '@/shared/services/api/BaseApiService';
import {
  optionalString,
  referenceId,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import type {
  AppNotification,
  NotificationService,
  PushDeviceRegistration,
  UnreadLowerBound,
} from '@/shared/services/types/NotificationService';
import type { Page, PageRequest } from '@/shared/types/pagination';

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

/** `/devices`: the push token endpoints, beside the inbox's own. */
class DeviceTokens extends BaseApiService {
  constructor() {
    super('/devices');
  }

  async register({ token, platform }: PushDeviceRegistration): Promise<void> {
    // The two keys the contract names and nothing else: whose device it is, is the token's.
    await this.post<unknown>('/register', { token, platform });
  }

  async unregister(token: string): Promise<void> {
    await this.post<unknown>('/unregister', { token }, { skipUnauthorizedHandler: true });
  }
}

export class ApiNotificationService extends BaseApiService implements NotificationService {
  private readonly devices = new DeviceTokens();

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

  async markAllAsRead(): Promise<void> {
    // An empty body, as the contract says: whose inbox it is, is the token's.
    await this.post<unknown>('/read-all', {});
  }

  async remove(id: string): Promise<void> {
    // 404 arrives as kind `notFound` (HttpClient): not in this inbox, whoever else has it.
    await this.post<unknown>('/delete', { id });
  }

  async removeAll(): Promise<void> {
    await this.post<unknown>('/delete-all', {});
  }

  registerDevice(device: PushDeviceRegistration): Promise<void> {
    return this.devices.register(device);
  }

  unregisterDevice(token: string): Promise<void> {
    return this.devices.unregister(token);
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
