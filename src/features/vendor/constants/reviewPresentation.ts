/**
 * Review presentation
 *
 * What the vendor's reviews say on screen and to a screen reader
 * (PROJECT_BIBLE.md section 41, Phase 3E-6).
 *
 * ⚠️ It words, it never calculates. The average and the count are the
 * service's (`VendorReviews`), and this only writes them out: one decimal
 * place for the average, and the stars it is drawn with rounded to the nearest
 * whole one — "4.8" beside five stars, as section 41 sketches it. Nothing here
 * adds up `reviews`; a second sum of the same reviews that disagreed with the
 * backend's would be worse than none.
 *
 * ⚠️ A figure the app cannot trust is not drawn. An average that is missing,
 * not a number or off section 24's scale, or a count below one, gives no
 * summary at all — never "0.0", which would read as a vendor rated zero.
 *
 * ⚠️ The breakdown's percentages are the one figure worked out here, from the
 * counts the backend sent (`ratingShares`, largest remainder, so the five add
 * up to exactly 100). A share is not a second opinion about the backend's
 * figures — it is its own counts, divided — and a breakdown the app cannot
 * read is not drawn at all.
 *
 * ⚠️ A review is said as one sentence, in the order a person would say it:
 * whose it is, the stars as words, when, which job, then what they wrote. A
 * review with no comment ends at the job; it never says "Comment" followed by
 * nothing. Names and comments are spoken whole even where the card truncates.
 *
 * ⚠️ A reviewer is a first name and the initial of the last (owner decision,
 * 21/10/2026, Phase 3E-15): "Priya S.", never "Priya Sharma" — on the card and
 * in what a screen reader says, which is why the rule sits here and not in the
 * card. `reviewerName` is the one place it is applied; the full name the
 * backend sent never leaves this file. A review with no name still draws none
 * and is said as `anonymousSpoken`: the contract forbids a placeholder name
 * (`VendorReview.customerName`).
 */

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { describeRating, ratingShares } from '@/shared/presentation/rating';
import { formatRequestDate } from '@/shared/presentation/requestTokens';
import {
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  type VendorRatingCount,
  type VendorReview,
  type VendorReviews,
} from '@/shared/services/types/ReviewService';

const COPY = VENDOR_COPY.reviews;
const JOB = VENDOR_COPY.job;

/** A part that already ends a sentence: a full stop, a question, an exclamation or an ellipsis. */
const SENTENCE_END = /[.!?…]$/;

export interface RatingSummaryPresentation {
  /** The average as drawn: "4.3". Always one decimal place. */
  average: string;
  /** Whole stars to fill, the average rounded: 4.3 → 4, 4.8 → 5. */
  stars: number;
  /** "4 reviews". */
  count: string;
  /** "Rating 4.3 out of 5, based on 4 reviews." */
  spoken: string;
}

/** The summary above the list, or null when there is nothing honest to show. */
export function presentRatingSummary(
  summary: Pick<VendorReviews, 'averageRating' | 'totalReviews'>,
): RatingSummaryPresentation | null {
  const { averageRating, totalReviews } = summary;

  if (
    averageRating === null ||
    !Number.isFinite(averageRating) ||
    averageRating < REVIEW_RATING_MIN ||
    averageRating > REVIEW_RATING_MAX ||
    !Number.isInteger(totalReviews) ||
    totalReviews < 1
  ) {
    return null;
  }

  const average = averageRating.toFixed(1);

  return {
    average,
    stars: Math.round(averageRating),
    count: COPY.count(totalReviews),
    spoken: COPY.summarySpoken(average, REVIEW_RATING_MAX, totalReviews),
  };
}

export interface RatingFigurePresentation {
  /** The average as drawn — "4.3". Absent when there is none to trust. */
  average?: string;
  /** Whole stars beside it. Absent with the average. */
  stars?: number;
  /** "12 reviews" under the average; with no average, what the vendor reads instead. */
  caption: string;
  /** With no average, "No reviews yet" or the count — drawn where the figure would be. */
  note?: string;
  /** The figure as one phrase: the reviews' own sentence, or "Rating, no reviews yet". */
  spoken: string;
}

/**
 * The rating as a figure away from Reviews (Phase 3E-15) — section 30's
 * Rating on the dashboard, and section 38's on the Profile tab's reviews row:
 * the reviews' average and count, in the reviews' words
 * (`presentRatingSummary`), so the figure cannot read one way there and
 * another on Reviews.
 *
 * ⚠️ No reviews is "No reviews yet", never "0.0" — an average of nothing is
 * not zero stars. Reviews counted with an average the app cannot trust show the
 * count alone: not the average, and not "No reviews yet", which would be untrue.
 */
export function presentRatingFigure(
  summary: Pick<VendorReviews, 'averageRating' | 'totalReviews'>,
): RatingFigurePresentation {
  const rated = presentRatingSummary(summary);

  if (rated) {
    return { average: rated.average, stars: rated.stars, caption: rated.count, spoken: rated.spoken };
  }

  const { totalReviews } = summary;
  if (Number.isInteger(totalReviews) && totalReviews > 0) {
    const count = COPY.count(totalReviews);
    return { caption: COPY.figureLabel, note: count, spoken: COPY.figureCountOnlySpoken(count) };
  }

  return { caption: COPY.figureLabel, note: COPY.figureNone, spoken: COPY.figureNoneSpoken };
}

export interface RatingBreakdownRowPresentation {
  /** Whole stars: 5 down to 1. Drawn as the number beside a star glyph. */
  stars: number;
  /** The share as a whole number, 0 to 100 — how much of the bar to fill. */
  percent: number;
  /** "80%". */
  percentText: string;
  /** "5 stars, 80 percent, 12 reviews" — the row as a screen reader says it. */
  spoken: string;
}

/**
 * Section 41's breakdown, five rows from five stars down, or null when there
 * is nothing honest to draw — no reviews counted, or a breakdown the app
 * cannot read (see `ratingShares`).
 */
export function presentRatingBreakdown(
  breakdown: readonly VendorRatingCount[] | null | undefined,
): RatingBreakdownRowPresentation[] | null {
  const shares = ratingShares(breakdown);

  if (!shares) {
    return null;
  }

  return shares.map(share => ({
    stars: share.stars,
    percent: share.percent,
    percentText: COPY.breakdownPercent(share.percent),
    spoken: COPY.breakdownRowSpoken(share.stars, share.percent, share.count),
  }));
}

/**
 * A reviewer as a vendor sees them: the first name and the last name's
 * initial — "Priya Sharma" → "Priya S." (owner decision, 21/10/2026).
 *
 * Spaces are trimmed and runs of them collapsed; one word is a first name and
 * stays as it is; anything between the first word and the last is left out.
 * The initial is the last word's first character, taken whole even where it
 * is two UTF-16 units, so it is never half a character — and upper-cased
 * (lead decision, 21/10/2026: "priya sharma" → "priya S."). ⚠️ Only the
 * initial, which the app makes; the first name is the backend's spelling and
 * is never re-cased. A letter with no case (Devanagari, say) stays as it is,
 * and one whose capital is more than one letter ("ß" → "SS") keeps its own
 * form rather than turn one initial into two.
 *
 * Undefined for a name that is missing or blank: what stands in for it is the
 * caller's (`anonymousSpoken`), because a blank is not a name to shorten.
 */
export function reviewerName(fullName: string | null | undefined): string | undefined {
  const words = (fullName ?? '').trim().split(/\s+/).filter(word => word.length > 0);

  if (words.length === 0) {
    return undefined;
  }
  if (words.length === 1) {
    return words[0];
  }

  const [initial] = Array.from(words[words.length - 1]);
  const capital = initial.toUpperCase();
  const shown = Array.from(capital).length === 1 ? capital : initial;
  return `${words[0]} ${shown}${COPY.reviewerInitialMark}`;
}

export interface VendorReviewPresentation {
  /** The reviewer as `reviewerName` shortens them, when the backend gave a name that is not blank. */
  customerName?: string;
  /** When it was written — "1 day ago", or a date once that stops helping. Empty if unreadable. */
  date: string;
  /** Which job: "Geyser wiring · Ref REQ-30912", or the reference alone. */
  context: string;
  /** The customer's words exactly as sent, when there are any. */
  comment?: string;
  /** The whole card as one sentence. */
  spoken: string;
}

function filled(value: string | undefined): string | undefined {
  return value !== undefined && value.trim().length > 0 ? value : undefined;
}

/** One review, ready to draw and to say. `now` is a parameter so this stays pure. */
export function presentVendorReview(review: VendorReview, now: Date = new Date()): VendorReviewPresentation {
  // Shortened before anything else reads it: the full name goes no further than this line.
  const customerName = reviewerName(review.customerName);
  const serviceName = filled(review.serviceName)?.trim();
  // Never trimmed for display: the comment is drawn as the customer wrote it.
  const comment = filled(review.comment);

  const reference = `${JOB.referencePrefix} ${review.requestId}`;
  const context = serviceName ? `${serviceName}${COPY.contextSeparator}${reference}` : reference;
  const date = formatRequestDate(review.submittedAt, now);

  const spoken = [
    customerName ? COPY.fromSpoken(customerName) : COPY.anonymousSpoken,
    describeRating(review.rating),
    date,
    serviceName ? `${serviceName}, ${reference}` : reference,
    comment ? `${COPY.commentSpoken}: ${comment}` : undefined,
  ]
    .filter((part): part is string => part !== undefined && part.length > 0)
    // A part that already ends a sentence is not given a second full stop:
    // "Review from Priya S.. 5 out of 5 stars" (StaleNotice's lesson, 3E-6).
    .reduce(
      (said, part) => (said === '' ? part : `${said}${SENTENCE_END.test(said) ? ' ' : '. '}${part}`),
      '',
    );

  return {
    ...(customerName ? { customerName } : {}),
    date,
    context,
    ...(comment ? { comment } : {}),
    spoken,
  };
}
