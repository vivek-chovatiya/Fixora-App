/**
 * The mock review service stands in for the server section 24's rules will live
 * on, so it is held to them independently of any screen:
 *
 * - only a completed or closed request can be reviewed; every other status, and
 *   one section 21 does not name, is refused
 * - one request, one review — refused a second time however it arrives, even
 *   two submissions racing each other
 * - the rating is a whole number of stars from one to five; the comment is
 *   optional and kept exactly as written
 * - a review changes nothing else: the request's status and record are what
 *   they were
 * - reviews survive a restart, per customer, and a customer never sees another's
 *
 * Latency is switched off; the in-memory AsyncStorage from jest.setup.js stands
 * in for the device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AsyncStorageMockRequestHistory } from '@/shared/services/mock/MockRequestHistoryStorage';
import { MockRequestService } from '@/shared/services/mock/MockRequestService';
import { MockReviewService } from '@/shared/services/mock/MockReviewService';
import {
  AsyncStorageMockReviewStorage,
  type MockReviewStorage,
} from '@/shared/services/mock/MockReviewStorage';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type { CustomerRequestDetails, RequestService } from '@/shared/services/types/RequestService';
import { AppError } from '@/shared/types/error';

/** The seed's completed request (`MockRequestService`). */
const COMPLETED_ID = 'REQ-24048';
/** The seed's cancelled request. */
const CANCELLED_ID = 'REQ-24020';
/** The seed's request in progress. */
const IN_PROGRESS_ID = 'REQ-24076';

const RECORD: CustomerRequestDetails = {
  id: 'REQ-9001',
  categoryId: 'cat_electrician',
  subCategoryId: 'sub_fan_repair',
  categoryName: 'Electrician',
  serviceName: 'Fan Repair',
  status: 'COMPLETED',
  priority: 'LOW',
  createdAt: '2026-09-20T10:00:00.000Z',
  address: { formattedAddress: '9, Sector 2, HSR Layout, Bengaluru 560102' },
};

/** A request table answering with one record in whatever status a test needs. */
function tableWith(status: string): Pick<RequestService, 'getRequest'> {
  return {
    getRequest: jest.fn(async (requestId: string) =>
      requestId === RECORD.id ? { ...RECORD, status } : null,
    ),
  };
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
  await AsyncStorage.clear();
});

describe('MockReviewService — which requests can be reviewed', () => {
  for (const status of ['COMPLETED', 'CLOSED', ' closed ']) {
    it(`accepts a review of a request that is ${JSON.stringify(status)}`, async () => {
      const service = new MockReviewService({ requests: tableWith(status), latency: NO_LATENCY });

      const review = await service.submitReview({ requestId: RECORD.id, rating: 5 });

      expect(review).toEqual({
        requestId: RECORD.id,
        rating: 5,
        submittedAt: expect.any(String),
      });
      expect(Number.isNaN(Date.parse(review.submittedAt))).toBe(false);
    });
  }

  for (const status of [
    'CREATED',
    'PENDING_VENDOR',
    'ACCEPTED',
    'IN_PROGRESS',
    'REJECTED',
    'CANCELLED',
    'ON_HOLD',
    'ESCALATED_TO_REGION',
    '',
  ]) {
    it(`refuses a review of a request that is ${JSON.stringify(status)}, and keeps none`, async () => {
      const service = new MockReviewService({ requests: tableWith(status), latency: NO_LATENCY });

      const error = await refusal(service.submitReview({ requestId: RECORD.id, rating: 4 }));

      expect(error.kind).toBe('conflict');
      expect(await service.getReview(RECORD.id)).toBeNull();
    });
  }

  it('refuses a review of a request that does not exist', async () => {
    const service = new MockReviewService({ requests: tableWith('COMPLETED'), latency: NO_LATENCY });

    const error = await refusal(service.submitReview({ requestId: 'REQ-0000', rating: 4 }));

    expect(error.kind).toBe('notFound');
  });

  it('reads eligibility from the real request table, seed included', async () => {
    const requests = new MockRequestService({ latency: NO_LATENCY });
    const service = new MockReviewService({ requests, latency: NO_LATENCY });

    await expect(service.submitReview({ requestId: COMPLETED_ID, rating: 3 })).resolves.toMatchObject({
      requestId: COMPLETED_ID,
      rating: 3,
    });
    expect((await refusal(service.submitReview({ requestId: CANCELLED_ID, rating: 3 }))).kind).toBe(
      'conflict',
    );
    expect(
      (await refusal(service.submitReview({ requestId: IN_PROGRESS_ID, rating: 3 }))).kind,
    ).toBe('conflict');
  });
});

describe('MockReviewService — the rating and the comment', () => {
  const service = () =>
    new MockReviewService({ requests: tableWith('COMPLETED'), latency: NO_LATENCY });

  it('accepts both ends of the scale', async () => {
    await expect(
      service().submitReview({ requestId: RECORD.id, rating: 1 }),
    ).resolves.toMatchObject({ rating: 1 });
    await expect(
      service().submitReview({ requestId: RECORD.id, rating: 5 }),
    ).resolves.toMatchObject({ rating: 5 });
  });

  for (const rating of [0, 6, -1, 3.5, Number.NaN]) {
    it(`refuses a rating of ${rating}`, async () => {
      const reviews = service();

      const error = await refusal(reviews.submitReview({ requestId: RECORD.id, rating }));

      expect(error.kind).toBe('validation');
      expect(await reviews.getReview(RECORD.id)).toBeNull();
    });
  }

  it('keeps a comment exactly as it was written', async () => {
    const comment = '  Arrived early.\nFixed it in ten minutes.  ';

    const review = await service().submitReview({ requestId: RECORD.id, rating: 4, comment });

    expect(review.comment).toBe(comment);
  });

  it('keeps no comment at all for one that is blank', async () => {
    const review = await service().submitReview({ requestId: RECORD.id, rating: 4, comment: '   ' });

    expect(Object.keys(review)).not.toContain('comment');
  });
});

describe('MockReviewService — one request, one review', () => {
  it('reads back the review it accepted', async () => {
    const service = new MockReviewService({ requests: tableWith('COMPLETED'), latency: NO_LATENCY });

    const sent = await service.submitReview({ requestId: RECORD.id, rating: 2, comment: 'Late.' });

    expect(await service.getReview(RECORD.id)).toEqual(sent);
  });

  it('answers null for a request with no review, rather than failing', async () => {
    const service = new MockReviewService({ requests: tableWith('COMPLETED'), latency: NO_LATENCY });

    await expect(service.getReview(RECORD.id)).resolves.toBeNull();
  });

  it('refuses a second review, and keeps the first', async () => {
    const service = new MockReviewService({ requests: tableWith('COMPLETED'), latency: NO_LATENCY });

    const first = await service.submitReview({ requestId: RECORD.id, rating: 5 });
    const error = await refusal(service.submitReview({ requestId: RECORD.id, rating: 1 }));

    expect(error.kind).toBe('conflict');
    expect(await service.getReview(RECORD.id)).toEqual(first);
  });

  it('lets exactly one of two racing submissions through', async () => {
    const service = new MockReviewService({ requests: tableWith('COMPLETED'), latency: NO_LATENCY });

    const outcomes = await Promise.allSettled([
      service.submitReview({ requestId: RECORD.id, rating: 5 }),
      service.submitReview({ requestId: RECORD.id, rating: 5 }),
    ]);

    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    const [rejected] = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );
    expect(AppError.from(rejected.reason).kind).toBe('conflict');
  });

  it('hands out copies, so a caller cannot edit a review by editing a result', async () => {
    const service = new MockReviewService({ requests: tableWith('COMPLETED'), latency: NO_LATENCY });

    const sent = await service.submitReview({ requestId: RECORD.id, rating: 3 });
    sent.rating = 5;
    const read = await service.getReview(RECORD.id);
    if (read) {
      read.rating = 1;
    }

    expect((await service.getReview(RECORD.id))?.rating).toBe(3);
  });
});

describe('MockReviewService — the request is left alone', () => {
  it('changes nothing about the request it reviews', async () => {
    const requests = new MockRequestService({ latency: NO_LATENCY });
    const service = new MockReviewService({ requests, latency: NO_LATENCY });

    const before = await requests.getRequest(COMPLETED_ID);
    const listedBefore = await requests.listRecentRequests(50);

    await service.submitReview({ requestId: COMPLETED_ID, rating: 4, comment: 'Good.' });

    expect(await requests.getRequest(COMPLETED_ID)).toEqual(before);
    expect(await requests.listRecentRequests(50)).toEqual(listedBefore);
  });
});

describe('MockReviewService — after a restart', () => {
  const CUSTOMER = 'usr_customer_1';

  /** The services the app builds on launch, for whoever is signed in. */
  function launch(customer: () => Promise<string | null> = async () => CUSTOMER) {
    const requests = new MockRequestService({
      latency: NO_LATENCY,
      history: new AsyncStorageMockRequestHistory(),
      currentCustomerId: customer,
    });
    return new MockReviewService({
      requests,
      latency: NO_LATENCY,
      storage: new AsyncStorageMockReviewStorage(),
      currentCustomerId: customer,
    });
  }

  it('still has the review, and still refuses a second one', async () => {
    const sent = await launch().submitReview({ requestId: COMPLETED_ID, rating: 4, comment: 'Tidy.' });

    const restarted = launch();

    expect(await restarted.getReview(COMPLETED_ID)).toEqual(sent);
    expect(
      (await refusal(restarted.submitReview({ requestId: COMPLETED_ID, rating: 1 }))).kind,
    ).toBe('conflict');
  });

  it('keeps one customer’s reviews from another', async () => {
    let customer: string | null = CUSTOMER;
    const service = launch(async () => customer);

    await service.submitReview({ requestId: COMPLETED_ID, rating: 5 });

    customer = 'usr_customer_2';
    expect(await service.getReview(COMPLETED_ID)).toBeNull();
    // And the second customer can review their own copy of the seed.
    await expect(service.submitReview({ requestId: COMPLETED_ID, rating: 2 })).resolves.toMatchObject({
      rating: 2,
    });

    customer = CUSTOMER;
    expect((await service.getReview(COMPLETED_ID))?.rating).toBe(5);
  });

  it('keeps reviews in memory only when nobody is signed in', async () => {
    const service = launch(async () => null);
    const writes = jest.mocked(AsyncStorage.setItem).mock.calls.length;

    await service.submitReview({ requestId: COMPLETED_ID, rating: 5 });

    expect(jest.mocked(AsyncStorage.setItem).mock.calls.length).toBe(writes);
    expect(await service.getReview(COMPLETED_ID)).toMatchObject({ rating: 5 });
  });

  it('still accepts a review the device fails to save, and says nothing untrue', async () => {
    const failing: MockReviewStorage = {
      read: async () => [],
      save: async () => false,
    };
    const service = new MockReviewService({
      requests: tableWith('COMPLETED'),
      latency: NO_LATENCY,
      storage: failing,
      currentCustomerId: async () => CUSTOMER,
    });

    await expect(service.submitReview({ requestId: RECORD.id, rating: 3 })).resolves.toMatchObject({
      rating: 3,
    });
    // Accepted for this session, so still one review.
    expect(
      (await refusal(service.submitReview({ requestId: RECORD.id, rating: 3 }))).kind,
    ).toBe('conflict');
  });
});
