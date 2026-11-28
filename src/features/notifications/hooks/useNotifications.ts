/**
 * useNotifications
 *
 * The signed-in account's notifications, a page at a time; marking them as
 * read; and removing them — one by a swipe, or all from the menu
 * (PROJECT_BIBLE.md sections 57 and 80 — "Notifications: Basic";
 * phase5-contract.md section 3, T133, 28/11/2026).
 *
 *   Inbox → hook → NotificationService → implementation
 *
 * The list is the shared `usePaginatedQuery`: newest first in the service's
 * order, `AppConfig.pagination`'s page size, the next page when the list asks
 * for it, and a failure that says which load it came from. Items are keyed by
 * id, so one that shifts onto the next page is listed once. Whose
 * notifications they are is the session's; no call takes an account.
 *
 * ⚠️ Every change is drawn at once, before the service answers, and taken back
 * if it fails: opening one marks it read, "Mark all as read" marks every row,
 * a swipe takes its row away and "Clear all" empties the list. A failure puts
 * the rows back exactly as they were and a toast says so, in the error's own
 * user words (`userMessage`, never `message`). Each is sent once however often
 * it is pressed — a ref per change, released in a `finally`, so a failure
 * never leaves it dead — and the two that act on the whole inbox lock each
 * other out while either is in the air (`isBusy`).
 *
 * ⚠️ What has changed is kept beside the list, never written into it. The
 * pages are the service's answer and a refresh replaces them, so a row's state
 * is the service's word *or* this screen's. Each change is two layers — in the
 * air, then confirmed — so taking one back cannot undo another that succeeded
 * meanwhile. "All" is everything on screen when it was pressed *and*
 * everything at least as old as the newest one there (`Covered`): a page that
 * was already on its way, fetched before the service changed it, lands
 * already read or already gone instead of bringing old rows back.
 *
 * ⚠️ A removal that answers `notFound` succeeded: the notification is not in
 * this inbox, which is what removing it asked for. It is not put back.
 *
 * ⚠️ Removing shifts the pages behind it. The list's next page is fetched by
 * offset, so with rows gone it would start past notifications nobody has seen;
 * while there are pages not yet loaded, a confirmed removal reads the loaded
 * pages again quietly (`refreshQuietly`), which also clears a stale "could not
 * load more".
 *
 * Each successful change is announced (`notificationSync`) so the bell under
 * this screen reads its count again — a removed unread one changes it too.
 * Failures are logged by kind only, never by title or body.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import {
  notificationsRead,
  onNotificationsArrived,
} from '@/features/notifications/state/notificationSync';
import { ERROR_PRESENTATION, useToast } from '@/shared/components';
import { usePaginatedQuery, type UsePaginatedQueryResult } from '@/shared/hooks/usePaginatedQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { AppNotification } from '@/shared/services/types/NotificationService';
import { AppError } from '@/shared/types/error';

const COPY = NOTIFICATIONS_COPY.inbox;

const log = createLogger('useNotifications');

/** What a mark came to. `ignored` is a second request while the same one was in the air. */
export type NotificationMarkOutcome = 'marked' | 'failed' | 'ignored';

/** What a removal came to, one or all. `ignored` as for a mark. */
export type NotificationRemoveOutcome = 'removed' | 'failed' | 'ignored';

export interface NotificationsState
  extends Pick<
    UsePaginatedQueryResult<AppNotification>,
    | 'error'
    | 'failedDuring'
    | 'isLoading'
    | 'isRefreshing'
    | 'isLoadingMore'
    | 'hasMore'
    | 'loadMore'
    | 'refresh'
    | 'retry'
  > {
  /** The list as it should be drawn: the service's pages, as this screen has changed them. */
  notifications: AppNotification[];

  /** Marks one as read now and tells the service. Never rejects. */
  markAsRead: (notificationId: string) => Promise<NotificationMarkOutcome>;

  /** Whether there may be anything for "Mark all as read" to do. */
  canMarkAll: boolean;
  /** Marks every notification read now and tells the service. Never rejects. */
  markAllAsRead: () => Promise<NotificationMarkOutcome>;
  isMarkingAll: boolean;

  /** Takes one out of the list now and tells the service. Never rejects. */
  remove: (notificationId: string) => Promise<NotificationRemoveOutcome>;

  /** Whether there is anything for "Clear all" to remove. */
  canClearAll: boolean;
  /** Empties the list now and tells the service. Never rejects; asking first is the screen's. */
  clearAll: () => Promise<NotificationRemoveOutcome>;
  isClearingAll: boolean;

  /** "Mark all" or "Clear all" is in the air: neither may start. */
  isBusy: boolean;
}

/**
 * Notifications an "all" reached: the ids on screen when it was pressed, and
 * everything at least as old as the newest of them (`through`, in ms) — null
 * when none of them had a readable time, so only the ids count.
 */
interface Covered {
  ids: ReadonlySet<string>;
  through: number | null;
}

function keyOf(notification: AppNotification): string {
  return notification.id;
}

function withId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  return ids.has(id) ? ids : new Set(ids).add(id);
}

function withoutId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!ids.has(id)) {
    return ids;
  }
  const next = new Set(ids);
  next.delete(id);
  return next;
}

/** A timestamp as milliseconds, or NaN when the backend's string cannot be read. */
function timeOf(notification: AppNotification): number {
  return Date.parse(notification.createdAt);
}

/** What an "all" pressed over `shown` reaches. */
function coverageOf(shown: readonly AppNotification[]): Covered {
  const through = shown.reduce<number | null>((latest, notification) => {
    const time = timeOf(notification);
    return Number.isNaN(time) || (latest !== null && latest >= time) ? latest : time;
  }, null);
  return { ids: new Set(shown.map(keyOf)), through };
}

/** Both at once: a second "all" that succeeded adds to the first, never replaces it. */
function widened(previous: Covered | null, next: Covered): Covered {
  if (!previous) {
    return next;
  }
  const through =
    previous.through === null
      ? next.through
      : next.through === null
        ? previous.through
        : Math.max(previous.through, next.through);
  return { ids: new Set([...previous.ids, ...next.ids]), through };
}

/** By id as well as by age, so a row whose timestamp cannot be read is reached too. */
function covers(coverage: Covered | null, notification: AppNotification): boolean {
  if (!coverage) {
    return false;
  }
  if (coverage.ids.has(notification.id)) {
    return true;
  }
  return coverage.through !== null && timeOf(notification) <= coverage.through;
}

export function useNotifications(): NotificationsState {
  const { showToast } = useToast();

  const query = usePaginatedQuery<AppNotification>(
    request => getService('notification').list(request),
    [],
    { getKey: keyOf },
  );

  /*
    Marked read on this screen. A tap's mark is `pending` until the service
    answers, then `confirmed`; "mark all" is `readingAll` in the air and
    `readAll` once it succeeded. A failure removes only its own layer.
  */
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmedIds, setConfirmedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [readingAll, setReadingAll] = useState<Covered | null>(null);
  const [readAll, setReadAll] = useState<Covered | null>(null);

  /* Removed on this screen, in the same two layers. */
  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [clearing, setClearing] = useState<Covered | null>(null);
  const [cleared, setCleared] = useState<Covered | null>(null);

  /** Changes in the air, so a second press sends nothing. */
  const marking = useRef(new Set<string>());
  const removing = useRef(new Set<string>());
  const markingAll = useRef(false);
  const clearingAll = useRef(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const { items, hasMore, refreshQuietly } = query;

  // A push that arrived with the app in front (phase5-contract.md section 6.3)
  // is a notification the backend has just stored: the loaded pages are read
  // again quietly, so it appears without a spinner or a lost scroll position.
  useEffect(() => onNotificationsArrived(refreshQuietly), [refreshQuietly]);
  const notifications = useMemo(
    () =>
      items
        .filter(
          notification =>
            !removingIds.has(notification.id) &&
            !removedIds.has(notification.id) &&
            !covers(clearing, notification) &&
            !covers(cleared, notification),
        )
        .map(notification => {
          const read =
            notification.read ||
            pendingIds.has(notification.id) ||
            confirmedIds.has(notification.id) ||
            covers(readingAll, notification) ||
            covers(readAll, notification);

          // The service's object when nothing changed, so an untouched row is not redrawn.
          return read === notification.read ? notification : { ...notification, read };
        }),
    [items, pendingIds, confirmedIds, readingAll, readAll, removingIds, removedIds, clearing, cleared],
  );

  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  /** Says what failed, in the error's own words for a person, never its developer message. */
  const sayFailed = useCallback(
    (lead: string, caught: unknown, what: string) => {
      const error = AppError.from(caught);
      log.warn(what, { kind: error.kind });
      // Said even after leaving the inbox: the toast floats over whatever is in front.
      const { tone, icon } = ERROR_PRESENTATION[error.kind];
      showToast({ message: `${lead} ${error.userMessage}`, tone, icon });
    },
    [showToast],
  );

  /** After a confirmed removal: the offsets behind it moved, so read what is loaded again. */
  const realignPages = useCallback(() => {
    if (mountedRef.current && hasMoreRef.current) {
      refreshQuietly();
    }
  }, [refreshQuietly]);

  const markAsRead = useCallback(
    async (notificationId: string): Promise<NotificationMarkOutcome> => {
      if (marking.current.has(notificationId)) {
        return 'ignored';
      }
      marking.current.add(notificationId);
      setPendingIds(previous => withId(previous, notificationId));

      try {
        await getService('notification').markAsRead(notificationId);
        if (mountedRef.current) {
          setConfirmedIds(previous => withId(previous, notificationId));
        }
        notificationsRead();
        return 'marked';
      } catch (caught) {
        sayFailed(COPY.markFailed, caught, 'Notification not marked as read');
        return 'failed';
      } finally {
        marking.current.delete(notificationId);
        // Taken back on failure; on success `confirmed` holds it now.
        if (mountedRef.current) {
          setPendingIds(previous => withoutId(previous, notificationId));
        }
      }
    },
    [sayFailed],
  );

  const markAllAsRead = useCallback(async (): Promise<NotificationMarkOutcome> => {
    if (markingAll.current || clearingAll.current) {
      return 'ignored';
    }
    markingAll.current = true;

    // What was on screen when it was pressed is what the person asked to mark.
    const coverage = coverageOf(notificationsRef.current);
    setReadingAll(coverage);

    try {
      await getService('notification').markAllAsRead();
      if (mountedRef.current) {
        setReadAll(previous => widened(previous, coverage));
      }
      notificationsRead();
      showToast({ message: COPY.markedAll, tone: 'success', icon: 'success' });
      return 'marked';
    } catch (caught) {
      sayFailed(COPY.markAllFailed, caught, 'Notifications not marked as read');
      return 'failed';
    } finally {
      markingAll.current = false;
      // In the same turn as `readAll`, so a confirmed row is never drawn unread for a frame.
      if (mountedRef.current) {
        setReadingAll(null);
      }
    }
  }, [sayFailed, showToast]);

  const remove = useCallback(
    async (notificationId: string): Promise<NotificationRemoveOutcome> => {
      if (removing.current.has(notificationId)) {
        return 'ignored';
      }
      removing.current.add(notificationId);
      setRemovingIds(previous => withId(previous, notificationId));

      try {
        await getService('notification').remove(notificationId);
      } catch (caught) {
        // Already gone from this inbox: what was asked for is true, so it is not put back.
        if (AppError.from(caught).kind !== 'notFound') {
          sayFailed(COPY.deleteFailed, caught, 'Notification not removed');
          return 'failed';
        }
      } finally {
        removing.current.delete(notificationId);
        if (mountedRef.current) {
          setRemovingIds(previous => withoutId(previous, notificationId));
        }
      }

      // In the same turn as the `finally`, so the row is never drawn back for a frame.
      if (mountedRef.current) {
        setRemovedIds(previous => withId(previous, notificationId));
      }
      notificationsRead();
      realignPages();
      showToast({ message: COPY.deleted, tone: 'success', icon: 'success' });
      return 'removed';
    },
    [realignPages, sayFailed, showToast],
  );

  const clearAll = useCallback(async (): Promise<NotificationRemoveOutcome> => {
    if (clearingAll.current || markingAll.current) {
      return 'ignored';
    }
    clearingAll.current = true;

    const coverage = coverageOf(notificationsRef.current);
    setClearing(coverage);

    try {
      await getService('notification').removeAll();
      if (mountedRef.current) {
        setCleared(previous => widened(previous, coverage));
      }
      notificationsRead();
      realignPages();
      showToast({ message: COPY.clearedAll, tone: 'success', icon: 'success' });
      return 'removed';
    } catch (caught) {
      sayFailed(COPY.clearAllFailed, caught, 'Notifications not cleared');
      return 'failed';
    } finally {
      clearingAll.current = false;
      if (mountedRef.current) {
        setClearing(null);
      }
    }
  }, [realignPages, sayFailed, showToast]);

  const isMarkingAll = readingAll !== null;
  const isClearingAll = clearing !== null;
  const isBusy = isMarkingAll || isClearingAll;

  /*
    Anything unread on screen, or pages not yet loaded that may hold some —
    unless "mark all" has already succeeded, which covered them too.
  */
  const canMarkAll =
    notifications.some(notification => !notification.read) || (hasMore && readAll === null);
  const canClearAll = notifications.length > 0;

  return {
    notifications,
    error: query.error,
    failedDuring: query.failedDuring,
    isLoading: query.isLoading,
    isRefreshing: query.isRefreshing,
    isLoadingMore: query.isLoadingMore,
    hasMore,
    loadMore: query.loadMore,
    refresh: query.refresh,
    retry: query.retry,
    markAsRead,
    canMarkAll,
    markAllAsRead,
    isMarkingAll,
    remove,
    canClearAll,
    clearAll,
    isClearingAll,
    isBusy,
  };
}
