/**
 * What a vendor's notifications may say about a customer (owner decision,
 * 21/10/2026): no more than the request itself would show them.
 *
 * The notification text is the backend's to compose and the app shows it as
 * sent, so the rule is pinned on the fixtures standing in for that backend:
 *
 * - a notification about work the vendor does not hold — a request waiting
 *   for them or declined (read from the vendor request mock's own state), one
 *   that is no longer theirs to open, or one with no link at all — names no
 *   customer of the vendor's work; the names are read from the fixture data,
 *   not listed here, so a new fixture is covered without editing this file
 * - a review notification never says the reviewer's surname: first name and
 *   initial, as the Reviews screen does ("Karthik I.")
 * - held work may still name its customer
 */

import { parseNotificationLink } from '@/features/notifications/constants/notificationLinks';
import { reviewerName } from '@/features/vendor/constants/reviewPresentation';
import { mockInboxFor } from '@/shared/services/mock/mockNotificationData';
import { MockVendorRequestBook } from '@/shared/services/mock/MockVendorRequestBook';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import {
  buildMockVendorWork,
  mockScenarioFor,
} from '@/shared/services/mock/mockVendorDashboardData';
import {
  buildMockVendorReviews,
  mockReviewScenarioFor,
} from '@/shared/services/mock/mockVendorReviewData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type { AppNotification } from '@/shared/services/types/NotificationService';

const RAVI_ID = 'usr_vendor_1';
const NOW = new Date('2026-10-21T10:00:00.000Z').getTime();

const inbox = mockInboxFor(RAVI_ID, NOW);

/** Every customer the vendor's work names, read from the fixtures themselves. */
const work = buildMockVendorWork(mockScenarioFor(RAVI_ID), NOW);
const CUSTOMERS = [...work.pending, ...work.active, ...work.completed]
  .map(job => job.customerName?.trim())
  .filter((name): name is string => typeof name === 'string' && name.length > 0);

/** Whether a text says a name, whole or by any word of it ("Rahul", "Menon"). */
function mentions(text: string, name: string): boolean {
  const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [name, ...name.split(/\s+/)].some(part =>
    new RegExp(`(^|[^\\p{L}])${escape(part)}([^\\p{L}]|$)`, 'u').test(text),
  );
}

const said = (notification: AppNotification) => `${notification.title}\n${notification.body}`;

/** The references of the requests this vendor holds, as the request mock reports them now. */
async function heldReferences(): Promise<Set<string>> {
  const requests = new MockVendorRequestService({
    latency: NO_LATENCY,
    currentUser: async () => ({
      id: RAVI_ID,
      firstName: 'Ravi',
      lastName: 'Kumar',
      phone: '9000000001',
      role: 'vendor',
    }),
    now: () => NOW,
    book: new MockVendorRequestBook(),
  });
  const list = await requests.listRequests();
  return new Set([...list.active, ...list.completed].map(job => job.id));
}

const isReview = (notification: AppNotification) => notification.type === 'review.received';

describe('A vendor notification about work they do not hold', () => {
  it('reads its names from the fixtures — there are some to look for', () => {
    expect(CUSTOMERS.length).toBeGreaterThanOrEqual(8);
    expect(inbox.length).toBeGreaterThan(0);
  });

  it('names no customer of the vendor’s work, by full name or any part of it', async () => {
    const held = await heldReferences();
    const unheld = inbox.filter(notification => {
      if (isReview(notification)) {
        return false;
      }
      const target = parseNotificationLink(notification.deepLink);
      // No request link at all — taken by somebody else, or about the account — is not held work.
      return target === null || !held.has(target.requestId);
    });

    // The waiting requests, the one somebody else took, and the welcome are all here.
    expect(unheld.length).toBeGreaterThanOrEqual(5);
    for (const notification of unheld) {
      for (const name of CUSTOMERS) {
        expect({ id: notification.id, mentions: mentions(said(notification), name), name }).toEqual({
          id: notification.id,
          mentions: false,
          name,
        });
      }
    }
  });

  it('says where instead, when the request has an area', () => {
    const directed = inbox.find(notification => notification.deepLink?.endsWith('/REQ-31038'));

    expect(directed?.body).toBe('A customer in HSR Layout chose you for a Ceiling fan installation.');
  });
});

describe('A review notification', () => {
  const reviews = buildMockVendorReviews(mockReviewScenarioFor(RAVI_ID), NOW, work.completed);
  const reviewers = reviews
    .map(review => review.customerName?.trim())
    .filter((name): name is string => typeof name === 'string' && name.includes(' '));

  it('never says a reviewer’s surname — only the first name and initial the Reviews screen shows', () => {
    const notices = inbox.filter(isReview);
    expect(notices.length).toBeGreaterThan(0);
    expect(reviewers.length).toBeGreaterThan(0);

    for (const notification of notices) {
      for (const full of reviewers) {
        const words = full.split(/\s+/);
        const surname = words[words.length - 1];
        expect(said(notification)).not.toContain(full);
        expect(mentions(said(notification), surname)).toBe(false);
      }
    }
    // The form the Reviews screen uses, where a review names its reviewer.
    expect(notices.map(notification => notification.body)).toContain(
      `${reviewerName('Karthik Iyer')} rated your Geyser wiring job 5 out of 5.`,
    );
  });
});
