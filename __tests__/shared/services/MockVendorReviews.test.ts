/**
 * The vendor's side of the mock review service (PROJECT_BIBLE.md section 41,
 * Phase 3E-6), held to what the real endpoint is expected to do:
 *
 * - it answers for the signed-in vendor only — nobody signed in, and a
 *   customer, are refused; there is no vendor id to pass, so no caller can ask
 *   for another vendor's reviews
 * - one vendor never sees another's reviews, on the same service instance and
 *   with sessions switching between reads
 * - the average and the count are computed by the service, from the reviews it
 *   returns, and an average of nothing is null — never zero
 * - the breakdown is five counts, five stars first, counted from the same
 *   reviews — so it always agrees with the count — and five zeros for a vendor
 *   with none
 * - the reviews are newest first, written after the job they are about was
 *   finished, and each names that job's service and customer — or nothing,
 *   when the vendor's work does not hold it
 * - deterministic: the same clock gives the same answer, and nothing appears
 *   by itself
 * - a customer's own reviews never leak into a vendor's list, and sending one
 *   still works beside the vendor wiring
 *
 * Latency is switched off.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthUser } from '@/features/auth/types';
import { MockReviewService } from '@/shared/services/mock/MockReviewService';
import { buildMockVendorWork } from '@/shared/services/mock/mockVendorDashboardData';
import type { MockVendorReviewScenario } from '@/shared/services/mock/mockVendorReviewData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type { CustomerRequestDetails, RequestService } from '@/shared/services/types/RequestService';
import {
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  type VendorReviews,
} from '@/shared/services/types/ReviewService';
import { AppError } from '@/shared/types/error';

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const MEENA: AuthUser = {
  id: 'usr_vendor_2',
  firstName: 'Meena',
  lastName: 'Iyer',
  phone: '9000000002',
  role: 'vendor',
};

/** A vendor registered in the app, whom no fixture knows. */
const NEWCOMER: AuthUser = {
  id: 'usr_vendor_registered_9',
  firstName: 'Anil',
  lastName: 'Joshi',
  phone: '9000000009',
  role: 'vendor',
};

const ASHA: AuthUser = {
  id: 'usr_1',
  firstName: 'Asha',
  lastName: 'Patel',
  phone: '9876543210',
  role: 'customer',
};

/** A fixed clock, so every timestamp is pinned. */
const NOW = Date.parse('2026-10-08T12:00:00.000Z');

/** Ravi's reviews, newest first, as the fixtures write them. */
const RAVI_ORDER = ['REQ-30912', 'REQ-30876', 'REQ-30833', 'REQ-30790'];

/** A request table the vendor side never needs; the customer side reads it. */
const NO_REQUESTS: Pick<RequestService, 'getRequest'> = {
  getRequest: jest.fn(async () => null),
};

let current: AuthUser | null;

function service(
  options: {
    reviewScenarios?: Record<string, MockVendorReviewScenario>;
    requests?: Pick<RequestService, 'getRequest'>;
  } = {},
) {
  return new MockReviewService({
    requests: options.requests ?? NO_REQUESTS,
    latency: NO_LATENCY,
    currentUser: async () => current,
    now: () => NOW,
    ...(options.reviewScenarios
      ? {
          vendorReviewScenarioFor: (vendorId: string) =>
            options.reviewScenarios?.[vendorId] ?? 'none',
        }
      : {}),
  });
}

/** What the service rejected with, as an AppError. */
async function refusal(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    return AppError.from(caught);
  }
  throw new Error('Expected the call to be refused');
}

beforeEach(async () => {
  current = RAVI;
  await AsyncStorage.clear();
});

describe('MockReviewService — a vendor with reviews', () => {
  let answer: VendorReviews;

  beforeEach(async () => {
    answer = await service().getVendorReviews();
  });

  it('answers with exactly the figures and the list, nothing else', () => {
    expect(Object.keys(answer).sort()).toEqual([
      'averageRating',
      'ratingBreakdown',
      'reviews',
      'totalReviews',
    ]);
  });

  it('counts the reviews per star, five stars first, every star sent', () => {
    expect(answer.ratingBreakdown).toEqual([
      { stars: 5, count: 2 },
      { stars: 4, count: 1 },
      { stars: 3, count: 1 },
      { stars: 2, count: 0 },
      { stars: 1, count: 0 },
    ]);
    for (const entry of answer.ratingBreakdown) {
      expect(Object.keys(entry).sort()).toEqual(['count', 'stars']);
    }
  });

  it('counts the breakdown from the very reviews it returns, so it agrees with the total', () => {
    const counted = answer.ratingBreakdown.reduce((total, entry) => total + entry.count, 0);
    expect(counted).toBe(answer.totalReviews);

    for (const entry of answer.ratingBreakdown) {
      expect(entry.count).toBe(answer.reviews.filter(review => review.rating === entry.stars).length);
    }
  });

  it('lists the reviews newest first', () => {
    expect(answer.reviews.map(review => review.requestId)).toEqual(RAVI_ORDER);

    const times = answer.reviews.map(review => Date.parse(review.submittedAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('counts them and averages them itself, to one decimal place', () => {
    // 5, 4, 5 and 3 stars.
    expect(answer.reviews.map(review => review.rating)).toEqual([5, 4, 5, 3]);
    expect(answer.totalReviews).toBe(4);
    expect(answer.averageRating).toBe(4.3);
  });

  it('keeps every rating whole and on the scale', () => {
    for (const review of answer.reviews) {
      expect(Number.isInteger(review.rating)).toBe(true);
      expect(review.rating).toBeGreaterThanOrEqual(REVIEW_RATING_MIN);
      expect(review.rating).toBeLessThanOrEqual(REVIEW_RATING_MAX);
    }
  });

  it('names the service and customer of the finished job each review is about', () => {
    const finished = buildMockVendorWork('mixed', NOW).completed;

    for (const review of answer.reviews) {
      const job = finished.find(candidate => candidate.id === review.requestId);
      expect(job).toBeDefined();
      expect(review.serviceName).toBe(job?.serviceName);
      expect(review.customerName).toBe(job?.customerName);
    }
    expect(answer.reviews[0]).toMatchObject({
      serviceName: 'Geyser wiring',
      customerName: 'Karthik Iyer',
    });
  });

  it('dates every review after the job was finished and before now', () => {
    const finished = buildMockVendorWork('mixed', NOW).completed;

    for (const review of answer.reviews) {
      const job = finished.find(candidate => candidate.id === review.requestId);
      expect(Date.parse(review.submittedAt)).toBeGreaterThan(Date.parse(String(job?.completedAt)));
      expect(Date.parse(review.submittedAt)).toBeLessThan(NOW);
    }
  });

  it('does not review every finished job — a customer need not', () => {
    const finished = buildMockVendorWork('mixed', NOW).completed.map(job => job.id);

    expect(finished).toContain('REQ-30744');
    expect(answer.reviews.map(review => review.requestId)).not.toContain('REQ-30744');
  });

  it('leaves a review with no comment without one — not an empty string', () => {
    const starsOnly = answer.reviews.find(review => review.requestId === 'REQ-30833');

    expect(starsOnly).toBeDefined();
    expect('comment' in (starsOnly ?? {})).toBe(false);
    expect(Object.keys(starsOnly ?? {}).sort()).toEqual([
      'customerName',
      'rating',
      'reference',
      'requestId',
      'serviceName',
      'submittedAt',
    ]);
  });

  it('holds one long comment, within the 500 characters a customer may write', () => {
    const long = answer.reviews.find(review => review.requestId === 'REQ-30876');

    expect(long?.comment?.length).toBeGreaterThan(400);
    expect(long?.comment?.length).toBeLessThanOrEqual(500);
  });
});

describe('MockReviewService — a vendor with no reviews', () => {
  /** Every star sent, every count zero — not an empty breakdown. */
  const NO_BREAKDOWN = [5, 4, 3, 2, 1].map(stars => ({ stars, count: 0 }));

  it('answers with no average, a count of zero, five zeros and nothing to list', async () => {
    current = MEENA;

    expect(await service().getVendorReviews()).toEqual({
      averageRating: null,
      totalReviews: 0,
      ratingBreakdown: NO_BREAKDOWN,
      reviews: [],
    });
  });

  it('is the answer for a vendor registered in the app, whom no fixture knows', async () => {
    current = NEWCOMER;

    expect(await service().getVendorReviews()).toEqual({
      averageRating: null,
      totalReviews: 0,
      ratingBreakdown: NO_BREAKDOWN,
      reviews: [],
    });
  });
});

describe('MockReviewService — one review', () => {
  it('averages a single review to its own rating', async () => {
    current = MEENA;
    const answer = await service({ reviewScenarios: { [MEENA.id]: 'single' } }).getVendorReviews();

    expect(answer.totalReviews).toBe(1);
    expect(answer.averageRating).toBe(4);
    expect(answer.reviews.map(review => review.requestId)).toEqual(['REQ-30744']);
    expect(answer.ratingBreakdown.map(entry => entry.count)).toEqual([0, 1, 0, 0, 0]);
  });

  it('names no service or customer when the vendor’s own work does not hold the job', async () => {
    // Meena's work is open requests only, so the job reviewed is not hers to describe.
    current = MEENA;
    const [review] = (
      await service({ reviewScenarios: { [MEENA.id]: 'single' } }).getVendorReviews()
    ).reviews;

    expect(Object.keys(review).sort()).toEqual(['comment', 'rating', 'reference', 'requestId', 'submittedAt']);
  });
});

describe('MockReviewService — whose reviews', () => {
  it('never shows one vendor another vendor’s reviews', async () => {
    const reviews = service({
      reviewScenarios: { [RAVI.id]: 'several', [MEENA.id]: 'single' },
    });

    current = RAVI;
    const ravi = (await reviews.getVendorReviews()).reviews.map(review => review.requestId);
    current = MEENA;
    const meena = (await reviews.getVendorReviews()).reviews.map(review => review.requestId);
    current = RAVI;
    const raviAgain = (await reviews.getVendorReviews()).reviews.map(review => review.requestId);

    expect(ravi).toEqual(RAVI_ORDER);
    expect(meena).toEqual(['REQ-30744']);
    expect(meena.filter(id => ravi.includes(id))).toEqual([]);
    expect(raviAgain).toEqual(ravi);
  });

  it('gives each vendor their own figures', async () => {
    const reviews = service({
      reviewScenarios: { [RAVI.id]: 'several', [MEENA.id]: 'single' },
    });

    current = MEENA;
    const meena = await reviews.getVendorReviews();
    current = RAVI;
    const ravi = await reviews.getVendorReviews();

    expect([meena.averageRating, meena.totalReviews]).toEqual([4, 1]);
    expect([ravi.averageRating, ravi.totalReviews]).toEqual([4.3, 4]);
  });

  it('refuses when nobody is signed in', async () => {
    current = null;

    expect((await refusal(service().getVendorReviews())).kind).toBe('unauthorized');
  });

  it('refuses a customer', async () => {
    current = ASHA;

    expect((await refusal(service().getVendorReviews())).kind).toBe('unauthorized');
  });

  it('refuses when it was never told who is signed in', async () => {
    const reviews = new MockReviewService({ requests: NO_REQUESTS, latency: NO_LATENCY });

    expect((await refusal(reviews.getVendorReviews())).kind).toBe('unauthorized');
  });

  it('takes no vendor id: whose reviews they are is the session’s alone', () => {
    expect(service().getVendorReviews.length).toBe(0);
  });
});

describe('MockReviewService — deterministic', () => {
  it('gives the same answer to the same clock, read after read', async () => {
    const reviews = service();

    const first = await reviews.getVendorReviews();
    const second = await reviews.getVendorReviews();

    expect(second).toEqual(first);
  });

  it('hands out fresh objects, so a caller cannot change the next answer', async () => {
    const reviews = service();

    const first = await reviews.getVendorReviews();
    first.reviews[0].rating = 1;
    first.reviews.pop();
    first.ratingBreakdown[0].count = 99;

    const second = await reviews.getVendorReviews();
    expect(second.reviews[0].rating).toBe(5);
    expect(second.reviews).toHaveLength(4);
    expect(second.ratingBreakdown[0]).toEqual({ stars: 5, count: 2 });
  });
});

describe('MockReviewService — the customer’s side is untouched', () => {
  const RECORD: CustomerRequestDetails = {
    // Deliberately one of Ravi's references: the two sides share no data.
    id: 'REQ-30744',
    categoryId: 'cat_electrician',
    subCategoryId: 'sub_tube_light',
    categoryName: 'Electrician',
    serviceName: 'Tube light replacement',
    status: 'COMPLETED',
    priority: 'LOW',
    createdAt: '2026-09-20T10:00:00.000Z',
    address: { formattedAddress: '9, Sector 2, HSR Layout, Bengaluru 560102' },
  };

  const requests: Pick<RequestService, 'getRequest'> = {
    getRequest: jest.fn(async (requestId: string) => (requestId === RECORD.id ? RECORD : null)),
  };

  it('still accepts a customer’s review, and it never reaches a vendor’s list', async () => {
    const reviews = service({ requests });

    current = ASHA;
    const sent = await reviews.submitReview({ requestId: RECORD.id, rating: 1, comment: 'Late.' });
    expect(sent).toMatchObject({ requestId: RECORD.id, rating: 1, comment: 'Late.' });
    expect(await reviews.getReview(RECORD.id)).toMatchObject({ rating: 1 });

    current = RAVI;
    const ravi = await reviews.getVendorReviews();
    expect(ravi.reviews.map(review => review.requestId)).toEqual(RAVI_ORDER);
    expect(ravi.totalReviews).toBe(4);
    expect(JSON.stringify(ravi)).not.toContain('Late.');
  });
});
