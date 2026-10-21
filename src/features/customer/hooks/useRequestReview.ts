/**
 * useRequestReview
 *
 * The customer's review of one request, read back (PROJECT_BIBLE.md section 24).
 *
 *   Screen → hook → ReviewService interface → implementation
 *
 * ⚠️ Asked only when there could be an answer worth having. `enabled` is false
 * until the request is known, and a caller passes false for a request that is
 * not reviewable — so a request still under way costs no review lookup at all.
 *
 * `review` is `undefined` while unknown and `null` when the service answered that
 * there is none, which is what `reviewAvailabilityOf` reads.
 */

import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { RequestReview } from '@/shared/services/types/ReviewService';
import type { AppError } from '@/shared/types/error';

export interface RequestReviewQuery {
  /** Undefined until answered, null when there is no review. */
  review: RequestReview | null | undefined;
  isLoading: boolean;
  error: AppError | null;
  /** Reads it again from a failure, showing the loading state. */
  retry: () => void;
  /** Reads it again while what is shown stays on screen. */
  refresh: () => void;
}

export function useRequestReview(requestId: string, enabled: boolean): RequestReviewQuery {
  const query = useServiceQuery<RequestReview | null>(
    () => getService('review').getReview(requestId),
    [requestId],
    { enabled },
  );

  return {
    // Nothing is known while the lookup is switched off, whatever an earlier
    // lookup said.
    review: enabled ? query.data : undefined,
    isLoading: enabled && query.isLoading,
    error: enabled ? query.error : null,
    retry: query.retry,
    refresh: query.refresh,
  };
}
