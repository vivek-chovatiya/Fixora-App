/**
 * How the vendor's reviews are worded (PROJECT_BIBLE.md section 41, Phase
 * 3E-6). Pinned here:
 *
 * - the summary shows the service's average to one decimal place and never
 *   calculates one; its stars are that average rounded to a whole star
 * - a figure the app cannot trust draws no summary at all — never "0.0"
 * - the summary is said as one sentence with the average as a number
 * - a review is said as one sentence: whose, the stars in words, when, which
 *   job, and then the comment — and a review with no comment never says
 *   "Comment"
 * - comments are kept whole and exactly as written; a reviewer is a first name
 *   and a last initial, on screen and in what is said, and the surname never
 *   leaves the presentation (owner decision, 21/10/2026 — `reviewerName`);
 *   the initial is a capital where its letter has one, the first name is never
 *   re-cased
 * - the dashboard's rating and today's figure (Phase 3E-15) are the reviews'
 *   and the report's own words: "No reviews yet", never "0.0"; a count the
 *   app cannot trust is a dash
 * - the breakdown is five rows from five stars down, each drawn as "80%" and
 *   said as "5 stars, 80 percent, 12 reviews" — singular for one star and one
 *   review — its percentages adding up to 100; nothing to share, or a
 *   breakdown that cannot be read, draws none
 */

import { presentTodayRequests } from '@/features/vendor/constants/reportPresentation';
import {
  presentRatingBreakdown,
  presentRatingFigure,
  presentRatingSummary,
  presentVendorReview,
  reviewerName,
} from '@/features/vendor/constants/reviewPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { VendorReview } from '@/shared/services/types/ReviewService';

const COPY = VENDOR_COPY.reviews;

const NOW = new Date('2026-10-08T12:00:00.000Z');

/** The review without one of its optional fields. */
function without(field: 'comment' | 'customerName' | 'serviceName'): VendorReview {
  const review: VendorReview = { ...REVIEW };
  delete review[field];
  return review;
}

const REVIEW: VendorReview = {
  requestId: 'REQ-30912',
  // The reference a card names; without it the card names none (code review, 17/11/2026).
  reference: 'REQ-30912',
  rating: 5,
  comment: 'Arrived on time.',
  submittedAt: '2026-10-07T12:00:00.000Z',
  serviceName: 'Geyser wiring',
  customerName: 'Karthik Iyer',
};

describe('presentRatingSummary', () => {
  it('says the brief’s own example exactly', () => {
    expect(presentRatingSummary({ averageRating: 4.8, totalReviews: 12 })).toEqual({
      average: '4.8',
      stars: 5,
      count: '12 reviews',
      spoken: 'Rating 4.8 out of 5, based on 12 reviews.',
    });
  });

  it('shows the average it was given, to one decimal place', () => {
    expect(presentRatingSummary({ averageRating: 4.3, totalReviews: 4 })?.average).toBe('4.3');
    expect(presentRatingSummary({ averageRating: 4, totalReviews: 3 })?.average).toBe('4.0');
    expect(presentRatingSummary({ averageRating: 5, totalReviews: 3 })?.average).toBe('5.0');
    expect(presentRatingSummary({ averageRating: 1, totalReviews: 3 })?.average).toBe('1.0');
  });

  it('fills whole stars, the average rounded', () => {
    expect(presentRatingSummary({ averageRating: 4.3, totalReviews: 4 })?.stars).toBe(4);
    expect(presentRatingSummary({ averageRating: 4.5, totalReviews: 4 })?.stars).toBe(5);
    expect(presentRatingSummary({ averageRating: 1.2, totalReviews: 4 })?.stars).toBe(1);
  });

  it('counts in the singular for one review', () => {
    expect(presentRatingSummary({ averageRating: 5, totalReviews: 1 })).toMatchObject({
      count: '1 review',
      spoken: 'Rating 5.0 out of 5, based on 1 review.',
    });
  });

  it('draws nothing for a vendor with no reviews', () => {
    expect(presentRatingSummary({ averageRating: null, totalReviews: 0 })).toBeNull();
  });

  it('draws nothing it cannot trust, rather than a rating of zero', () => {
    for (const averageRating of [Number.NaN, Number.POSITIVE_INFINITY, 0, 0.4, 5.1, -3]) {
      expect(presentRatingSummary({ averageRating, totalReviews: 4 })).toBeNull();
    }
    for (const totalReviews of [0, -1, 2.5, Number.NaN]) {
      expect(presentRatingSummary({ averageRating: 4.3, totalReviews })).toBeNull();
    }
    // A count with no average is not an average of zero.
    expect(presentRatingSummary({ averageRating: null, totalReviews: 4 })).toBeNull();
  });
});

describe('presentRatingBreakdown', () => {
  /** Counts for 5, 4, 3, 2 and 1 stars. */
  const counts = (...given: number[]) => given.map((count, index) => ({ stars: 5 - index, count }));

  it('draws and says Ravi’s breakdown, five stars first', () => {
    expect(presentRatingBreakdown(counts(2, 1, 1, 0, 0))).toEqual([
      { stars: 5, percent: 50, percentText: '50%', spoken: '5 stars, 50 percent, 2 reviews' },
      { stars: 4, percent: 25, percentText: '25%', spoken: '4 stars, 25 percent, 1 review' },
      { stars: 3, percent: 25, percentText: '25%', spoken: '3 stars, 25 percent, 1 review' },
      { stars: 2, percent: 0, percentText: '0%', spoken: '2 stars, 0 percent, 0 reviews' },
      { stars: 1, percent: 0, percentText: '0%', spoken: '1 star, 0 percent, 0 reviews' },
    ]);
  });

  it('says the brief’s own row exactly, and one star and one review in the singular', () => {
    const rows = presentRatingBreakdown(counts(12, 2, 0, 0, 1));

    expect(rows?.[0].spoken).toBe('5 stars, 80 percent, 12 reviews');
    expect(rows?.[0].percentText).toBe('80%');
    expect(rows?.[4].spoken).toBe('1 star, 7 percent, 1 review');
  });

  it('shows percentages that add up to exactly 100', () => {
    const rows = presentRatingBreakdown(counts(1, 1, 1, 0, 0)) ?? [];

    expect(rows.map(row => row.percentText)).toEqual(['34%', '33%', '33%', '0%', '0%']);
    expect(rows.reduce((total, row) => total + row.percent, 0)).toBe(100);
  });

  it('draws no breakdown for a vendor with no reviews', () => {
    expect(presentRatingBreakdown(counts(0, 0, 0, 0, 0))).toBeNull();
    expect(presentRatingBreakdown([])).toBeNull();
    expect(presentRatingBreakdown(undefined)).toBeNull();
  });

  it('draws no breakdown it cannot read, rather than a row with a guessed figure', () => {
    expect(presentRatingBreakdown([...counts(2, 1, 1, 0, 0), { stars: 6, count: 1 }])).toBeNull();
    expect(presentRatingBreakdown(counts(2, -1, 1, 0, 0))).toBeNull();
  });
});

describe('presentVendorReview', () => {
  it('says the whole review in one sentence, in the order a person would', () => {
    expect(presentVendorReview(REVIEW, NOW)).toEqual({
      customerName: 'Karthik I.',
      date: '1 day ago',
      context: 'Geyser wiring · Ref REQ-30912',
      comment: 'Arrived on time.',
      spoken:
        'Review from Karthik I. 5 out of 5 stars. 1 day ago. Geyser wiring, Ref REQ-30912. Comment: Arrived on time.',
    });
  });

  it('never says "Comment" for a review without one', () => {
    const shown = presentVendorReview(without('comment'), NOW);

    expect('comment' in shown).toBe(false);
    expect(shown.spoken).toBe(
      'Review from Karthik I. 5 out of 5 stars. 1 day ago. Geyser wiring, Ref REQ-30912',
    );
    expect(shown.spoken).not.toContain(COPY.commentSpoken);
  });

  it('treats a comment of only spaces as none', () => {
    const shown = presentVendorReview({ ...REVIEW, comment: '   \n ' }, NOW);

    expect('comment' in shown).toBe(false);
    expect(shown.spoken).not.toContain(COPY.commentSpoken);
  });

  it('keeps the comment exactly as written, line breaks and all', () => {
    const written = '  Good work.\nWould book again.  ';

    expect(presentVendorReview({ ...REVIEW, comment: written }, NOW).comment).toBe(written);
  });

  it('keeps a long comment whole, on screen and in what is said', () => {
    const long = 'The wiring is neat. '.repeat(24).trim();
    const shown = presentVendorReview({ ...REVIEW, comment: long }, NOW);

    expect(shown.comment).toBe(long);
    expect(shown.spoken.endsWith(`${COPY.commentSpoken}: ${long}`)).toBe(true);
  });

  it('says it is a customer review when the backend gives no name', () => {
    for (const review of [without('customerName'), { ...REVIEW, customerName: '  ' }]) {
      const shown = presentVendorReview(review, NOW);
      expect('customerName' in shown).toBe(false);
      expect(shown.spoken.startsWith(`${COPY.anonymousSpoken}. 5 out of 5 stars`)).toBe(true);
    }
  });

  it('shortens a long name the same way, on screen and in what is said', () => {
    const name = 'Venkata Subrahmanya Lakshmi Narasimhamurthy-Ramachandran';
    const shown = presentVendorReview({ ...REVIEW, customerName: name }, NOW);

    expect(shown.customerName).toBe('Venkata N.');
    expect(shown.spoken.startsWith(`${COPY.fromSpoken('Venkata N.')} 5 out of 5 stars`)).toBe(true);
  });

  it('never lets the surname out, on screen or in what is said', () => {
    const shown = presentVendorReview({ ...REVIEW, customerName: 'Priya Sharma' }, NOW);

    expect(JSON.stringify(shown)).not.toContain('Sharma');
    expect(shown.customerName).toBe('Priya S.');
    // One full stop after the initial, never two.
    expect(shown.spoken.startsWith('Review from Priya S. 5 out of 5 stars.')).toBe(true);
    expect(shown.spoken).not.toContain('..');
  });

  it('names the job by reference alone when the backend gives no service', () => {
    const shown = presentVendorReview(without('serviceName'), NOW);

    expect(shown.context).toBe('Ref REQ-30912');
    expect(shown.spoken).toContain('1 day ago. Ref REQ-30912. Comment');
  });

  it('dates an older review rather than ageing it', () => {
    const shown = presentVendorReview({ ...REVIEW, submittedAt: '2026-09-20T12:00:00.000Z' }, NOW);

    expect(shown.date).not.toMatch(/ago/);
    expect(shown.date.length).toBeGreaterThan(0);
  });

  it('leaves out a date it cannot read, rather than inventing one', () => {
    const shown = presentVendorReview({ ...REVIEW, submittedAt: 'not a date' }, NOW);

    expect(shown.date).toBe('');
    expect(shown.spoken).toBe(
      'Review from Karthik I. 5 out of 5 stars. Geyser wiring, Ref REQ-30912. Comment: Arrived on time.',
    );
  });

  it('says every rating on the scale in words', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(presentVendorReview({ ...REVIEW, rating }, NOW).spoken).toContain(
        `${rating} out of 5 stars`,
      );
    }
  });
});

describe('reviewerName — first name and last initial (owner decision, 21/10/2026)', () => {
  it.each<[string, string]>([
    ['Priya Sharma', 'Priya S.'],
    ['Priya', 'Priya'],
    ['  Priya   Sharma  ', 'Priya S.'],
    ['Priya\tKumari\nSharma', 'Priya S.'],
    ['Mary-Jane O’Neil', 'Mary-Jane O.'],
    ['Priya S.', 'Priya S.'],
    ['Priya S', 'Priya S.'],
    // Only the initial the app makes is upper-cased; the first name is the backend's spelling.
    ['priya sharma', 'priya S.'],
    ['Anil ölz', 'Anil Ö.'],
    // No case to change: the initial stays as it is.
    ['Asha शर्मा', 'Asha श.'],
    ['Wei 王', 'Wei 王.'],
    // A capital that would be two letters keeps its own form: one initial, not two.
    ['Anna ßeta', 'Anna ß.'],
  ])('reads %j as %j', (given, shown) => {
    expect(reviewerName(given)).toBe(shown);
  });

  it('keeps an initial whole when it is more than one UTF-16 unit', () => {
    expect(reviewerName('Asha \u{1D4AE}harma')).toBe('Asha \u{1D4AE}.');
  });

  it.each([undefined, null, '', '   ', '\n\t'])('gives no name for %j, so none is drawn', given => {
    expect(reviewerName(given)).toBeUndefined();
  });
});

describe('presentRatingFigure — the rating on the dashboard and the Profile tab (Phase 3E-15)', () => {
  it('is the reviews’ own average, stars, count and sentence', () => {
    expect(presentRatingFigure({ averageRating: 4.25, totalReviews: 4 })).toEqual({
      average: '4.3',
      stars: 4,
      caption: '4 reviews',
      spoken: 'Rating 4.3 out of 5, based on 4 reviews.',
    });
  });

  it('says "No reviews yet" for none, never 0.0 and never a star', () => {
    const shown = presentRatingFigure({ averageRating: null, totalReviews: 0 });

    expect(shown).toEqual({
      caption: COPY.figureLabel,
      note: COPY.figureNone,
      spoken: COPY.figureNoneSpoken,
    });
    expect(JSON.stringify(shown)).not.toMatch(/0\.0|\b0 reviews/);
  });

  it('shows the count alone when the average cannot be trusted, never "No reviews yet"', () => {
    expect(presentRatingFigure({ averageRating: 7, totalReviews: 3 })).toEqual({
      caption: COPY.figureLabel,
      note: '3 reviews',
      spoken: 'Rating, 3 reviews',
    });
  });
});

describe('presentTodayRequests — section 30 on the dashboard (Phase 3E-15)', () => {
  it('is the report’s total, said as what it counts', () => {
    expect(presentTodayRequests({ totalRequests: 4 })).toEqual({
      value: '4',
      spoken: "Today's requests, 4",
    });
  });

  it('draws zero as a figure', () => {
    expect(presentTodayRequests({ totalRequests: 0 }).value).toBe('0');
  });

  it.each([-1, 2.5, Number.NaN])('draws %p as a dash and says it is not available, never a zero', total => {
    expect(presentTodayRequests({ totalRequests: total })).toEqual({
      value: VENDOR_COPY.reports.unavailable,
      spoken: "Today's requests, not available",
    });
  });
});
