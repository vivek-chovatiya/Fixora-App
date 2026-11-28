/**
 * MockNotificationService
 *
 * Stands in for the notification endpoints until they exist (PROJECT_BIBLE.md
 * sections 57 and 80; push is section 72's, and Phase 2). It behaves like a
 * backend rather than like a convenience:
 *
 * - it answers from the session: every call reads who is signed in, and with
 *   nobody signed in it refuses (`unauthorized`), as an authenticated endpoint
 *   would;
 * - each account has its own inbox, by user id, so a vendor never sees a
 *   customer's notifications and one customer never sees another's;
 * - a notification that is not in this account's inbox is `notFound` —
 *   including one in somebody else's — so another inbox can be neither changed
 *   nor discovered;
 * - it re-checks the page it is asked for, and answers newest first.
 *
 * ⚠️ It used to be one in-memory list for whoever asked, which let any account
 * read and mark everybody's notifications. Scoping it is what makes the inbox
 * honest about whose it is.
 *
 * ⚠️ Memory only, deliberately. Each inbox starts from `mockNotificationData`
 * the first time its account asks, and what is marked read stays read — and
 * what is removed, one or all (phase5-contract.md section 3), stays removed —
 * for the life of the app; a restart brings the fixtures back. Nothing here is
 * the account's own record the way an address book or a team is, so it is not
 * worth a storage key and a schema that go when the mock does. A change is one
 * synchronous step after the session is known, so two calls in flight cannot
 * lose each other's marks.
 *
 * The push token calls (phase5-contract.md section 6.1, owner-approved
 * 28/11/2026) answer as the backend does, in memory: a token belongs to one
 * account at a time and registering it from another moves it; unregistering
 * removes only the caller's own and succeeds either way; nobody signed in is
 * `unauthorized`; a blank or over-long token, or a platform other than
 * android/ios, is `validation`. Nothing is pushed — there is nothing here to
 * push from — so it only proves the app calls them when it should.
 *
 * Replacing this with an ApiNotificationService requires no change to any screen.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import type { AuthUser } from '@/features/auth/types';
import { mockInboxFor } from '@/shared/services/mock/mockNotificationData';
import { NO_LATENCY, simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import type {
  AppNotification,
  NotificationService,
  PushDeviceRegistration,
} from '@/shared/services/types/NotificationService';
import { AppError } from '@/shared/types/error';
import { toPage, type Page, type PageRequest } from '@/shared/types/pagination';

const log = createLogger('MockNotificationService');

export interface MockNotificationServiceOptions {
  /** Simulated latency. Pass `NO_LATENCY` in tests. */
  latency?: MockLatency;

  /** The signed-in account, or null. Asked on every call. */
  currentUser?: () => Promise<AuthUser | null>;

  /** The inbox an account starts with. Defaults to the table beside the fixtures. */
  inboxFor?: (userId: string, nowMs: number) => AppNotification[];

  /** Injectable clock, for the starting inboxes' timestamps. */
  now?: () => number;
}

/** The backend's ceiling for a token (contract section 6.1). */
const MAX_TOKEN_LENGTH = 4096;

const PUSH_PLATFORMS: readonly string[] = ['android', 'ios'];

/** Newest first; by id when two arrived in the same instant, so the order never wobbles. */
function byNewest(a: AppNotification, b: AppNotification): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id);
}

function copied(notification: AppNotification): AppNotification {
  return { ...notification };
}

/** The token as the backend keeps it (trimmed), or `validation` when it is blank or too long. */
function requireToken(token: string): string {
  const trimmed = typeof token === 'string' ? token.trim() : '';
  if (trimmed.length === 0 || trimmed.length > MAX_TOKEN_LENGTH) {
    throw new AppError({ kind: 'validation', message: 'Mock devices: invalid token' });
  }
  return trimmed;
}

/** What an endpoint does with a page that cannot exist. */
function checkPage(request: PageRequest): void {
  const { page, pageSize } = request;
  if (
    !Number.isInteger(page) ||
    page < AppConfig.pagination.initialPage ||
    !Number.isInteger(pageSize) ||
    pageSize < 1
  ) {
    throw new AppError({ kind: 'validation', message: 'Mock notifications: no such page' });
  }
}

export class MockNotificationService implements NotificationService {
  private readonly latency: MockLatency;
  private readonly currentUser?: () => Promise<AuthUser | null>;
  private readonly inboxFor: (userId: string, nowMs: number) => AppNotification[];
  private readonly now: () => number;

  /** Inboxes per account, made the first time each account asks. */
  private readonly inboxes = new Map<string, AppNotification[]>();

  /** Push tokens by the account they belong to — one account per token, as on the backend. */
  private readonly deviceOwners = new Map<string, string>();

  constructor(options: MockNotificationServiceOptions = {}) {
    this.latency = options.latency ?? NO_LATENCY;
    this.currentUser = options.currentUser;
    this.inboxFor = options.inboxFor ?? mockInboxFor;
    this.now = options.now ?? (() => Date.now());
  }

  async list(request: PageRequest): Promise<Page<AppNotification>> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();
      checkPage(request);

      const page = toPage([...this.inboxOf(user.id)].sort(byNewest), request);

      // How many, never what.
      log.info('Mock notifications listed', {
        page: page.page,
        count: page.items.length,
        total: page.total,
      });
      return { ...page, items: page.items.map(copied) };
    }, this.latency);
  }

  async getUnreadCount(): Promise<number> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();
      const unread = this.inboxOf(user.id).filter(notification => !notification.read).length;

      log.info('Mock unread notifications counted', { unread });
      return unread;
    }, this.latency);
  }

  async markAsRead(id: string): Promise<void> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();
      const inbox = this.requireNotification(user.id, id);

      // Marking one already read is not an error: the answer is the same.
      this.inboxes.set(
        user.id,
        inbox.map(notification =>
          notification.id === id ? { ...notification, read: true } : notification,
        ),
      );
      log.info('Mock notification marked read');
    }, this.latency);
  }

  async markAllAsRead(): Promise<void> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();
      const inbox = this.inboxOf(user.id);

      this.inboxes.set(
        user.id,
        inbox.map(notification => (notification.read ? notification : { ...notification, read: true })),
      );
      log.info('Mock notifications all marked read', {
        marked: inbox.filter(notification => !notification.read).length,
      });
    }, this.latency);
  }

  async remove(id: string): Promise<void> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();
      const inbox = this.requireNotification(user.id, id);

      this.inboxes.set(
        user.id,
        inbox.filter(notification => notification.id !== id),
      );
      log.info('Mock notification removed');
    }, this.latency);
  }

  async removeAll(): Promise<void> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();
      const removed = this.inboxOf(user.id).length;

      // Emptied, not forgotten: the next read is this empty inbox, never the fixtures again.
      this.inboxes.set(user.id, []);
      log.info('Mock notifications all removed', { removed });
    }, this.latency);
  }

  async registerDevice({ token, platform }: PushDeviceRegistration): Promise<void> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();
      const key = requireToken(token);
      if (!PUSH_PLATFORMS.includes(platform)) {
        throw new AppError({ kind: 'validation', message: 'Mock devices: unknown platform' });
      }

      // Moved, not shared: the token now belongs to whoever registered it last.
      this.deviceOwners.set(key, user.id);
      // Never the token: it is a credential for the device.
      log.info('Mock device registered', { platform });
    }, this.latency);
  }

  async unregisterDevice(token: string): Promise<void> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();
      const key = requireToken(token);

      // Somebody else's, or nobody's, succeeds and changes nothing — as `removed: false`.
      const removed = this.deviceOwners.get(key) === user.id;
      if (removed) {
        this.deviceOwners.delete(key);
      }
      log.info('Mock device unregistered', { removed });
    }, this.latency);
  }

  /** Whether `token` is paired with `userId` now. For tests; the backend has no such read. */
  isDeviceRegistered(token: string, userId: string): boolean {
    return this.deviceOwners.get(token.trim()) === userId;
  }

  /** What an authenticated endpoint does to nobody. Either role has an inbox. */
  private async requireUser(): Promise<AuthUser> {
    const user = (await this.currentUser?.()) ?? null;
    if (!user) {
      throw new AppError({ kind: 'unauthorized', message: 'Mock notifications: no session' });
    }

    return user;
  }

  /** The account's inbox, made from the fixtures the first time it is asked for. */
  private inboxOf(userId: string): AppNotification[] {
    const existing = this.inboxes.get(userId);
    if (existing) {
      return existing;
    }

    const inbox = this.inboxFor(userId, this.now()).map(copied);
    this.inboxes.set(userId, inbox);
    return inbox;
  }

  /**
   * The inbox, once it is known to hold the notification. Not in it is not
   * found — whether it never existed or is somebody else's, which is not this
   * account's to know.
   */
  private requireNotification(userId: string, id: string): AppNotification[] {
    const inbox = this.inboxOf(userId);
    if (!inbox.some(notification => notification.id === id)) {
      throw new AppError({ kind: 'notFound', message: 'Mock notifications: no such notification' });
    }

    return inbox;
  }
}
