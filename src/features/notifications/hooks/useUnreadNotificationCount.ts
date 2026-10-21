/**
 * useUnreadNotificationCount
 *
 * How many of the signed-in account's notifications are unread, for the bell
 * on Customer Home and the Vendor Dashboard (PROJECT_BIBLE.md sections 57 and
 * 80).
 *
 *   Bell's screen → hook → NotificationService.getUnreadCount → implementation
 *
 * Read when the screen first draws, again each time it comes back into focus —
 * which is how somebody returns from the inbox — and again whenever the inbox
 * says notifications were marked as read (`notificationSync`), so a mark still
 * in flight when they came back is counted once it lands. Whose count it is,
 * is the session's: the call takes nothing.
 *
 * ⚠️ A failed read is no badge, never an error. The count is a hint on a
 * screen that has its own work to show; a retry button or a warning in its
 * place would put a failure where the customer did not ask for anything. The
 * shared query logs it, and the next focus reads again. A read that finishes
 * after a newer one started is discarded by `useServiceQuery`, so an old
 * answer never replaces a new one.
 *
 * ⚠️ Focus is taken from the navigation context (`useNavigationEvent`), not
 * from `useFocusEffect`, which throws when there is none. In the app the bell's
 * screen is always inside a navigator; Home's own suite renders the screen on
 * its own, and a badge is not a reason for that screen to stop rendering. With
 * no navigator the count is read once.
 */

import { useCallback, useEffect } from 'react';

import { onNotificationsRead } from '@/features/notifications/state/notificationSync';
import { useNavigationEvent } from '@/shared/hooks/useNavigationEvent';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';

/** The unread count, or null while it is unknown — before the first answer, or after a failure. */
export function useUnreadNotificationCount(): number | null {
  const query = useServiceQuery<number>(
    useCallback(() => getService('notification').getUnreadCount(), []),
    [],
  );
  const { refresh } = query;

  // Again on every return, but not on arrival: the query has just read it.
  useNavigationEvent('focus', refresh, { onlyOnReturn: true });

  // Whether or not this screen is in front: it is under the inbox that said so.
  useEffect(() => onNotificationsRead(refresh), [refresh]);

  if (query.error !== null || query.data === undefined) {
    return null;
  }
  return query.data;
}
