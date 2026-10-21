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
 * - names and comments are kept whole; the comment exactly as written
 * - the breakdown is five rows from five stars down, each drawn as "80%" and
 *   said as "5 stars, 80 percent, 12 reviews" — singular for one star and one
 *   review — its percentages adding up to 100; nothing to share, or a
 *   breakdown that cannot be read, draws none
 */

import {
  presentRatingBreakdown,
  presentRatingSummary,
  presentVendorReview,
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
      customerName: 'Karthik Iyer',
      date: '1 day ago',
      context: 'Geyser wiring · Ref REQ-30912',
      comment: 'Arrived on time.',
      spoken:
        'Review from Karthik Iyer. 5 out of 5 stars. 1 day ago. Geyser wiring, Ref REQ-30912. Comment: Arrived on time.',
    });
  });

  it('never says "Comment" for a review without one', () => {
    const shown = presentVendorReview(without('comment'), NOW);

    expect('comment' in shown).toBe(false);
    expect(shown.spoken).toBe(
      'Review from Karthik Iyer. 5 out of 5 stars. 1 day ago. Geyser wiring, Ref REQ-30912',
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

  it('keeps a long name whole in what is said', () => {
    const name = 'Venkata Subrahmanya Lakshmi Narasimhamurthy-Ramachandran';
    const shown = presentVendorReview({ ...REVIEW, customerName: name }, NOW);

    expect(shown.customerName).toBe(name);
    expect(shown.spoken.startsWith(COPY.fromSpoken(name))).toBe(true);
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
      'Review from Karthik Iyer. 5 out of 5 stars. Geyser wiring, Ref REQ-30912. Comment: Arrived on time.',
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
