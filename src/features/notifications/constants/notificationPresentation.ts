/**
 * Notification presentation
 *
 * How the unread count and one notification are drawn and said — pure
 * functions of what the service returned, so both are tested without a screen.
 *
 * ⚠️ The badge stops counting at nine; the spoken label never does. "9+" keeps
 * a two-digit figure from outgrowing a 44dp bell, and it is a drawing limit
 * only: somebody listening hears "Notifications, 12 unread".
 *
 * ⚠️ A count the app cannot use is no count. Null (the read failed), zero, a
 * negative or a figure that is not a number all draw no badge and say
 * "Notifications" — a badge is a hint, and a wrong one is worse than none.
 *
 * ⚠️ The title and body are the backend's words, said as sent. Nothing here
 * rewrites them, reads `type`, or decides a notification's importance.
 */

import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { parseNotificationLink } from '@/features/notifications/constants/notificationLinks';
import { formatRequestDate } from '@/shared/presentation/requestTokens';
import type { AppNotification } from '@/shared/services/types/NotificationService';

const BELL = NOTIFICATIONS_COPY.bell;
const INBOX = NOTIFICATIONS_COPY.inbox;

/** The largest count the badge draws as a number. */
export const UNREAD_BADGE_LIMIT = 9;

export interface UnreadBadgePresentation {
  /** What the badge draws, or null for no badge. */
  badge: string | null;
  /** The bell's whole spoken name. */
  spoken: string;
}

/**
 * The badge for a count. `isLowerBound` when the inbox was too long to count
 * whole: then the count is a floor, drawn "3+" and said "at least 3" — never a
 * figure that may be wrong. A floor of nothing claims nothing, so no badge.
 */
export function presentUnreadBadge(
  count: number | null | undefined,
  isLowerBound = false,
): UnreadBadgePresentation {
  const unread = typeof count === 'number' && Number.isFinite(count) ? Math.floor(count) : 0;

  if (unread < 1) {
    return { badge: null, spoken: BELL.label };
  }

  if (unread > UNREAD_BADGE_LIMIT) {
    return {
      badge: BELL.overflow,
      spoken: isLowerBound ? BELL.unreadAtLeastSpoken(unread) : BELL.unreadSpoken(unread),
    };
  }

  return isLowerBound
    ? { badge: BELL.atLeast(unread), spoken: BELL.unreadAtLeastSpoken(unread) }
    : { badge: String(unread), spoken: BELL.unreadSpoken(unread) };
}

export interface NotificationPresentation {
  /** "4 min ago", or a date once that stops helping. Empty if the timestamp is unreadable. */
  time: string;
  /** The whole notification as one announcement: state, title, body, when. */
  spoken: string;
  /** Whether its link opens a request in this app. */
  opensRequest: boolean;
}

/** Ends a part as a sentence, unless the backend's words already end one. */
function sentence(part: string): string {
  const trimmed = part.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** One notification, ready to draw and to say. `now` is a parameter so this stays pure. */
export function presentNotification(
  notification: AppNotification,
  now: Date = new Date(),
): NotificationPresentation {
  const time = formatRequestDate(notification.createdAt, now);

  /*
    "Unread" first, so somebody moving down the list hears the state before the
    words. A read notification says nothing about being read: that is the
    ordinary case, and announcing it on every row would bury the ones that are not.
  */
  const spoken = [notification.read ? '' : INBOX.unreadSpoken, notification.title, notification.body, time]
    .filter(part => part.trim().length > 0)
    .map(sentence)
    .join(' ');

  return {
    time,
    spoken,
    opensRequest: parseNotificationLink(notification.deepLink) !== null,
  };
}
