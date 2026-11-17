/**
 * How the vendor's report is worded (PROJECT_BIBLE.md section 42). It words
 * the server's figures and never calculates, so what is pinned here is the
 * wording and the refusals:
 *
 * - the three periods, in section 42's order
 * - every count drawn as given and said as one phrase that names what it counts
 * - zero is a figure, and a quiet period says so; a count that is not a count
 *   is a dash and "not available", never a zero
 * - the rating in the reviews' words — one decimal, whole stars — and "No
 *   ratings yet" (never "0.0") when there is nothing honest to average
 * - nothing adds the counts up or checks them against the total
 */

import {
  VENDOR_REPORT_PERIOD_OPTIONS,
  presentVendorReport,
} from '@/features/vendor/constants/reportPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { VendorReport } from '@/shared/services/types/VendorReportService';

const COPY = VENDOR_COPY.reports;

const WEEK: VendorReport = {
  period: 'week',
  totalRequests: 15,
  completedRequests: 9,
  rejectedRequests: 2,
  cancelledRequests: 1,
  averageRating: 4.5,
  ratingCount: 6,
};

const QUIET: VendorReport = {
  period: 'today',
  totalRequests: 0,
  completedRequests: 0,
  rejectedRequests: 0,
  cancelledRequests: 0,
  averageRating: null,
  ratingCount: 0,
};

describe('Report presentation — periods', () => {
  it('offers Today, This week and This month, in that order', () => {
    expect(VENDOR_REPORT_PERIOD_OPTIONS).toEqual([
      { value: 'today', label: 'Today' },
      { value: 'week', label: 'This week' },
      { value: 'month', label: 'This month' },
    ]);
  });
});

describe('Report presentation — the counts', () => {
  it('draws each count as given, in section 42’s order', () => {
    const { counts } = presentVendorReport(WEEK);

    expect(counts.map(count => [count.key, count.label, count.value])).toEqual([
      ['total', 'Total requests', '15'],
      ['completed', 'Completed', '9'],
      ['rejected', 'Rejected', '2'],
      ['cancelled', 'Cancelled', '1'],
    ]);
  });

  it('says each as one phrase that names what it counts', () => {
    const { counts } = presentVendorReport(WEEK);

    expect(counts.map(count => count.spoken)).toEqual([
      'Total requests, 15',
      'Completed requests, 9',
      'Rejected requests, 2',
      'Cancelled requests, 1',
    ]);
  });

  it('draws zeros as zeros, and calls the period quiet', () => {
    const presented = presentVendorReport(QUIET);

    expect(presented.counts.map(count => count.value)).toEqual(['0', '0', '0', '0']);
    expect(presented.counts[1].spoken).toBe('Completed requests, 0');
    expect(presented.isQuiet).toBe(true);
  });

  it('is not quiet when anything reached the vendor, even with nothing finished', () => {
    expect(presentVendorReport({ ...QUIET, totalRequests: 1 }).isQuiet).toBe(false);
  });

  it('draws a count it cannot trust as a dash and says it is not available — never a zero', () => {
    for (const broken of [-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const [, completed] = presentVendorReport({ ...WEEK, completedRequests: broken }).counts;

      expect(completed.value).toBe(COPY.unavailable);
      expect(completed.spoken).toBe('Completed requests, not available');
    }
  });

  it('never adds the counts up or holds them to the total', () => {
    // More finished than arrived: the server's figures, shown as sent.
    const { counts } = presentVendorReport({ ...WEEK, totalRequests: 3, completedRequests: 9 });

    expect(counts[0].value).toBe('3');
    expect(counts[1].value).toBe('9');
  });
});

describe('Report presentation — the rating', () => {
  it('draws the average to one decimal with whole stars, and how many ratings it comes from', () => {
    expect(presentVendorReport(WEEK).rating).toEqual({
      average: '4.5',
      stars: 5,
      note: 'from 6 ratings',
      spoken: 'Average rating 4.5 out of 5, from 6 ratings',
    });
  });

  it('keeps a whole average to one decimal place', () => {
    const { rating } = presentVendorReport({ ...WEEK, averageRating: 4, ratingCount: 1 });

    expect(rating.average).toBe('4.0');
    expect(rating.stars).toBe(4);
    expect(rating.note).toBe('from 1 rating');
    expect(rating.spoken).toBe('Average rating 4.0 out of 5, from 1 rating');
  });

  it('says "No ratings yet" with no ratings — never 0.0, and no stars', () => {
    const { rating } = presentVendorReport(QUIET);

    expect(rating).toEqual({ note: COPY.noRatings, spoken: COPY.noRatingsSpoken });
    expect(JSON.stringify(rating)).not.toContain('0.0');
  });

  it('draws no average it cannot trust', () => {
    const untrusted: Array<Pick<VendorReport, 'averageRating' | 'ratingCount'>> = [
      { averageRating: 0, ratingCount: 3 },
      { averageRating: 5.5, ratingCount: 3 },
      { averageRating: Number.NaN, ratingCount: 3 },
      { averageRating: 4.2, ratingCount: 0 },
      { averageRating: null, ratingCount: 3 },
    ];

    for (const figures of untrusted) {
      const { rating } = presentVendorReport({ ...WEEK, ...figures });
      expect(rating.average).toBeUndefined();
      expect(rating.note).toBe(COPY.noRatings);
    }
  });
});
