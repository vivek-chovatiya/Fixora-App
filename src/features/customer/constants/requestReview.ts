/**
 * Request review
 *
 * Whether a customer may review a request, in one place (PROJECT_BIBLE.md
 * section 24).
 *
 * ⚠️ The only place the app decides it. Request Details and the review screen
 * both ask `reviewAvailabilityOf`; neither compares a status itself, so the rule
 * cannot drift between the button that opens the review and the screen it
 * opens.
 *
 * ⚠️ The app's copy of the rule, not the authority. The backend refuses a review
 * it will not accept (`ReviewService.submitReview`), and the screens are written
 * against that refusal — this only decides what is worth offering.
 *
 * Section 24: a review "only after the request reaches the appropriate
 * completed/closed state", and "one request = one review only". The owner
 * confirmed on 2026-09-22 that both `COMPLETED` and `CLOSED` are reviewable.
 * Every other status — every section 21 alternative, and any value section 21
 * does not name — is not, so a status the app has never seen fails closed.
 *
 * Nothing here is a request status, and nothing here changes one. Whether a
 * request has been reviewed is the review's answer, read from `ReviewService`;
 * the request stays exactly as completed or closed as it was.
 */

import type { RequestStatus } from '@/shared/services/types/RequestService';
import type { RequestReview } from '@/shared/services/types/ReviewService';

/**
 * A rating as it is said: "4 out of 5 stars". Shared since Phase 3E-6, so the
 * vendor's reviews say a rating exactly as the customer's review does;
 * re-exported here so this module's callers are untouched.
 */
export { describeRating } from '@/shared/presentation/rating';

/** Section 24's reviewable statuses. Compared case- and padding-insensitively. */
const REVIEWABLE_STATUSES: ReadonlySet<string> = new Set(['COMPLETED', 'CLOSED']);

/**
 * Whether a request in this status may be reviewed at all.
 *
 * Used to decide whether it is worth asking the review service anything: a
 * request that can never be reviewed has no review to look up.
 */
export function isReviewableStatus(status: RequestStatus): boolean {
  return typeof status === 'string' && REVIEWABLE_STATUSES.has(status.trim().toUpperCase());
}

/**
 * What the customer can do about reviewing a request.
 *
 * - `unavailable` — the request is not completed or closed; nothing is offered
 * - `checking` — it could be reviewed, and the review service has not answered
 * - `open` — it can be reviewed and has not been
 * - `reviewed` — it has a review, which is shown read-only and never offered again
 */
export type ReviewAvailability = 'unavailable' | 'checking' | 'open' | 'reviewed';

/**
 * The one decision.
 *
 * `review` is `undefined` while unknown and `null` when the service answered
 * that there is none. A review that exists wins over the status: section 24 turns
 * a submitted review into a read-only one, and hiding it because the request
 * later moved would lose something the customer said.
 */
export function reviewAvailabilityOf(
  status: RequestStatus,
  review: RequestReview | null | undefined,
): ReviewAvailability {
  if (review) {
    return 'reviewed';
  }

  if (!isReviewableStatus(status)) {
    return 'unavailable';
  }

  return review === null ? 'open' : 'checking';
}
