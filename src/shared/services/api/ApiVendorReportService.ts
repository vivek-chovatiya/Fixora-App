/**
 * ApiVendorReportService
 *
 * VendorReportService against the real backend (Phase 4A, 17/11/2026; the
 * report endpoint arrived with the Phase 4B contract §5, 24/11/2026;
 * PROJECT_BIBLE.md sections 30 and 42). One call answers both:
 * `POST /vendors/report { period }`, scoped by the token — no vendor id is sent.
 *
 * - **The period reports** are that call's answer for `today`, `week` or
 *   `month`, read field by field against `VendorReport`: the period it echoes
 *   must be the one asked for, every count a whole number of at least zero, the
 *   average a number or `null` and the rating count a whole number. Anything
 *   else is a contract break (`server`), never figures drawn from a guess. Where
 *   a day, a week and a month begin (India time, the week from Monday) is the
 *   backend's: the app sends the key and counts nothing.
 * - **Today's requests, the dashboard's figure** (section 30), is the same call
 *   with `today`, its `totalRequests` alone — so the dashboard and the Reports
 *   screen's Today total are one figure and cannot disagree. Whole: one call,
 *   no page ceiling, so it is never a lower bound.
 *
 * ⚠️ Nothing financial is read or kept (section 42: "Do not build advanced
 * financial analytics in Phase 1"). The answer carries `from`, `to` and
 * `timeZone` too; they are the backend's working and are not read.
 *
 * ⚠️ Completed, rejected and cancelled count when they happened, so they can
 * add up to more than the total (contract §5). The app never checks that they
 * fit — the interface's rule.
 */

import type { AuthUser } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import { malformedResponse, requireRecord } from '@/shared/services/api/apiResponse';
import {
  VENDOR_REPORT_PERIODS,
  type VendorReport,
  type VendorReportPeriod,
  type VendorReportService,
  type VendorTodayRequests,
} from '@/shared/services/types/VendorReportService';
import { AppError } from '@/shared/types/error';

export interface ApiVendorReportServiceOptions {
  /** The signed-in account, or null. Asked on every call. */
  currentUser: () => Promise<AuthUser | null>;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** An average of nothing is `null`, never zero stars (`VendorReport.averageRating`). */
function isAverage(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

/** The backend's report as the app's, for the period that was asked for — or a refusal. */
function toReport(data: unknown, period: VendorReportPeriod): VendorReport {
  const record = requireRecord(data, 'vendorReport');
  if (record.period !== period) {
    throw malformedResponse('vendorReport.period');
  }
  const count = (key: string): number => {
    const value = record[key];
    if (!isCount(value)) {
      throw malformedResponse(`vendorReport.${key}`);
    }
    return value;
  };
  const averageRating = record.averageRating;
  if (!isAverage(averageRating)) {
    throw malformedResponse('vendorReport.averageRating');
  }

  return {
    period,
    totalRequests: count('totalRequests'),
    completedRequests: count('completedRequests'),
    rejectedRequests: count('rejectedRequests'),
    cancelledRequests: count('cancelledRequests'),
    averageRating,
    ratingCount: count('ratingCount'),
  };
}

export class ApiVendorReportService extends BaseApiService implements VendorReportService {
  private readonly currentUser: () => Promise<AuthUser | null>;

  constructor(options: ApiVendorReportServiceOptions) {
    super('/vendors');
    this.currentUser = options.currentUser;
  }

  async getReport(period: VendorReportPeriod): Promise<VendorReport> {
    await this.requireVendor();
    // The type says it is one of three; a caller that got around it is refused, not sent.
    if (!VENDOR_REPORT_PERIODS.includes(period)) {
      throw new AppError({ kind: 'validation', message: 'Vendor reports: unknown period' });
    }
    return this.read(period);
  }

  async getTodayRequests(): Promise<VendorTodayRequests> {
    await this.requireVendor();
    const { totalRequests } = await this.read('today');
    return { totalRequests };
  }

  private async read(period: VendorReportPeriod): Promise<VendorReport> {
    return toReport(await this.post<unknown>('/report', { period }), period);
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
