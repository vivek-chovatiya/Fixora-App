/**
 * VendorReportService
 *
 * The signed-in vendor's basic report (PROJECT_BIBLE.md section 42; section
 * 56's "View Basic Reports"): for today, this week or this month, how many
 * requests reached them, how many they completed, rejected and saw cancelled,
 * and their average rating. Five figures for one period, and nothing more.
 *
 * ⚠️ Simple on purpose. Section 42: "Phase 1 reports are simple … Do not build
 * advanced financial analytics in Phase 1." There is no money here — payment
 * is offline record-keeping in Phase 1 and earnings are Phase 2's (section 68)
 * — and no completion or acceptance rate (section 78's Phase 2 business
 * intelligence), no trend, no breakdown by day or service, no comparison with
 * another period and no export. Each would be one more field or call later;
 * nothing here has to move for it.
 *
 * ⚠️ The period is a key, and where it begins and ends is the server's. The
 * app sends `today`, `week` or `month` and computes no dates: the vendor's
 * day, week and month — their time zone, the day a week starts on — are
 * decided where the requests are counted. An app that sent its own start and
 * end would count a late-evening job into a different day from the server that
 * holds it, and two phones with different clocks would disagree about "today".
 *
 * ⚠️ The figures are the server's. Every count and the average arrive
 * computed; the app draws them as given. It never adds them up from the
 * request list or the reviews (it holds neither in full), never checks that
 * completed, rejected and cancelled fit inside the total, and never works one
 * figure out from another.
 *
 * ⚠️ Scoped by the session, so the call takes no vendor id. Whose report it is
 * is decided by who is signed in — never by a route or a caller. It rejects
 * with `unauthorized` when nobody is signed in and when the session is a
 * customer's. A period with no work is zeros and no rating — an ordinary
 * answer, not an error.
 *
 * A frontend contract: no backend report endpoint exists yet. With the backend
 * live, `getReport` refuses (`REPORTS_NOT_SUPPORTED`) rather than show figures
 * nobody counted, and the Reports screen says so calmly (code review,
 * 17/11/2026).
 *
 * ⚠️ `getTodayRequests` is the dashboard's one figure (section 30's Today's
 * Requests), on its own so it can be answered where `getReport` cannot: the
 * live service counts it from the vendor's own request list and says exactly
 * what it counts (`ApiVendorReportService`). The mock answers it from the same
 * table as its `today` report, so the two cannot disagree there.
 */

/** Section 42's time filters: Today, This Week, This Month. */
export type VendorReportPeriod = 'today' | 'week' | 'month';

/** Every period, in the order section 42 lists them. */
export const VENDOR_REPORT_PERIODS: readonly VendorReportPeriod[] = Object.freeze([
  'today',
  'week',
  'month',
]);

/** One period's figures, as the server counted them. */
export interface VendorReport {
  /** The period these figures are for — always the one that was asked for. */
  period: VendorReportPeriod;

  /** Requests that reached this vendor in the period, whatever became of them. */
  totalRequests: number;

  /** Work the vendor completed in the period. */
  completedRequests: number;

  /** Requests the vendor turned down in the period (section 33). */
  rejectedRequests: number;

  /** Requests called off in the period. */
  cancelledRequests: number;

  /**
   * The average of the ratings `ratingCount` counts, on section 24's one-to-five
   * scale, to one decimal place (the server's rounding). `null` exactly when
   * there are none — an average of nothing is not zero stars.
   */
  averageRating: number | null;

  /** How many ratings the average comes from. Zero when `averageRating` is null. */
  ratingCount: number;
}

/** Section 30's Today's Requests, as the dashboard draws it. */
export interface VendorTodayRequests {
  /** Requests that reached this vendor today — see the implementation for exactly which. */
  totalRequests: number;
  /**
   * True when it was counted from a list longer than the app reads in one go
   * (`AppConfig.api.fullListMaxPages` pages): the figure is then "at least" that
   * many, drawn "N+" like the dashboard's other counts. Absent when whole.
   */
  isLowerBound?: boolean;
}

export interface VendorReportService {
  /**
   * The signed-in vendor's figures for one period.
   *
   * Rejects with `unauthorized` without a vendor session, and with
   * `validation` for anything that is not one of the three periods.
   */
  getReport(period: VendorReportPeriod): Promise<VendorReport>;

  /**
   * How many requests reached the signed-in vendor today — the dashboard's
   * figure. Rejects with `unauthorized` without a vendor session. Zero is an
   * ordinary answer.
   */
  getTodayRequests(): Promise<VendorTodayRequests>;
}
