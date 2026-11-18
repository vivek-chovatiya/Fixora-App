/**
 * ReviewService
 *
 * The only route to a customer's review of a request (PROJECT_BIBLE.md
 * section 24).
 *
 * ⚠️ Its own service, not a method on `RequestService`. A review is something
 * the customer says about a request once it is done; it is not part of the
 * request, and it never moves it. Section 21's statuses are the backend's, and
 * nothing here reads as one or writes one: a request that has been reviewed is
 * exactly as `COMPLETED` or `CLOSED` as it was before.
 *
 * Section 24 fixes what this contract carries and no more:
 *
 * - a rating from one to five stars
 * - a comment (optional — confirmed by the owner on 2026-09-22)
 * - one review per request, so the request's own reference is the association
 *   and there is no review identifier the app ever has to hold
 * - read-only once submitted: there is no update and no delete here, because
 *   section 24 gives a customer neither
 *
 * Section 24's "optional images (if supported)" are deliberately absent. The
 * owner deferred them on 2026-09-22; when they arrive they are one more optional
 * field on the input and the record, beside the ones below, and nothing else
 * moves.
 *
 * ⚠️ A frontend contract. No backend review endpoint exists yet, so nothing here
 * is something a server has agreed to. Scope is the session's, as it is for
 * `RequestService`: a customer asks about their own requests and nobody else's.
 *
 * The other side of the same reviews (section 41, Phase 3E-6): a vendor reads
 * the reviews written about their own work, read-only. Extended here rather
 * than given a parallel `VendorReviewService`, because it is one review — the
 * record a customer sent — seen by the person it is about; a second review
 * model would be a second thing to keep in step with section 24. Each method
 * belongs to one role and the service refuses the other: `getReview` and
 * `submitReview` are a customer's, `getVendorReviews` a vendor's.
 */

/** The bounds of section 24's scale. Whole stars only. */
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;

/** A customer's review of one of their requests, as the backend holds it. */
export interface RequestReview {
  /** The request it is about — section 24's "one request = one review". */
  requestId: string;

  /** A whole number of stars, `REVIEW_RATING_MIN` to `REVIEW_RATING_MAX`. */
  rating: number;

  /**
   * The customer's own words, exactly as sent. Absent when they left none,
   * never an empty string.
   */
  comment?: string;

  /** ISO 8601, set by the backend rather than by the device's clock. */
  submittedAt: string;
}

/**
 * A review, as the vendor it is about reads it (section 41).
 *
 * The same review — `RequestReview`, exactly as the customer sent it — with
 * what the vendor needs to recognise the job beside it. A customer reading
 * their own review already has the request in hand; a vendor looking down a
 * list of them does not, so the backend says which job each one was for.
 *
 * ⚠️ Both additions are optional and display only. Absent when the backend
 * does not say, and then simply not drawn — never a placeholder name. The
 * reference (`requestId`) is the association; these are never matched on.
 */
export interface VendorReview extends RequestReview {
  /**
   * The reference people quote for the job (`REQ-…`) — the same one the
   * vendor saw on it (`VendorJobSummary.reference`; request contract,
   * 17/11/2026). The mock sets its request id, which is its reference. Absent
   * when the backend sends none, and then the card names no reference — never
   * `requestId`. Shown, never matched or sent back.
   */
  reference?: string;
  /** The service the job was for, as the backend names it. */
  serviceName?: string;
  /**
   * The customer, as the backend chooses to show them to the vendor — the same
   * name the vendor already saw on the job.
   */
  customerName?: string;
}

/**
 * The reviews written about the signed-in vendor's work, and the figures
 * section 41 puts above them.
 *
 * ⚠️ The figures are the backend's, and the app shows them as given. A screen
 * never averages `reviews` itself: the list may one day be a page of them
 * while the figures cover all of them, and two sums of the same reviews that
 * disagree would be worse than one.
 *
 * Section 41's breakdown joined the two figures later, as counts per star
 * (`ratingBreakdown`), without moving them. No trend or period.
 */
export interface VendorReviews {
  /**
   * The vendor's average rating on section 24's scale, as the backend
   * publishes it (the mock rounds to one decimal place). `null` exactly when
   * there are no reviews — an average of nothing is not zero stars.
   */
  averageRating: number | null;

  /** How many reviews the vendor has. All of them, not the length of `reviews`. */
  totalReviews: number;

  /**
   * Section 41's breakdown: how many reviews gave each number of stars.
   * Always five entries, five stars first down to one, a star nobody gave
   * sent as a count of zero rather than left out — so a vendor with no reviews
   * has five zeros. The backend sends it, counted from the same reviews as
   * `totalReviews`.
   *
   * ⚠️ Counts, never percentages. The app works out each star's share itself,
   * so the five it shows always add up to exactly 100 (shares the backend had
   * rounded could add up to 99 or 101), and nothing is rounded twice. If the
   * counts ever disagree with `totalReviews`, the breakdown trusts the counts —
   * its shares are of their sum — and the summary keeps showing the total.
   */
  ratingBreakdown: VendorRatingCount[];

  /** The reviews, newest first — the service's order; a screen never sorts. */
  reviews: VendorReview[];
}

/** How many of a vendor's reviews gave one number of stars (section 41). */
export interface VendorRatingCount {
  /** A whole number of stars, `REVIEW_RATING_MIN` to `REVIEW_RATING_MAX`. */
  stars: number;
  /** How many reviews gave exactly that many. Zero is a count, not an absence. */
  count: number;
}

/** What a customer sends to review a request. */
export interface SubmitReviewInput {
  requestId: string;
  /** A whole number of stars within the scale. */
  rating: number;
  /** Omitted rather than sent empty when there is nothing to say. */
  comment?: string;
}

export interface ReviewService {
  /**
   * The customer's review of one of their requests, or `null` when there is
   * none yet.
   *
   * ⚠️ `null` is an answer, not a failure — most requests have no review, and
   * every one that can be reviewed starts without one. The call rejects only
   * when the question could not be answered.
   */
  getReview(requestId: string): Promise<RequestReview | null>;

  /**
   * Reviews a request, once (PROJECT_BIBLE.md section 24).
   *
   * ⚠️ The backend is the authority on both of section 24's rules, and says so
   * by refusing: a request that is not in a reviewable state, or that already
   * has a review, is rejected with a `conflict` — the request moved on, or the
   * review was already sent, and in either case the fix is to read again rather
   * than to send again. A request that does not exist for this customer is
   * `notFound`. The UI hides the action in all three cases as well, but it is
   * never the only protection.
   */
  submitReview(input: SubmitReviewInput): Promise<RequestReview>;

  /**
   * The reviews customers wrote about the signed-in vendor's work, with the
   * vendor's average, count and breakdown (PROJECT_BIBLE.md section 41). Read-only:
   * section 41 says a vendor cannot edit customer reviews, and there is no
   * reply, report or delete beside it.
   *
   * ⚠️ Scoped by the session, so there is no vendor id to pass. Whose reviews
   * these are is decided by who is signed in, never by a parameter a route or a
   * caller could set — one vendor can never ask for another's. Rejects with
   * `unauthorized` when nobody is signed in and when the session is a
   * customer's.
   *
   * A vendor with no reviews is an answer — no average, a count of zero, a
   * breakdown of five zeros and an empty list — not an error.
   */
  getVendorReviews(): Promise<VendorReviews>;
}
