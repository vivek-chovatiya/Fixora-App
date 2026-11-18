/**
 * How the bell's count and one notification are drawn and said.
 *
 * Pinned here:
 *
 * - the badge counts to nine and then says "9+", and draws nothing at zero, at
 *   a count the app cannot use, or with no count at all (a failed read)
 * - the bell's spoken name carries the exact count however many there are
 * - a notification is said as one announcement — "Unread" first when it is,
 *   then the title, the whole body (never cut) and when — and a read one says
 *   nothing about being read
 * - whether it opens a request is its link's to say, never its type's
 */

import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import {
  UNREAD_BADGE_LIMIT,
  presentNotification,
  presentUnreadBadge,
} from '@/features/notifications/constants/notificationPresentation';
import type { AppNotification } from '@/shared/services/types/NotificationService';

const BELL = NOTIFICATIONS_COPY.bell;

const NOW = new Date('2026-10-20T09:30:00.000Z');

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

const ACCEPTED: AppNotification = {
  id: 'ntf_1',
  title: 'Request accepted',
  body: 'Bright Spark Electrical Services and Repairs accepted your Fan Repair request REQ-24063.',
  createdAt: minutesAgo(4),
  read: false,
  type: 'request.accepted',
  iconName: 'check-circle-outline',
  deepLink: 'fixora://requests/REQ-24063',
};

describe('presentUnreadBadge', () => {
  it('draws the count, and says it', () => {
    expect(presentUnreadBadge(3)).toEqual({ badge: '3', spoken: 'Notifications, 3 unread' });
    expect(presentUnreadBadge(1)).toEqual({ badge: '1', spoken: 'Notifications, 1 unread' });
  });

  it('counts to nine on the badge', () => {
    expect(UNREAD_BADGE_LIMIT).toBe(9);
    expect(presentUnreadBadge(9).badge).toBe('9');
  });

  it('draws "9+" above nine, and still says the exact count', () => {
    expect(presentUnreadBadge(10)).toEqual({ badge: BELL.overflow, spoken: 'Notifications, 10 unread' });
    expect(presentUnreadBadge(22)).toEqual({ badge: '9+', spoken: 'Notifications, 22 unread' });
  });

  it('draws nothing at zero', () => {
    expect(presentUnreadBadge(0)).toEqual({ badge: null, spoken: BELL.label });
  });

  it('draws and says a floor as one when the inbox was too long to count whole', () => {
    expect(presentUnreadBadge(3, true)).toEqual({ badge: '3+', spoken: 'Notifications, at least 3 unread' });
    expect(presentUnreadBadge(40, true)).toEqual({ badge: '9+', spoken: 'Notifications, at least 40 unread' });
    // A floor of nothing claims nothing.
    expect(presentUnreadBadge(0, true)).toEqual({ badge: null, spoken: BELL.label });
  });

  it('draws nothing when the count is unknown — a read that failed is not an error on the bell', () => {
    expect(presentUnreadBadge(null)).toEqual({ badge: null, spoken: 'Notifications' });
    expect(presentUnreadBadge(undefined)).toEqual({ badge: null, spoken: 'Notifications' });
  });

  it('draws nothing for a count the app cannot use', () => {
    for (const count of [-1, Number.NaN, Number.POSITIVE_INFINITY, 0.5]) {
      expect(presentUnreadBadge(count)).toEqual({ badge: null, spoken: 'Notifications' });
    }
  });

  it('draws a fractional count as the whole notifications it holds', () => {
    expect(presentUnreadBadge(2.7)).toEqual({ badge: '2', spoken: 'Notifications, 2 unread' });
  });
});

describe('presentNotification', () => {
  it('says an unread one as one announcement, "Unread" first', () => {
    expect(presentNotification(ACCEPTED, NOW).spoken).toBe(
      'Unread. Request accepted. Bright Spark Electrical Services and Repairs accepted your Fan ' +
        'Repair request REQ-24063. 4 min ago.',
    );
  });

  it('says nothing about being read when it is', () => {
    const spoken = presentNotification({ ...ACCEPTED, read: true }, NOW).spoken;

    expect(spoken.startsWith('Request accepted.')).toBe(true);
    expect(spoken).not.toMatch(/\bread\b|unread/i);
  });

  it('keeps the backend’s own punctuation rather than doubling it', () => {
    const spoken = presentNotification(
      { ...ACCEPTED, read: true, title: 'How did it go?', body: 'Rate your Switch Repair!' },
      NOW,
    ).spoken;

    expect(spoken).toBe('How did it go? Rate your Switch Repair! 4 min ago.');
  });

  it('says the whole body, however long — only the screen cuts it', () => {
    const body = 'A sentence that goes on. '.repeat(20).trim();

    expect(presentNotification({ ...ACCEPTED, body }, NOW).spoken).toContain(body);
  });

  it('words when it came with the app’s shared relative time', () => {
    expect(presentNotification(ACCEPTED, NOW).time).toBe('4 min ago');
    expect(presentNotification({ ...ACCEPTED, createdAt: minutesAgo(3 * 60) }, NOW).time).toBe('3 hr ago');
    expect(presentNotification({ ...ACCEPTED, createdAt: minutesAgo(36 * 60) }, NOW).time).toBe('1 day ago');
  });

  it('leaves out a time it cannot read rather than inventing one', () => {
    const presented = presentNotification({ ...ACCEPTED, createdAt: 'not a date' }, NOW);

    expect(presented.time).toBe('');
    expect(presented.spoken.endsWith('REQ-24063.')).toBe(true);
  });

  it('opens a request only when its link says so', () => {
    expect(presentNotification(ACCEPTED, NOW).opensRequest).toBe(true);
    expect(presentNotification({ ...ACCEPTED, deepLink: 'fixora://reviews' }, NOW).opensRequest).toBe(false);

    const unlinked: AppNotification = { ...ACCEPTED };
    delete unlinked.deepLink;
    expect(presentNotification(unlinked, NOW).opensRequest).toBe(false);
  });

  it('never reads the type: the same link opens the same way whatever the type says', () => {
    for (const type of ['request.accepted', 'review.received', 'something.new', '']) {
      expect(presentNotification({ ...ACCEPTED, type }, NOW).opensRequest).toBe(true);
    }
  });
});
