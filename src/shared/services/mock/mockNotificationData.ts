/**
 * MOCK NOTIFICATION DATA — DEVELOPMENT ONLY
 *
 * What a mock account's inbox holds the first time it is read, so the in-app
 * notifications (PROJECT_BIBLE.md sections 57 and 80) can be built before
 * there is a backend to send any. Fixtures, not messages: nobody sent these,
 * and none of them reaches a production build.
 *
 * ⚠️ About requests the app really holds. A customer's notifications follow
 * the customer request seed in `MockRequestService` — which every customer
 * sees — event by event, and each status they announce is the one the details
 * screen shows: received, sent to a professional, accepted, started,
 * completed, cancelled. Ravi's follow his work in `mockVendorDashboardData`,
 * and his reviews follow `mockVendorReviewData`. Where a link opens a request,
 * it is one this account can open.
 *
 * ⚠️ Three kinds of link, on purpose. `fixora://requests/<reference>` opens the
 * request; a link the app does not understand (`fixora://addresses`,
 * `fixora://reviews`) proves an unknown link is ignored rather than guessed at;
 * no link at all — the welcome, and a request another professional took, which
 * is no longer Ravi's to open — proves a notification can simply be read.
 *
 * ⚠️ Per account, by id. Asha (`usr_customer_1`) has twenty-two — more than one
 * page at `AppConfig.pagination`'s twenty, so the next page is reachable —
 * six of them unread, and one whose title and body are long enough to wrap at
 * 360dp. The second customer (`usr_customer_2`) has the same history and has
 * never opened the inbox, so all twenty-two are unread and the bell shows
 * "9+". Ravi (`usr_vendor_1`) has eight, five unread, one long. The third
 * customer (`usr_customer_3`), Meena (`usr_vendor_2`) and anybody registered in
 * the app have none — the empty state, and the proof that one account never
 * sees another's.
 *
 * `type` and `iconName` are what a backend is expected to send. The app draws
 * the icon and never branches on the type. Every glyph named here exists in
 * the app's icon family; an unknown one would fall back.
 *
 * ⚠️ Deterministic. Every notification is written out; nothing is random and no
 * timer adds one. The only input is the clock, which turns "four minutes ago"
 * into a timestamp, always after the request it is about was raised.
 */

import type { AppNotification } from '@/shared/services/types/NotificationService';

const MS_PER_MINUTE = 60_000;
const HOUR = 60;
const DAY = 24 * HOUR;

/** A notification as the fixture writes it: an age in minutes instead of a timestamp. */
interface NotificationSeed {
  minutesAgo: number;
  read: boolean;
  type: string;
  iconName?: string;
  title: string;
  body: string;
  deepLink?: string;
}

function requestLink(reference: string): string {
  return `fixora://requests/${reference}`;
}

/**
 * The customer request seed, told as it happened, newest first. Ages are
 * measured against the seed's own (`MockRequestService`): REQ-24081 raised 35
 * minutes ago, REQ-24079 two hours, REQ-24076 six, REQ-24070 fourteen,
 * REQ-24063 a day, REQ-24048 three days, REQ-24020 nine.
 */
const CUSTOMER_HISTORY: readonly NotificationSeed[] = [
  {
    minutesAgo: 4,
    read: false,
    type: 'request.accepted',
    iconName: 'check-circle-outline',
    title: 'Request accepted',
    body: 'Bright Spark Electrical Services and Repairs accepted your Fan Repair request REQ-24063.',
    deepLink: requestLink('REQ-24063'),
  },
  {
    // The stress case: a title and a body long enough to wrap, and to be cut, at 360dp.
    minutesAgo: 25,
    read: false,
    type: 'request.waiting',
    iconName: 'clock-outline',
    title: 'Still waiting for Citywide Plumbing to answer your Leak Repair request',
    body:
      'Your Leak Repair request REQ-24081 went to Citywide Plumbing, the professional you chose, ' +
      'and they have not answered yet. We will tell you here as soon as they accept it, or if ' +
      'they cannot take it on, so that you can choose someone else.',
    deepLink: requestLink('REQ-24081'),
  },
  {
    minutesAgo: 34,
    read: true,
    type: 'request.received',
    iconName: 'clipboard-text-outline',
    title: 'Request received',
    body: 'We have received your Leak Repair request REQ-24081 and sent it to Citywide Plumbing.',
    deepLink: requestLink('REQ-24081'),
  },
  {
    minutesAgo: 2 * HOUR - 1,
    read: true,
    type: 'request.received',
    iconName: 'clipboard-text-outline',
    title: 'Request received',
    body: 'We have received your Interior Painting request REQ-24079.',
    deepLink: requestLink('REQ-24079'),
  },
  {
    minutesAgo: 3 * HOUR,
    read: false,
    type: 'request.started',
    iconName: 'progress-wrench',
    title: 'Work started',
    body: 'CoolAir Services has started work on your AC Servicing request REQ-24076.',
    deepLink: requestLink('REQ-24076'),
  },
  {
    // A link the app does not understand: reading it marks it read and opens nothing.
    minutesAgo: 5 * HOUR,
    read: false,
    type: 'account.tip',
    iconName: 'map-marker-outline',
    title: 'Save your address',
    body: 'Save your home address in Profile and your next request will be quicker to raise.',
    deepLink: 'fixora://addresses',
  },
  {
    minutesAgo: 5 * HOUR + 30,
    read: true,
    type: 'request.accepted',
    iconName: 'check-circle-outline',
    title: 'Request accepted',
    body: 'CoolAir Services accepted your AC Servicing request REQ-24076.',
    deepLink: requestLink('REQ-24076'),
  },
  {
    minutesAgo: 6 * HOUR - 2,
    read: true,
    type: 'request.searching',
    iconName: 'account-search-outline',
    title: 'Finding a professional',
    body: 'Your AC Servicing request REQ-24076 has gone to professionals near you.',
    deepLink: requestLink('REQ-24076'),
  },
  {
    minutesAgo: 6 * HOUR - 1,
    read: true,
    type: 'request.received',
    iconName: 'clipboard-text-outline',
    title: 'Request received',
    body: 'We have received your AC Servicing request REQ-24076.',
    deepLink: requestLink('REQ-24076'),
  },
  {
    minutesAgo: 14 * HOUR - 2,
    read: true,
    type: 'request.searching',
    iconName: 'account-search-outline',
    title: 'Finding a professional',
    body: 'Your Door Repair request REQ-24070 has gone to professionals near you.',
    deepLink: requestLink('REQ-24070'),
  },
  {
    minutesAgo: 14 * HOUR - 1,
    read: true,
    type: 'request.received',
    iconName: 'clipboard-text-outline',
    title: 'Request received',
    body: 'We have received your Door Repair request REQ-24070.',
    deepLink: requestLink('REQ-24070'),
  },
  {
    minutesAgo: DAY - 1,
    read: true,
    type: 'request.received',
    iconName: 'clipboard-text-outline',
    title: 'Request received',
    body:
      'We have received your Fan Repair request REQ-24063 and sent it to Bright Spark ' +
      'Electrical Services and Repairs.',
    deepLink: requestLink('REQ-24063'),
  },
  {
    minutesAgo: DAY + 12 * HOUR - 5,
    read: false,
    type: 'review.requested',
    iconName: 'star-outline',
    title: 'Rate your experience',
    body: 'How did N.S. Electricals do? Rate your Switch Repair request REQ-24048.',
    deepLink: requestLink('REQ-24048'),
  },
  {
    minutesAgo: DAY + 12 * HOUR,
    read: false,
    type: 'request.completed',
    iconName: 'check-circle-outline',
    title: 'Work completed',
    body: 'N.S. Electricals marked your Switch Repair request REQ-24048 as complete.',
    deepLink: requestLink('REQ-24048'),
  },
  {
    minutesAgo: 2 * DAY,
    read: true,
    type: 'request.started',
    iconName: 'progress-wrench',
    title: 'Work started',
    body: 'N.S. Electricals has started work on your Switch Repair request REQ-24048.',
    deepLink: requestLink('REQ-24048'),
  },
  {
    minutesAgo: 2 * DAY + 22 * HOUR,
    read: true,
    type: 'request.accepted',
    iconName: 'check-circle-outline',
    title: 'Request accepted',
    body: 'N.S. Electricals accepted your Switch Repair request REQ-24048.',
    deepLink: requestLink('REQ-24048'),
  },
  {
    minutesAgo: 3 * DAY - 2,
    read: true,
    type: 'request.searching',
    iconName: 'account-search-outline',
    title: 'Finding a professional',
    body: 'Your Switch Repair request REQ-24048 has gone to professionals near you.',
    deepLink: requestLink('REQ-24048'),
  },
  {
    minutesAgo: 3 * DAY - 1,
    read: true,
    type: 'request.received',
    iconName: 'clipboard-text-outline',
    title: 'Request received',
    body: 'We have received your Switch Repair request REQ-24048.',
    deepLink: requestLink('REQ-24048'),
  },
  {
    minutesAgo: 8 * DAY,
    read: true,
    type: 'request.cancelled',
    iconName: 'close-circle-outline',
    title: 'Request cancelled',
    body: 'Your Deep Home Cleaning request REQ-24020 was cancelled.',
    deepLink: requestLink('REQ-24020'),
  },
  {
    minutesAgo: 9 * DAY - 2,
    read: true,
    type: 'request.searching',
    iconName: 'account-search-outline',
    title: 'Finding a professional',
    body: 'Your Deep Home Cleaning request REQ-24020 has gone to professionals near you.',
    deepLink: requestLink('REQ-24020'),
  },
  {
    // The first of the second page at twenty a page.
    minutesAgo: 9 * DAY - 1,
    read: true,
    type: 'request.received',
    iconName: 'clipboard-text-outline',
    title: 'Request received',
    body: 'We have received your Deep Home Cleaning request REQ-24020.',
    deepLink: requestLink('REQ-24020'),
  },
  {
    // No link: there is nothing to open, only something to read.
    minutesAgo: 14 * DAY,
    read: true,
    type: 'account.welcome',
    iconName: 'hand-wave-outline',
    title: 'Welcome to Fixora',
    body: 'Request trusted professionals for work at home, and follow every request from here.',
  },
];

/**
 * Ravi's inbox, newest first: the open and directed requests waiting for him
 * (`mockVendorDashboardData`, raised 12 minutes, 55 minutes, 3 hours and 9
 * hours ago), one another professional took, and two of his reviews.
 */
const RAVI_INBOX: readonly NotificationSeed[] = [
  {
    minutesAgo: 11,
    read: false,
    type: 'request.new',
    iconName: 'clipboard-text-outline',
    title: 'New request near you',
    body:
      'Switchboard repair in Koramangala, marked as an emergency. The first professional to ' +
      'accept it gets the job.',
    deepLink: requestLink('REQ-31042'),
  },
  {
    minutesAgo: 54,
    read: false,
    type: 'request.directed',
    iconName: 'account-arrow-right-outline',
    title: 'New request for you',
    body: 'Rahul Menon chose you for a Ceiling fan installation in HSR Layout.',
    deepLink: requestLink('REQ-31038'),
  },
  {
    // No link: the request went to somebody else and is no longer Ravi's to open.
    minutesAgo: 2 * HOUR,
    read: false,
    type: 'request.taken',
    iconName: 'close-circle-outline',
    title: 'Request taken',
    body: 'Another professional accepted the Socket repair request in BTM Layout before you did.',
  },
  {
    // The stress case: a title and a body long enough to wrap, and to be cut, at 360dp.
    minutesAgo: 3 * HOUR - 1,
    read: false,
    type: 'request.new',
    iconName: 'clipboard-text-outline',
    title: 'New request near you: Full house wiring inspection before tenancy handover',
    body:
      'A customer in Hoysala Nagar, Indiranagar 2nd Stage Extension needs a full house wiring ' +
      'inspection before a tenancy handover. It is open to every professional nearby, so the ' +
      'first to accept it gets the job.',
    deepLink: requestLink('REQ-2026-BLR-EAST-0031021'),
  },
  {
    minutesAgo: 9 * HOUR - 1,
    read: true,
    type: 'request.new',
    iconName: 'clipboard-text-outline',
    title: 'New request',
    body: 'Neha Sharma needs a Light fitting replacement.',
    deepLink: requestLink('REQ-30987'),
  },
  {
    // A link the app does not understand: reading it marks it read and opens nothing.
    minutesAgo: DAY,
    read: false,
    type: 'review.received',
    iconName: 'star-outline',
    title: 'New review',
    body: 'Karthik Iyer rated your Geyser wiring job 5 out of 5.',
    deepLink: 'fixora://reviews',
  },
  {
    minutesAgo: 2 * DAY + 18 * HOUR,
    read: true,
    type: 'review.received',
    iconName: 'star-outline',
    title: 'New review',
    body: 'Sana Khan rated your Doorbell installation job 4 out of 5.',
    deepLink: 'fixora://reviews',
  },
  {
    minutesAgo: 12 * DAY,
    read: true,
    type: 'account.welcome',
    iconName: 'storefront-outline',
    title: 'Your business is on Fixora',
    body: 'Your profile is set up. New requests in your trade will appear under Requests.',
  },
];

interface MockInbox {
  /** Ids are this prefix and a position, so no two accounts share one. */
  idPrefix: string;
  seeds: readonly NotificationSeed[];
  /** Every one unread, whatever the seed says: an account that never opened the inbox. */
  allUnread?: boolean;
}

const INBOXES: Readonly<Record<string, MockInbox>> = Object.freeze({
  usr_customer_1: { idPrefix: 'ntf_c1', seeds: CUSTOMER_HISTORY },
  usr_customer_2: { idPrefix: 'ntf_c2', seeds: CUSTOMER_HISTORY, allUnread: true },
  usr_vendor_1: { idPrefix: 'ntf_v1', seeds: RAVI_INBOX },
});

/** An account's starting inbox, timestamped against the given clock. Fresh objects each call. */
export function mockInboxFor(userId: string, nowMs: number): AppNotification[] {
  const inbox = INBOXES[userId];
  if (!inbox) {
    return [];
  }

  return inbox.seeds.map((seed, index) => {
    const { minutesAgo, read, ...notification } = seed;

    return {
      id: `${inbox.idPrefix}_${String(index + 1).padStart(2, '0')}`,
      ...notification,
      createdAt: new Date(nowMs - minutesAgo * MS_PER_MINUTE).toISOString(),
      read: inbox.allUnread ? false : read,
    };
  });
}
