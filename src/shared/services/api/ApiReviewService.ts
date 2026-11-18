/**
 * ApiReviewService
 *
 * ReviewService against the real backend (PROJECT_BIBLE.md sections 24 and
 * 41): a customer's review of a finished request, and the reviews a vendor has
 * received. Replaces `MockReviewService`, which joined against the mock request
 * table and so must go live together with `request`.
 *
 * Endpoints: `POST /reviews` (submit), `POST /reviews/detail` (the customer's
 * review of one request, `requests-contract.md` §8), `POST /reviews/vendor`
 * (one vendor's reviews, newest first, paged), `POST /vendors/detail` (a
 * vendor's published average and count).
 *
 * Decisions:
 * - **"My review of this request"** is one call, `/reviews/detail { requestId }`.
 *   Both of its 404s are the interface's `null`: `REVIEW_NOT_FOUND` (none yet —
 *   the ordinary answer) and `REQUEST_NOT_FOUND` (not this customer's request,
 *   which has no review this customer can see). Nothing is cached.
 * - **Refusals keep the interface's kinds.** The backend answers a request that
 *   is not completed (or has no vendor) with a plain 400; the interface calls
 *   that a `conflict` — the request moved on, read again rather than send
 *   again. A 400 the backend's validation raised stays `validation`. 404 is
 *   `notFound` and 409 (already reviewed) `conflict`, as HttpClient reads them.
 * - **The vendor's figures are the backend's**: `averageRating` and
 *   `totalReviews` from the vendor's own record, `null` average for nobody yet.
 *   The breakdown by stars is counted here from the reviews read, because the
 *   backend sends none; the interface already says it trusts those counts
 *   over the total when they disagree (the seeded vendors carry totals with no
 *   reviews behind them).
 *
 * ⚠️ Scope is the session's. The customer's side asks only about the signed-in
 * customer's own review and treats one handed back for another customer or
 * request as none; the vendor's side asks only for the signed-in vendor's own id.
 */

import { createLogger } from '@/core/logger/Logger';
import type { AuthUser } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import {
  malformedResponse,
  optionalString,
  populated,
  referenceId,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import {
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  type RequestReview,
  type ReviewService,
  type SubmitReviewInput,
  type VendorRatingCount,
  type VendorReview,
  type VendorReviews,
} from '@/shared/services/types/ReviewService';
import { AppError } from '@/shared/types/error';

const log = createLogger('ApiReviewService');

function isStars(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= REVIEW_RATING_MIN &&
    value <= REVIEW_RATING_MAX
  );
}

/** One review row as section 24's record. `requestId` is the request it is about. */
function toReview(record: Record<string, unknown>, requestId: string): RequestReview {
  const rating = record.rating;
  if (!isStars(rating)) {
    throw malformedResponse('review.rating');
  }
  const comment = optionalString(record, 'comment');

  return {
    requestId,
    rating,
    ...(comment ? { comment } : {}),
    submittedAt: requireString(record, 'createdAt', 'review'),
  };
}

function toVendorReview(record: Record<string, unknown>): VendorReview {
  const requestId = referenceId(record.serviceRequestId);
  if (!requestId) {
    throw malformedResponse('review.serviceRequestId');
  }
  // `/reviews/vendor` populates the customer's first and last name, and nothing else is read.
  const customer = populated(record.customerId);
  const customerName = customer
    ? [optionalString(customer, 'firstName'), optionalString(customer, 'lastName')]
        .filter((part): part is string => part !== undefined)
        .join(' ')
        .trim()
    : '';
  // The reviewed request's `REQ-…` (request contract, 17/11/2026): shown, never sent back.
  const reference = optionalString(record, 'requestNumber');

  return {
    ...toReview(record, requestId),
    ...(reference ? { reference } : {}),
    ...(customerName ? { customerName } : {}),
  };
}

/**
 * The backend's plain 400 on `/reviews` is "not reviewable" (not completed, or
 * no vendor): a `conflict` to the interface. Its validation 400 stays as it is.
 */
function asReviewRefusal(error: unknown): unknown {
  if (
    error instanceof AppError &&
    error.kind === 'validation' &&
    error.code !== 'VALIDATION_FAILED' &&
    error.fieldErrors === undefined
  ) {
    return new AppError({
      kind: 'conflict',
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      cause: error.cause,
    });
  }
  return error;
}

export interface ApiReviewServiceOptions {
  /** Whoever is signed in, or null. Each method decides whether the role fits. */
  currentUser: () => Promise<AuthUser | null>;
}

export class ApiReviewService extends BaseApiService implements ReviewService {
  private readonly currentUser: () => Promise<AuthUser | null>;

  constructor(options: ApiReviewServiceOptions) {
    // Three resources, so the paths are whole.
    super('');
    this.currentUser = options.currentUser;
  }

  async getReview(requestId: string): Promise<RequestReview | null> {
    const customer = await this.requireRole('customer');

    let data: unknown;
    try {
      data = await this.post<unknown>('/reviews/detail', { requestId });
    } catch (error) {
      // REVIEW_NOT_FOUND (none yet) and REQUEST_NOT_FOUND (not theirs) are both "no review".
      if (error instanceof AppError && error.kind === 'notFound') {
        log.info('Review read', { found: false });
        return null;
      }
      throw error;
    }

    const record = requireRecord(data, 'review');
    const customerId = referenceId(record.customerId);
    if (
      referenceId(record.serviceRequestId) !== requestId ||
      (customerId !== undefined && customerId !== customer.id)
    ) {
      log.warn('A review handed back for another request or customer was treated as none');
      return null;
    }

    // Whether, never which: a reference leads back to an address.
    log.info('Review read', { found: true });
    return toReview(record, requestId);
  }

  async submitReview(input: SubmitReviewInput): Promise<RequestReview> {
    await this.requireRole('customer');

    // Blank is no comment at all, so nothing empty is sent or kept.
    const comment =
      typeof input.comment === 'string' && input.comment.trim() !== '' ? input.comment : undefined;

    let data: unknown;
    try {
      data = await this.post<unknown>('/reviews', {
        serviceRequestId: input.requestId,
        rating: input.rating,
        ...(comment !== undefined ? { comment } : {}),
      });
    } catch (error) {
      throw asReviewRefusal(error);
    }

    const record = requireRecord(data, 'review');
    if (referenceId(record.serviceRequestId) !== input.requestId) {
      throw malformedResponse('review.serviceRequestId');
    }

    // The shape, never the words: a comment is the customer's own.
    log.info('Review submitted', { rating: input.rating, hasComment: comment !== undefined });
    return toReview(record, input.requestId);
  }

  async getVendorReviews(): Promise<VendorReviews> {
    const vendor = await this.requireRole('vendor');

    const [profile, rows] = await Promise.all([
      this.post<unknown>('/vendors/detail', { id: vendor.id }),
      this.postAllPages('/reviews/vendor', { vendorId: vendor.id }).then(list => list.items),
    ]);

    const record = requireRecord(profile, 'vendor');
    const total = record.totalReviews;
    const totalReviews = typeof total === 'number' && Number.isInteger(total) && total > 0 ? total : 0;
    const average = record.averageRating;
    const averageRating =
      totalReviews > 0 && typeof average === 'number' && Number.isFinite(average) ? average : null;

    const reviews = rows.map(row => toVendorReview(requireRecord(row, 'review')));

    // Five entries, five stars first, a star nobody gave counted as zero.
    const ratingBreakdown: VendorRatingCount[] = [];
    for (let stars = REVIEW_RATING_MAX; stars >= REVIEW_RATING_MIN; stars -= 1) {
      ratingBreakdown.push({ stars, count: reviews.filter(review => review.rating === stars).length });
    }

    return { averageRating, totalReviews, ratingBreakdown, reviews };
  }

  /** What an authenticated endpoint does to nobody, or to the other role. */
  private async requireRole(role: AuthUser['role']): Promise<AuthUser> {
    const user = await this.currentUser();
    if (!user || user.role !== role) {
      throw new AppError({ kind: 'unauthorized', message: `Reviews: no ${role} session` });
    }
    return user;
  }
}
