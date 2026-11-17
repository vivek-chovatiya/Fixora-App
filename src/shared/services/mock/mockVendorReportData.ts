/**
 * MOCK VENDOR REPORT DATA — DEVELOPMENT ONLY
 *
 * A mock vendor's figures for each of section 42's periods, so the Reports
 * screen (PROJECT_BIBLE.md section 42) can be built before there
 * is a backend to count anything. Fixtures, not records: none of it reaches a
 * production build.
 *
 * ⚠️ Not counted from the other mocks, and not meant to agree with them. The
 * dashboard's and the request list's jobs (`mockVendorDashboardData`) and the
 * reviews (`mockVendorReviewData`) are short samples, a few of each, and they
 * share no store with each other or with this table — so a request accepted,
 * rejected or completed in the app does not move a figure here, and Ravi's
 * month is larger than the handful of jobs his Requests tab lists. Counting
 * periods is the server's (`VendorReportService`); doing it in a mock would
 * mean inventing where a day, a week and a month begin, which is exactly what
 * the contract leaves to the backend.
 *
 * ⚠️ Per vendor, by id, written out in full; nothing is random and nothing
 * depends on the clock. Ravi (`usr_vendor_1`), who has been trading a while,
 * has a different, realistic answer for each period — today has work and no
 * ratings yet, so "No ratings yet" is reachable by signing in. Meena
 * (`usr_vendor_2`), who has just set up, has zeros everywhere, which is the
 * zero state and also what makes "one vendor never sees another's figures"
 * checkable on a device. Any vendor registered in the app gets zeros too.
 */

import type { VendorReport, VendorReportPeriod } from '@/shared/services/types/VendorReportService';

/** A period's figures as the fixture writes them; the period is filled in on the way out. */
type ReportFigures = Omit<VendorReport, 'period'>;

/** Nothing yet: a business that has just set up, in any period. */
const NOTHING: ReportFigures = Object.freeze({
  totalRequests: 0,
  completedRequests: 0,
  rejectedRequests: 0,
  cancelledRequests: 0,
  averageRating: null,
  ratingCount: 0,
});

/**
 * Ravi's. Each period holds the one before it, as a real count would, and the
 * three are told apart by every figure. Completed, rejected and cancelled do
 * not add up to the total: the rest is work still waiting or under way.
 */
const RAVI: Readonly<Record<VendorReportPeriod, ReportFigures>> = Object.freeze({
  today: Object.freeze({
    totalRequests: 4,
    completedRequests: 1,
    rejectedRequests: 1,
    cancelledRequests: 0,
    // Nobody has rated today's work yet.
    averageRating: null,
    ratingCount: 0,
  }),
  week: Object.freeze({
    totalRequests: 15,
    completedRequests: 9,
    rejectedRequests: 2,
    cancelledRequests: 1,
    averageRating: 4.5,
    ratingCount: 6,
  }),
  month: Object.freeze({
    totalRequests: 48,
    completedRequests: 34,
    rejectedRequests: 6,
    cancelledRequests: 3,
    averageRating: 4.3,
    ratingCount: 21,
  }),
});

const VENDOR_REPORTS: Readonly<Record<string, Readonly<Record<VendorReportPeriod, ReportFigures>>>> =
  Object.freeze({
    usr_vendor_1: RAVI,
  });

/** A vendor's report for one period. A fresh object each call. */
export function mockVendorReportFor(vendorId: string, period: VendorReportPeriod): VendorReport {
  const figures = VENDOR_REPORTS[vendorId]?.[period] ?? NOTHING;

  return { period, ...figures };
}
