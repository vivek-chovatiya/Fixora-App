/**
 * MOCK VENDOR REVIEW DATA — DEVELOPMENT ONLY
 *
 * The reviews customers have written about a mock vendor's work, so the
 * vendor's Reviews screen (PROJECT_BIBLE.md section 41, Phase 3E-6) can be
 * built before there is a backend to hold them. Fixtures, not records: no
 * customer wrote any of this, and none of it reaches a production build.
 *
 * ⚠️ Not the customer's reviews. A review a customer sends in this app is kept
 * under that customer's id (`MockReviewStorage`) and is about a request raised
 * to the customer app's catalogue of vendors (`MockVendorService`), which are
 * not vendor accounts. Nothing joins the two — matching, dispatch and the
 * review's owner are the backend's (section 18A.1) — so reading a vendor's
 * reviews out of customers' storage would be inventing that join. The two
 * mocks meet when the backend does, as the dashboard's docblock says of
 * requests.
 *
 * ⚠️ Reviews of work the vendor really finished. Each one names a request by
 * reference, and that reference is one of the vendor's completed jobs in
 * `mockVendorDashboardData` — the same jobs the Requests tab lists under
 * Completed. The service and customer a review shows come from that job, not
 * from here, so a name is written once and the two screens cannot disagree
 * about who a job was for. A reference the vendor's work does not hold gets no
 * service or customer, which is how "where supported" is exercised.
 *
 * ⚠️ Deterministic. Every review is written out; nothing is random, no timer
 * adds one, and finishing a job in the app (Phase 3E-5) does not produce a
 * review — whether a customer reviews is the customer's choice, so not every
 * finished job has one (Ravi's `REQ-30744` never will). The only input is the
 * clock, which turns "a day ago" into a timestamp, always after the job it
 * reviews was completed.
 */

import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import type { VendorReview } from '@/shared/services/types/ReviewService';

export type MockVendorReviewScenario =
  /** Nobody has reviewed this vendor yet — a business that has just set up. */
  | 'none'
  /** Exactly one review, so "1 review" is reachable. */
  | 'single'
  /** Several, of different ratings, one long and one with no comment. */
  | 'several';

const MS_PER_MINUTE = 60_000;
const HOUR = 60;
const DAY = 24 * HOUR;

/** A review as the fixture writes it: an age in minutes instead of a timestamp. */
interface ReviewSeed {
  requestId: string;
  rating: number;
  comment?: string;
  submittedMinutesAgo: number;
}

/**
 * The stress case: close to the 500 characters a customer may write
 * (`REVIEW_COMMENT_MAX_LENGTH`), so a card has to wrap a full paragraph at 360dp.
 */
const LONG_COMMENT =
  'The doorbell works well and the wiring is neatly tucked away now. He was careful ' +
  'drilling near the tiles and covered the floor before starting, which I appreciated. ' +
  'It took longer than expected because the old transformer had to be replaced, and he ' +
  'explained why before going ahead rather than surprising us at the end. I would have ' +
  'given five stars, but we had to call twice to confirm the time. Overall a good ' +
  'experience, and I would book again for other electrical work.';

/**
 * Ravi's reviews: four of his five finished jobs (the `mixed` scenario's
 * completed group). Newest first here, but the service orders them itself.
 */
const SEVERAL: readonly ReviewSeed[] = [
  {
    // Geyser wiring, completed a day and four hours ago.
    requestId: 'REQ-30912',
    rating: 5,
    comment:
      'Arrived on time, found the loose connection quickly and explained what had gone wrong. Left everything clean.',
    submittedMinutesAgo: DAY,
  },
  {
    // Doorbell installation, completed three days ago.
    requestId: 'REQ-30876',
    rating: 4,
    comment: LONG_COMMENT,
    submittedMinutesAgo: 2 * DAY + 18 * HOUR,
  },
  {
    // Socket replacement, completed five days ago. Stars only: the comment is optional.
    requestId: 'REQ-30833',
    rating: 5,
    submittedMinutesAgo: 4 * DAY + 20 * HOUR,
  },
  {
    // Earthing check, completed eight days ago — old enough to be dated, not aged.
    requestId: 'REQ-30790',
    rating: 3,
    comment: 'The earthing is fixed, but he came two hours later than the time we agreed.',
    submittedMinutesAgo: 7 * DAY + 12 * HOUR,
  },
];

/** One review, of a job `several` leaves unreviewed — so the two never share one. */
const SINGLE: readonly ReviewSeed[] = [
  {
    // Tube light replacement, completed eleven days ago.
    requestId: 'REQ-30744',
    rating: 4,
    comment: 'Quick and tidy.',
    submittedMinutesAgo: 10 * DAY,
  },
];

const SCENARIOS: Readonly<Record<MockVendorReviewScenario, readonly ReviewSeed[]>> = Object.freeze({
  none: [],
  single: SINGLE,
  several: SEVERAL,
});

/**
 * Which vendor has which reviews.
 *
 * Ravi (`usr_vendor_1`), who has finished work, has been reviewed for most of
 * it. Meena (`usr_vendor_2`) has finished nothing yet (`openOnly`), so nobody
 * has reviewed her — which is also what makes "Vendor B sees none of Vendor A's
 * reviews" checkable by signing in. Any vendor registered in the app has none.
 */
const VENDOR_REVIEW_SCENARIOS: Readonly<Record<string, MockVendorReviewScenario>> = Object.freeze({
  usr_vendor_1: 'several',
});

export function mockReviewScenarioFor(vendorId: string): MockVendorReviewScenario {
  return VENDOR_REVIEW_SCENARIOS[vendorId] ?? 'none';
}

/**
 * A scenario's reviews, timestamped against the given clock, each with the
 * service and customer of the finished job it is about when `finished` holds
 * it. Fresh objects each call; in fixture order — ordering is the service's.
 */
export function buildMockVendorReviews(
  scenario: MockVendorReviewScenario,
  nowMs: number,
  finished: readonly VendorJobSummary[],
): VendorReview[] {
  return SCENARIOS[scenario].map(seed => {
    const job = finished.find(candidate => candidate.id === seed.requestId);

    return {
      requestId: seed.requestId,
      rating: seed.rating,
      ...(seed.comment === undefined ? {} : { comment: seed.comment }),
      submittedAt: new Date(nowMs - seed.submittedMinutesAgo * MS_PER_MINUTE).toISOString(),
      ...(job ? { serviceName: job.serviceName, customerName: job.customerName } : {}),
    };
  });
}
