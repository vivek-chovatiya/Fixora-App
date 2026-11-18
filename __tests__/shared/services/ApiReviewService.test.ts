/**
 * ApiReviewService against the real backend. These tests pin:
 *
 * - submitting: the route, the exact body (no empty comment), the record read
 *   back, and every refusal as the interface's kind — the backend's plain 400
 *   for "not reviewable" is a `conflict`, its validation 400 stays `validation`;
 * - "my review of this request": one `/reviews/detail { requestId }` call, both
 *   404s (`REVIEW_NOT_FOUND`, `REQUEST_NOT_FOUND`) as `null`, and a review handed
 *   back for another request or customer treated as none;
 * - the vendor's reviews: their own id only, the backend's average and count,
 *   a breakdown of five counted from the reviews read;
 * - roles: each side refuses the other, asking the backend nothing;
 * - that a reviewer's or vendor's contact details and `_id` never leave.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { httpClient } from '@/core/http/HttpClient';
import type { AuthUser } from '@/features/auth/types';
import { ApiReviewService } from '@/shared/services/api/ApiReviewService';
import { AppError } from '@/shared/types/error';

type Reply = { status: number; body: unknown } | 'network';

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

function backendAnswers(reply: (url: string, body: Record<string, unknown>) => Reply): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    const answer = reply(config.url ?? '', JSON.parse((config.data as string) ?? '{}'));
    if (answer === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response: AxiosResponse = { data: answer.body, status: answer.status, statusText: '', headers: {}, config };
    if (answer.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

function ok(data: unknown, meta: Record<string, unknown> = {}, status = 200): Reply {
  return { status, body: { success: true, message: 'OK', data, meta, errors: null } };
}

function list(data: unknown[], meta: Record<string, unknown> = {}): Reply {
  return ok(data, { total: data.length, page: 1, limit: 100, pages: 1, hasNextPage: false, ...meta });
}

function failure(status: number, code: string | undefined, errors: unknown = null): Reply {
  return { status, body: { success: false, message: 'Backend English', ...(code ? { code } : {}), errors, data: null } };
}

function bodies(): Record<string, unknown>[] {
  return sent.map(config => JSON.parse((config.data as string) ?? '{}'));
}

const CUSTOMER_ID = '6afc3e5d7c2e50812e44de8f';
const OTHER_CUSTOMER_ID = '6afc3e5d7c2e50812e44de90';
const VENDOR_ID = '6afc3e5d7c2e50812e44de9b';
const REQUEST_ID = '6afc3ea3c2951ec40c9a177a';
const OTHER_REQUEST_ID = '6afc3ea3c2951ec40c9a1799';

const CUSTOMER: AuthUser = { id: CUSTOMER_ID, firstName: 'Asha', lastName: 'Patel', phone: '9876543210', role: 'customer' };
const VENDOR: AuthUser = { id: VENDOR_ID, firstName: 'Ravi', lastName: 'Kumar', phone: '9000000001', role: 'vendor' };

/** A row of `/reviews/vendor`: the customer populated with first and last name only. */
function reviewRow(requestId: string, rating: number, extra: Record<string, unknown> = {}) {
  return {
    id: `6afc40${requestId.slice(6)}`,
    serviceRequestId: requestId,
    customerId: { _id: CUSTOMER_ID, firstName: 'Asha', lastName: 'Patel', profileImage: null },
    vendorId: VENDOR_ID,
    rating,
    comment: 'Quick and tidy.',
    images: [],
    createdAt: '2026-11-17T12:00:00.000Z',
    updatedAt: '2026-11-17T12:00:00.000Z',
    ...extra,
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

let user: AuthUser | null;
let service: ApiReviewService;

beforeEach(() => {
  sent.length = 0;
  user = CUSTOMER;
  for (const method of ['log', 'warn', 'error', 'info'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  service = new ApiReviewService({ currentUser: async () => user });
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

describe('submitReview', () => {
  it('sends the request, the stars and the comment, exactly', async () => {
    backendAnswers(() => ok(reviewRow(REQUEST_ID, 4, { customerId: CUSTOMER_ID }), {}, 201));

    const review = await service.submitReview({ requestId: REQUEST_ID, rating: 4, comment: 'Quick and tidy.' });

    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/reviews');
    expect(bodies()[0]).toEqual({ serviceRequestId: REQUEST_ID, rating: 4, comment: 'Quick and tidy.' });
    expect(review).toEqual({
      requestId: REQUEST_ID,
      rating: 4,
      comment: 'Quick and tidy.',
      submittedAt: '2026-11-17T12:00:00.000Z',
    });
  });

  it.each([
    ['absent', undefined],
    ['blank', '   '],
  ])('sends no comment key when it is %s, and keeps none', async (_case, comment) => {
    backendAnswers(() => ok(reviewRow(REQUEST_ID, 5, { comment: '' }), {}, 201));

    const review = await service.submitReview({ requestId: REQUEST_ID, rating: 5, comment });

    expect(Object.keys(bodies()[0]).sort()).toEqual(['rating', 'serviceRequestId']);
    expect(review).not.toHaveProperty('comment');
  });

  it.each([
    ['not completed yet (a plain 400)', failure(400, 'BAD_REQUEST'), 'conflict'],
    ['not completed, from a backend that sends no code', failure(400, undefined), 'conflict'],
    ['already reviewed', failure(409, 'CONFLICT'), 'conflict'],
    ['somebody else’s, or gone', failure(404, 'NOT_FOUND'), 'notFound'],
    ['a rating outside the scale', failure(400, 'VALIDATION_FAILED', [{ field: 'rating', message: 'x' }]), 'validation'],
    ['no connection', 'network' as const, 'network'],
  ])('reads a review refused as %s as %s', async (_case, reply, kind) => {
    backendAnswers(() => reply);

    const error = await rejectionOf(service.submitReview({ requestId: REQUEST_ID, rating: 4 }));

    expect(error.kind).toBe(kind);
    expect(error.userMessage).not.toContain('Backend English');
  });

  it('refuses a review read back for another request as a server fault', async () => {
    backendAnswers(() => ok(reviewRow(OTHER_REQUEST_ID, 4), {}, 201));

    const error = await rejectionOf(service.submitReview({ requestId: REQUEST_ID, rating: 4 }));

    expect(error.kind).toBe('server');
  });

  it('refuses a vendor, asking the backend nothing', async () => {
    user = VENDOR;
    backendAnswers(() => ok(reviewRow(REQUEST_ID, 4), {}, 201));

    const error = await rejectionOf(service.submitReview({ requestId: REQUEST_ID, rating: 4 }));

    expect(error.kind).toBe('unauthorized');
    expect(sent).toHaveLength(0);
  });
});

describe('getReview', () => {
  it('asks for this customer’s review of this request, in one call', async () => {
    backendAnswers(() => ok({ ...reviewRow(REQUEST_ID, 4, { customerId: CUSTOMER_ID }), requestNumber: 'REQ-0031002405' }));

    const review = await service.getReview(REQUEST_ID);

    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/reviews/detail');
    expect(bodies()[0]).toEqual({ requestId: REQUEST_ID });
    expect(review).toEqual({
      requestId: REQUEST_ID,
      rating: 4,
      comment: 'Quick and tidy.',
      submittedAt: '2026-11-17T12:00:00.000Z',
    });
    expect(JSON.stringify(review)).not.toMatch(/_id|REQ-0031002405|Asha|customerId/);
  });

  it.each([
    ['none yet', failure(404, 'REVIEW_NOT_FOUND')],
    ['not this customer’s request', failure(404, 'REQUEST_NOT_FOUND')],
  ])('answers null when there is %s', async (_case, reply) => {
    backendAnswers(() => reply);

    await expect(service.getReview(REQUEST_ID)).resolves.toBeNull();
  });

  it.each([
    ['another request', reviewRow(OTHER_REQUEST_ID, 4)],
    ['another customer', reviewRow(REQUEST_ID, 4, { customerId: { _id: OTHER_CUSTOMER_ID, firstName: 'X' } })],
  ])('treats a review handed back for %s as none', async (_case, row) => {
    backendAnswers(() => ok(row));

    await expect(service.getReview(REQUEST_ID)).resolves.toBeNull();
  });

  it.each([
    ['no connection', 'network' as const, 'network'],
    ['a server fault', failure(500, 'INTERNAL_ERROR'), 'server'],
  ])('rejects on %s rather than answering null', async (_case, reply, kind) => {
    backendAnswers(() => reply);

    const error = await rejectionOf(service.getReview(REQUEST_ID));

    expect(error.kind).toBe(kind);
  });

  it('refuses a review with stars off the scale as a server fault', async () => {
    backendAnswers(() => ok(reviewRow(REQUEST_ID, 0)));

    const error = await rejectionOf(service.getReview(REQUEST_ID));

    expect(error.kind).toBe('server');
  });

  it('refuses nobody signed in, asking the backend nothing', async () => {
    user = null;
    backendAnswers(() => ok(reviewRow(REQUEST_ID, 4)));

    const error = await rejectionOf(service.getReview(REQUEST_ID));

    expect(error.kind).toBe('unauthorized');
    expect(sent).toHaveLength(0);
  });
});

describe('getVendorReviews', () => {
  beforeEach(() => {
    user = VENDOR;
  });

  it('asks for the signed-in vendor’s own reviews and figures, and counts the breakdown', async () => {
    backendAnswers(url =>
      url === '/vendors/detail'
        ? ok({ id: VENDOR_ID, email: 'ravi@example.com', phone: '9000000001', averageRating: 4.3, totalReviews: 3 })
        : list([
            reviewRow(REQUEST_ID, 5),
            reviewRow(OTHER_REQUEST_ID, 4, { comment: '', customerId: { _id: OTHER_CUSTOMER_ID, firstName: 'Meera', lastName: '' } }),
            reviewRow('6afc3ea3c2951ec40c9a1788', 4, { customerId: null }),
          ]),
    );

    const result = await service.getVendorReviews();

    expect(new Set(sent.map(config => config.url))).toEqual(new Set(['/vendors/detail', '/reviews/vendor']));
    expect(bodies().find(body => 'id' in body)).toEqual({ id: VENDOR_ID });
    expect(bodies().find(body => 'vendorId' in body)).toEqual({ vendorId: VENDOR_ID, page: 1, limit: 100 });
    expect(result).toEqual({
      averageRating: 4.3,
      totalReviews: 3,
      ratingBreakdown: [
        { stars: 5, count: 1 },
        { stars: 4, count: 2 },
        { stars: 3, count: 0 },
        { stars: 2, count: 0 },
        { stars: 1, count: 0 },
      ],
      reviews: [
        { requestId: REQUEST_ID, rating: 5, comment: 'Quick and tidy.', submittedAt: '2026-11-17T12:00:00.000Z', customerName: 'Asha Patel' },
        { requestId: OTHER_REQUEST_ID, rating: 4, submittedAt: '2026-11-17T12:00:00.000Z', customerName: 'Meera' },
        // No customer populated: no name drawn, never a placeholder.
        { requestId: '6afc3ea3c2951ec40c9a1788', rating: 4, comment: 'Quick and tidy.', submittedAt: '2026-11-17T12:00:00.000Z' },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/_id|ravi@example.com|9000000001|profileImage/);
  });

  it('has no average for a vendor nobody has reviewed — not zero stars', async () => {
    backendAnswers(url => (url === '/vendors/detail' ? ok({ id: VENDOR_ID, averageRating: 0, totalReviews: 0 }) : list([])));

    const result = await service.getVendorReviews();

    expect(result.averageRating).toBeNull();
    expect(result.totalReviews).toBe(0);
    expect(result.ratingBreakdown.map(entry => entry.count)).toEqual([0, 0, 0, 0, 0]);
    expect(result.reviews).toEqual([]);
  });

  it('refuses a customer, asking the backend nothing', async () => {
    user = CUSTOMER;
    backendAnswers(() => list([]));

    const error = await rejectionOf(service.getVendorReviews());

    expect(error.kind).toBe('unauthorized');
    expect(sent).toHaveLength(0);
  });

  it('refuses a review with stars off the scale as a server fault', async () => {
    backendAnswers(url =>
      url === '/vendors/detail' ? ok({ id: VENDOR_ID, averageRating: 4, totalReviews: 1 }) : list([reviewRow(REQUEST_ID, 7)]),
    );

    const error = await rejectionOf(service.getVendorReviews());

    expect(error.kind).toBe('server');
  });
});
