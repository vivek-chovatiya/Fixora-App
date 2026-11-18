/**
 * The reviewed job's reference on the vendor's reviews (request contract,
 * 17/11/2026: every review the backend returns carries its request's
 * `requestNumber`). Pinned here, apart from the customer side's tests of the
 * same service: `getVendorReviews` maps `requestNumber` to an optional
 * `reference`, leaves it absent when the backend sends none, and still keeps
 * `requestId` for what the review is about.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import { type AxiosAdapter, type AxiosResponse } from 'axios';

import { httpClient } from '@/core/http/HttpClient';
import type { AuthUser } from '@/features/auth/types';
import { ApiReviewService } from '@/shared/services/api/ApiReviewService';

const VENDOR_ID = '6afc3e5d7c2e50812e44de9b';
const REQUEST_A = '6afc3ea3c2951ec40c9a177a';
const REQUEST_B = '6afc3ea3c2951ec40c9a1799';
const vendor: AuthUser = { id: VENDOR_ID, firstName: 'Ravi', lastName: 'Kumar', phone: '9000000001', role: 'vendor' };
const originalAdapter = httpClient.defaults.adapter;

function backendAnswers(reviews: unknown[]): void {
  const adapter: AxiosAdapter = async config => {
    const data =
      config.url === '/vendors/detail'
        ? { id: VENDOR_ID, businessName: 'Kumar Electricals', averageRating: 4.5, totalReviews: 2 }
        : reviews;
    const response: AxiosResponse = {
      data: {
        success: true,
        message: 'Done.',
        data,
        meta: { total: reviews.length, page: 1, limit: 100, pages: 1, hasNextPage: false },
        errors: null,
      },
      status: 200,
      statusText: '',
      headers: {},
      config,
    };
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

const reviewRow = (serviceRequestId: string, extra: Record<string, unknown> = {}) => ({
  id: `${serviceRequestId.slice(0, 20)}aaaa`,
  serviceRequestId,
  customerId: { _id: '6afc3e5d7c2e50812e44de8f', firstName: 'Asha', lastName: 'Patel' },
  vendorId: VENDOR_ID,
  rating: 5,
  comment: 'Quick and tidy.',
  createdAt: '2026-11-16T10:00:00.000Z',
  ...extra,
});

beforeEach(() => {
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

it('maps each review’s requestNumber to its reference, and leaves it absent when there is none', async () => {
  backendAnswers([reviewRow(REQUEST_A, { requestNumber: 'REQ-213754' }), reviewRow(REQUEST_B)]);

  const { reviews } = await new ApiReviewService({ currentUser: async () => vendor }).getVendorReviews();

  expect(reviews[0]).toMatchObject({ requestId: REQUEST_A, reference: 'REQ-213754' });
  expect(reviews[1].requestId).toBe(REQUEST_B);
  expect(reviews[1]).not.toHaveProperty('reference');
  expect(JSON.stringify(reviews)).not.toMatch(/_id|requestNumber/);
});
