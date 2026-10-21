/**
 * useSubmitReview
 *
 * Sends a customer's review of a request (PROJECT_BIBLE.md section 24).
 *
 *   Screen → hook → ReviewService interface → implementation
 *
 * The form's values become the service's payload here and nowhere else. The
 * form holds `0` for "no stars yet" and an empty string for "no comment";
 * neither is sent — the schema has already refused the first, and the second is
 * left off the payload rather than sent empty.
 *
 * Section 54's `review_submitted` is sent here, once the service has accepted
 * the review: the request and the stars, as the service recorded them.
 * ⚠️ Never the comment — it is the customer's own words about a named
 * professional — and nothing at all for a refusal or a failure.
 */

import { useCallback } from 'react';

import type { ReviewForm } from '@/features/customer/validation/reviewSchemas';
import { useAnalytics } from '@/shared/hooks/useAnalytics';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { getService } from '@/shared/services/ServiceRegistry';
import type { RequestReview, SubmitReviewInput } from '@/shared/services/types/ReviewService';
import type { AppError } from '@/shared/types/error';

export interface ReviewSubmission {
  /** Resolves with the accepted review, or `null` when the call failed. */
  submit: (values: ReviewForm) => Promise<RequestReview | null>;
  isSubmitting: boolean;
  error: AppError | null;
}

/**
 * Builds the payload. Exported for its test.
 *
 * The comment is sent exactly as typed, or not at all: only emptiness is
 * judged, and only to decide whether the field is there. Trimming would be the
 * app editing what the customer said.
 */
export function buildSubmitReviewInput(requestId: string, values: ReviewForm): SubmitReviewInput {
  return {
    requestId,
    rating: values.rating,
    ...(values.comment.trim().length > 0 ? { comment: values.comment } : {}),
  };
}

export function useSubmitReview(requestId: string): ReviewSubmission {
  const mutation = useServiceMutation((input: SubmitReviewInput) =>
    getService('review').submitReview(input),
  );

  const { mutate } = mutation;
  const { track } = useAnalytics();

  const submit = useCallback(
    async (values: ReviewForm) => {
      const accepted = await mutate(buildSubmitReviewInput(requestId, values));

      if (accepted) {
        track('review_submitted', { requestId, rating: accepted.rating });
      }
      return accepted;
    },
    [mutate, track, requestId],
  );

  return { submit, isSubmitting: mutation.isSubmitting, error: mutation.error };
}
