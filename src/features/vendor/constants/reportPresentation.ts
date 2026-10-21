/**
 * Report presentation
 *
 * What the vendor's report says on screen and to a screen reader
 * (PROJECT_BIBLE.md section 42): the three periods to choose from, and each of
 * the five figures as it is drawn and as it is said.
 *
 * ⚠️ It words, it never calculates. Every figure is the server's
 * (`VendorReport`) and is written out as given: no figure is added up from
 * another, none is turned into a rate or a share, and nothing checks that
 * completed, rejected and cancelled fit inside the total — the rest of the
 * total is work still waiting or under way, which the report does not count.
 *
 * ⚠️ Zero is a figure. A quiet period is four zeros and no rating, drawn as
 * such, with a calm line under them (`isQuiet`) — never an empty state that
 * hides the figures, and never an error. A count the app cannot trust (not a
 * whole number, or below zero) is drawn as a dash and said as "not
 * available", never as a zero nobody sent.
 *
 * ⚠️ The rating is the reviews' wording (`presentRatingSummary`, Phase 3E-6):
 * the same one decimal place, the same whole stars and the same refusal to
 * draw an average it cannot trust — so a vendor's rating cannot read one way
 * on Reviews and another way here. No ratings in the period is "No ratings
 * yet", never "0.0", which would read as a vendor rated zero.
 */

import { presentRatingSummary } from '@/features/vendor/constants/reviewPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { REVIEW_RATING_MAX } from '@/shared/services/types/ReviewService';
import type { VendorReport, VendorReportPeriod } from '@/shared/services/types/VendorReportService';

const COPY = VENDOR_COPY.reports;

/** Section 42's time filters, in its order, with the words each chip shows. */
export const VENDOR_REPORT_PERIOD_OPTIONS: ReadonlyArray<{ value: VendorReportPeriod; label: string }> = [
  { value: 'today', label: COPY.periodToday },
  { value: 'week', label: COPY.periodWeek },
  { value: 'month', label: COPY.periodMonth },
];

/** The four counts, in section 42's order. */
export type ReportCountKey = 'total' | 'completed' | 'rejected' | 'cancelled';

export interface ReportCountPresentation {
  key: ReportCountKey;
  /** The name under the figure: "Completed". */
  label: string;
  /** The figure as drawn: "12", or a dash when the server's value is not a count. */
  value: string;
  /** The whole card as one phrase: "Completed requests, 12". */
  spoken: string;
}

export interface ReportRatingPresentation {
  /** The average as drawn — "4.3", always one decimal place. Absent with no ratings. */
  average?: string;
  /** Whole stars to fill, the average rounded. Absent with no ratings. */
  stars?: number;
  /** "from 21 ratings", or "No ratings yet". */
  note: string;
  /** "Average rating 4.3 out of 5, from 21 ratings", or "Average rating, no ratings yet". */
  spoken: string;
}

export interface ReportPresentation {
  counts: ReportCountPresentation[];
  rating: ReportRatingPresentation;
  /** Nothing reached the vendor in the period: the figures are zeros, and say so calmly. */
  isQuiet: boolean;
}

/** A count as drawn, or null when what the server sent is not one. */
function countText(count: number): string | null {
  return Number.isInteger(count) && count >= 0 ? String(count) : null;
}

function presentCount(
  key: ReportCountKey,
  label: string,
  spokenName: string,
  count: number,
): ReportCountPresentation {
  const value = countText(count);

  return {
    key,
    label,
    value: value ?? COPY.unavailable,
    spoken: COPY.figureSpoken(spokenName, value ?? COPY.unavailableSpoken),
  };
}

function presentRating(report: VendorReport): ReportRatingPresentation {
  const summary = presentRatingSummary({
    averageRating: report.averageRating,
    totalReviews: report.ratingCount,
  });

  if (!summary) {
    return { note: COPY.noRatings, spoken: COPY.noRatingsSpoken };
  }

  return {
    average: summary.average,
    stars: summary.stars,
    note: COPY.ratingCount(report.ratingCount),
    spoken: COPY.ratingSpoken(summary.average, REVIEW_RATING_MAX, report.ratingCount),
  };
}

/** One period's figures, ready to draw and to say. */
export function presentVendorReport(report: VendorReport): ReportPresentation {
  return {
    counts: [
      presentCount('total', COPY.total, COPY.totalSpoken, report.totalRequests),
      presentCount('completed', COPY.completed, COPY.completedSpoken, report.completedRequests),
      presentCount('rejected', COPY.rejected, COPY.rejectedSpoken, report.rejectedRequests),
      presentCount('cancelled', COPY.cancelled, COPY.cancelledSpoken, report.cancelledRequests),
    ],
    rating: presentRating(report),
    isQuiet: report.totalRequests === 0,
  };
}
