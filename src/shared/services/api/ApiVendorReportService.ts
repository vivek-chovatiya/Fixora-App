/**
 * ApiVendorReportService
 *
 * VendorReportService against the real backend (Phase 4A, code review of
 * 17/11/2026). The backend has no report endpoint, so this service does the two
 * honest things there are, and nothing it would have to invent:
 *
 * - **The period reports refuse** (`REPORTS_NOT_SUPPORTED`, kind `forbidden`,
 *   not retryable) for today, this week and this month alike. Section 42's
 *   figures — completed, rejected, cancelled, the rating for the period — and
 *   the period boundaries are the server's to count (`VendorReportService`'s
 *   header); counted on the phone they would be the phone's clock over the part
 *   of the work this vendor's list happens to show. The Reports screen says
 *   calmly that reports are not available yet.
 * - **Today's requests, the dashboard's figure**, is counted from the vendor's
 *   own `POST /requests/list` — the same read and the same reader
 *   (`vendorWork.ts`) the dashboard's work comes from. It counts every request
 *   in the vendor's groups — waiting for them (open or directed), accepted,
 *   in progress, completed, or a directed one they rejected — whose `createdAt`
 *   falls on today's calendar date in India time (`scheduledAt.ts`, the app's
 *   one place that knows the offset). It does NOT count: open requests this
 *   vendor declined (they are no longer in that list), open requests no longer
 *   waiting, cancelled ones, or another vendor's. "Raised today and still in
 *   front of this vendor", which is what a dashboard can say truthfully.
 *
 * ⚠️ A second read of the list beside the dashboard's own, and capped like it
 * at `AppConfig.api.fullListMaxPages` pages — past that the figure is a lower
 * bound and says so (`isLowerBound`), as the dashboard's counts do (the
 * backend gap: a report endpoint).
 */

import type { AuthUser } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import { notSupported } from '@/shared/services/api/notSupported';
import { fromScheduledAt } from '@/shared/services/api/scheduledAt';
import { groupVendorWork } from '@/shared/services/api/vendorWork';
import type {
  VendorReport,
  VendorReportPeriod,
  VendorReportService,
  VendorTodayRequests,
} from '@/shared/services/types/VendorReportService';
import { AppError } from '@/shared/types/error';

export interface ApiVendorReportServiceOptions {
  /** The signed-in account, or null. Asked on every call. */
  currentUser: () => Promise<AuthUser | null>;
  /** Injectable clock, so a test can pin "today". */
  now?: () => number;
}

/** The calendar date of an instant in India time — `scheduledAt.ts`'s reading, its date part. */
function indiaDate(instant: string): string | undefined {
  return fromScheduledAt(instant).preferredDate;
}

export class ApiVendorReportService extends BaseApiService implements VendorReportService {
  private readonly currentUser: () => Promise<AuthUser | null>;
  private readonly now: () => number;

  constructor(options: ApiVendorReportServiceOptions) {
    super('/requests');
    this.currentUser = options.currentUser;
    this.now = options.now ?? (() => Date.now());
  }

  async getReport(_period: VendorReportPeriod): Promise<VendorReport> {
    await this.requireVendor();
    throw notSupported('vendor reports (no report endpoint)', 'REPORTS_NOT_SUPPORTED');
  }

  async getTodayRequests(): Promise<VendorTodayRequests> {
    const vendor = await this.requireVendor();
    const list = await this.postAllPages('/list', {});
    const work = groupVendorWork(list.items, vendor.id);
    const today = indiaDate(new Date(this.now()).toISOString());

    const totalRequests = [...work.pending, ...work.active, ...work.completed, ...work.rejected].filter(
      job => today !== undefined && indiaDate(job.createdAt) === today,
    ).length;

    // Past the page ceiling the count is of what was read: "at least", never silently low.
    return { totalRequests, ...(list.truncated ? { isLowerBound: true } : {}) };
  }

  /** What an authenticated vendor endpoint does to anybody else. */
  private async requireVendor(): Promise<AuthUser> {
    const user = await this.currentUser();
    if (!user || user.role !== 'vendor') {
      throw new AppError({ kind: 'unauthorized', message: 'Vendor reports: no vendor session' });
    }
    return user;
  }
}
