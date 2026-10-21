/**
 * useNotifications
 *
 * The signed-in account's notifications, a page at a time, and marking them
 * as read (PROJECT_BIBLE.md sections 57 and 80 — "Notifications: Basic").
 *
 *   Inbox → hook → NotificationService → implementation
 *
 * The list is the shared `usePaginatedQuery`: newest first in the service's
 * order, `AppConfig.pagination`'s page size, the next page when the list asks
 * for it, and a failure that says which load it came from. Items are keyed by
 * id, so one that shifts onto the next page is listed once. Whose
 * notifications they are is the session's; no call takes an account.
 *
 * ⚠️ Opening a notification marks it read at once, before the service answers
 * — it is the one change here that is optimistic, because whoever pressed it
 * is already on their way to the request, and a row that stayed unread behind
 * them would be the app disagreeing with what they just did. If the call
 * fails the row goes back to unread and a toast says so. Two taps send one
 * call: a mark already in the air for that notification is not sent again.
 *
 * ⚠️ Marking all is not optimistic. The button shows busy while the call is
 * out, and only the service's yes changes anything; a failure is a toast and
 * every row stays as it was. Five presses send one call (a ref, released in a
 * `finally`, so a failure never leaves the button dead).
 *
 * ⚠️ What has been marked is kept beside the list, never written into it. The
 * pages are the service's answer and a refresh replaces them, so a read row
 * is the service's word *or* this screen's: the notifications marked here, and
 * — once "mark all" succeeded — everything at least as old as the newest one
 * on screen when it was pressed. That last rule is what keeps a page that was
 * already on its way, fetched before the service had marked it, from drawing
 * old notifications as unread again.
 *
 * Each successful mark is announced (`notificationSync`) so the bell under
 * this screen reads its count again. Failures are logged by kind only, never
 * by title or body.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { notificationsRead } from '@/features/notifications/state/notificationSync';
import { ERROR_PRESENTATION, useToast } from '@/shared/components';
import { usePaginatedQuery, type UsePaginatedQueryResult } from '@/shared/hooks/usePaginatedQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { AppNotification } from '@/shared/services/types/NotificationService';
import { AppError } from '@/shared/types/error';

const COPY = NOTIFICATIONS_COPY.inbox;

const log = createLogger('useNotifications');

/** What a mark came to. `ignored` is a second request while the same one was in the air. */
export type NotificationMarkOutcome = 'marked' | 'failed' | 'ignored';

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
  /** The list as it should be drawn: the service's pages, with `read` as this screen knows it. */
  notifications: AppNotification[];

  /** Marks one as read now and tells the service. Never rejects. */
  markAsRead: (notificationId: string) => Promise<NotificationMarkOutcome>;

  /** Whether there may be anything for "Mark all as read" to do. */
  canMarkAll: boolean;
  /** Marks every notification read, once the service agrees. Never rejects. */
  markAllAsRead: () => Promise<NotificationMarkOutcome>;
  isMarkingAll: boolean;
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

export function useNotifications(): NotificationsState {
  const { showToast } = useToast();

  const query = usePaginatedQuery<AppNotification>(
    request => getService('notification').list(request),
    [],
    { getKey: keyOf },
  );

  /*
    Marked read on this screen, in two sets so taking one back cannot undo the
    other: a tap's mark is `pending` until the service answers, then
    `confirmed` — and a failure removes it from `pending` only, so a "mark all"
    that succeeded meanwhile still stands.
  */
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmedIds, setConfirmedIds] = useState<ReadonlySet<string>>(() => new Set());
  /** After a successful "mark all": everything this old or older is read. */
  const [readThrough, setReadThrough] = useState<number | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  /** Marks in the air, by notification, so a second tap sends nothing. */
  const marking = useRef(new Set<string>());
  const markingAll = useRef(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const { items } = query;
  const notifications = useMemo(
    () =>
      items.map(notification => {
        const read =
          notification.read ||
          pendingIds.has(notification.id) ||
          confirmedIds.has(notification.id) ||
          (readThrough !== null && timeOf(notification) <= readThrough);

        // The service's object when nothing changed, so an untouched row is not redrawn.
        return read === notification.read ? notification : { ...notification, read };
      }),
    [items, pendingIds, confirmedIds, readThrough],
  );

  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

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
        const error = AppError.from(caught);
        log.warn('Notification not marked as read', { kind: error.kind });
        // Said even after leaving the inbox: the toast floats over whatever is in front.
        const { tone, icon } = ERROR_PRESENTATION[error.kind];
        showToast({ message: `${COPY.markFailed} ${error.userMessage}`, tone, icon });
        return 'failed';
      } finally {
        marking.current.delete(notificationId);
        // Taken back on failure; on success `confirmed` holds it now.
        if (mountedRef.current) {
          setPendingIds(previous => withoutId(previous, notificationId));
        }
      }
    },
    [showToast],
  );

  const markAllAsRead = useCallback(async (): Promise<NotificationMarkOutcome> => {
    if (markingAll.current) {
      return 'ignored';
    }
    markingAll.current = true;
    setIsMarkingAll(true);

    // What was on screen when it was pressed is what the customer asked to mark.
    const shown = notificationsRef.current;
    const newest = shown.reduce<number | null>((latest, notification) => {
      const time = timeOf(notification);
      return Number.isNaN(time) || (latest !== null && latest >= time) ? latest : time;
    }, null);

    try {
      await getService('notification').markAllAsRead();
      if (mountedRef.current) {
        // By id as well as by age, so a row whose timestamp cannot be read is marked too.
        setConfirmedIds(previous => {
          const next = new Set(previous);
          shown.forEach(notification => next.add(notification.id));
          return next;
        });
        if (newest !== null) {
          setReadThrough(previous => (previous !== null && previous >= newest ? previous : newest));
        }
      }
      notificationsRead();
      showToast({ message: COPY.markedAll, tone: 'success', icon: 'success' });
      return 'marked';
    } catch (caught) {
      const error = AppError.from(caught);
      log.warn('Notifications not marked as read', { kind: error.kind });
      const { tone, icon } = ERROR_PRESENTATION[error.kind];
      showToast({ message: `${COPY.markAllFailed} ${error.userMessage}`, tone, icon });
      return 'failed';
    } finally {
      markingAll.current = false;
      if (mountedRef.current) {
        setIsMarkingAll(false);
      }
    }
  }, [showToast]);

  /*
    Anything unread on screen, or pages not yet loaded that may hold some —
    unless "mark all" has already succeeded, which covered them too.
  */
  const canMarkAll =
    notifications.some(notification => !notification.read) ||
    (query.hasMore && readThrough === null);

  return {
    notifications,
    error: query.error,
    failedDuring: query.failedDuring,
    isLoading: query.isLoading,
    isRefreshing: query.isRefreshing,
    isLoadingMore: query.isLoadingMore,
    hasMore: query.hasMore,
    loadMore: query.loadMore,
    refresh: query.refresh,
    retry: query.retry,
    markAsRead,
    canMarkAll,
    markAllAsRead,
    isMarkingAll,
  };
}
