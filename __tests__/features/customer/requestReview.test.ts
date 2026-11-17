/**
 * Section 24's rules as the app applies them, in the one place it applies them:
 *
 * - `reviewAvailabilityOf` offers a review only for a completed or closed
 *   request with no review, shows one that exists, and fails closed for every
 *   other status — including one section 21 does not name
 * - the schema requires one to five whole stars and nothing else: the comment is
 *   optional, whitespace is no comment, and the only limit is the ceiling the
 *   app already puts on free text
 * - the payload sends the comment exactly as typed, or not at all
 */

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import {
  describeRating,
  isReviewableStatus,
  reviewAvailabilityOf,
} from '@/features/customer/constants/requestReview';
import { buildSubmitReviewInput } from '@/features/customer/hooks/useSubmitReview';
import {
  NO_RATING,
  REVIEW_COMMENT_MAX_LENGTH,
  reviewSchema,
} from '@/features/customer/validation/reviewSchemas';
import { REQUEST_NOTES_MAX_LENGTH } from '@/features/customer/validation/requestSchemas';
import type { RequestReview } from '@/shared/services/types/ReviewService';

const COPY = CUSTOMER_COPY.review;

const REVIEW: RequestReview = {
  requestId: 'REQ-24048',
  rating: 4,
  submittedAt: '2026-09-22T10:00:00.000Z',
};

const NOT_REVIEWABLE = [
  'CREATED',
  'PENDING_VENDOR',
  'ACCEPTED',
  'IN_PROGRESS',
  'REJECTED',
  'CANCELLED',
  'ON_HOLD',
  'ESCALATED_TO_REGION',
  '',
];

describe('reviewAvailabilityOf', () => {
  for (const status of ['COMPLETED', 'CLOSED', 'completed', ' Closed ']) {
    it(`offers a review for ${JSON.stringify(status)} once the service says there is none`, () => {
      expect(isReviewableStatus(status)).toBe(true);
      expect(reviewAvailabilityOf(status, null)).toBe('open');
    });

    it(`waits for the service before offering anything for ${JSON.stringify(status)}`, () => {
      expect(reviewAvailabilityOf(status, undefined)).toBe('checking');
    });
  }

  for (const status of NOT_REVIEWABLE) {
    it(`offers nothing for ${JSON.stringify(status)}`, () => {
      expect(isReviewableStatus(status)).toBe(false);
      expect(reviewAvailabilityOf(status, null)).toBe('unavailable');
      expect(reviewAvailabilityOf(status, undefined)).toBe('unavailable');
    });
  }

  it('fails closed for a status that is not a string at all', () => {
    expect(isReviewableStatus(undefined as unknown as string)).toBe(false);
    expect(reviewAvailabilityOf(null as unknown as string, null)).toBe('unavailable');
  });

  it('shows a review that exists, and never offers another', () => {
    expect(reviewAvailabilityOf('COMPLETED', REVIEW)).toBe('reviewed');
    expect(reviewAvailabilityOf('CLOSED', REVIEW)).toBe('reviewed');
  });
});

describe('describeRating', () => {
  it('says a rating the same way everywhere, out of five', () => {
    expect(describeRating(1)).toBe('1 out of 5 stars');
    expect(describeRating(4)).toBe('4 out of 5 stars');
    expect(describeRating(5)).toBe('5 out of 5 stars');
  });
});

describe('reviewSchema', () => {
  const parse = (rating: number, comment = '') => reviewSchema.safeParse({ rating, comment });

  it('accepts both ends of the scale', () => {
    expect(parse(1).success).toBe(true);
    expect(parse(5).success).toBe(true);
  });

  it('refuses no rating, with words that say what to do', () => {
    const result = parse(NO_RATING);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(COPY.ratingRequired);
  });

  for (const rating of [6, -1, 2.5]) {
    it(`refuses a rating of ${rating}`, () => {
      expect(parse(rating).success).toBe(false);
    });
  }

  it('does not require a comment', () => {
    expect(parse(3, '').success).toBe(true);
    expect(parse(3, '    ').success).toBe(true);
  });

  it('sets no minimum length on a comment', () => {
    expect(parse(3, 'Ok').success).toBe(true);
  });

  it('uses the ceiling the app already puts on free text, and says what it is', () => {
    expect(REVIEW_COMMENT_MAX_LENGTH).toBe(REQUEST_NOTES_MAX_LENGTH);
    expect(parse(3, 'a'.repeat(REVIEW_COMMENT_MAX_LENGTH)).success).toBe(true);

    const result = parse(3, 'a'.repeat(REVIEW_COMMENT_MAX_LENGTH + 1));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      COPY.commentTooLong.replace('{count}', String(REVIEW_COMMENT_MAX_LENGTH)),
    );
  });
});

describe('buildSubmitReviewInput', () => {
  it('sends the rating and the comment exactly as typed', () => {
    expect(
      buildSubmitReviewInput('REQ-1', { rating: 5, comment: '  On time.\nTidy.  ' }),
    ).toEqual({ requestId: 'REQ-1', rating: 5, comment: '  On time.\nTidy.  ' });
  });

  it('leaves out a comment that is empty or only whitespace', () => {
    for (const comment of ['', '   ', '\n\t']) {
      const input = buildSubmitReviewInput('REQ-1', { rating: 2, comment });

      expect(input).toEqual({ requestId: 'REQ-1', rating: 2 });
      expect(Object.keys(input)).not.toContain('comment');
    }
  });
});
