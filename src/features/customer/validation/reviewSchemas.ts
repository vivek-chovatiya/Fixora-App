/**
 * Review form schema (PROJECT_BIBLE.md section 24).
 *
 * ⚠️ Section 24's shape, and nothing it does not say. A rating from one to five
 * stars is required — it is what a review is. The comment is optional (confirmed
 * by the owner on 2026-09-22), so an empty box and a box of spaces are both "no
 * comment" rather than errors. Section 24 sets no minimum length, and none is
 * invented here.
 */

import { z } from 'zod';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { REQUEST_NOTES_MAX_LENGTH } from '@/features/customer/validation/requestSchemas';
import { REVIEW_RATING_MAX, REVIEW_RATING_MIN } from '@/shared/services/types/ReviewService';

const COPY = CUSTOMER_COPY.review;

/**
 * Ceiling on the comment, in characters.
 *
 * ⚠️ Section 24 sets none. This is the ceiling the app already puts on the one
 * other free-text box a customer fills in — a request's notes — reused rather
 * than invented, so the two boxes behave the same. It stops a pasted document,
 * nothing more; the backend's own limit is the authority when there is one, and
 * WORKING_NOTES lists it as an open decision.
 */
export const REVIEW_COMMENT_MAX_LENGTH = REQUEST_NOTES_MAX_LENGTH;

/** No stars chosen yet. Outside the scale, so it can never be sent. */
export const NO_RATING = 0;

export const reviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(REVIEW_RATING_MIN, COPY.ratingRequired)
    .max(REVIEW_RATING_MAX, COPY.ratingRequired),

  /**
   * Bounded, never altered — the customer's own words, as a request's notes
   * are. Whether it is sent at all is decided where the payload is built.
   */
  comment: z
    .string()
    .max(
      REVIEW_COMMENT_MAX_LENGTH,
      COPY.commentTooLong.replace('{count}', String(REVIEW_COMMENT_MAX_LENGTH)),
    ),
});

export type ReviewForm = z.infer<typeof reviewSchema>;
