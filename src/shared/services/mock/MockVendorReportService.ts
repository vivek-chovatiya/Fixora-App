/**
 * MockVendorReportService
 *
 * Stands in for the vendor report endpoint until it exists (PROJECT_BIBLE.md
 * section 42). It behaves like a backend rather than like a convenience:
 *
 * - it refuses when no vendor is signed in, and a customer is not a vendor;
 * - it re-checks the period it is sent, because a real server would, and
 *   refuses anything that is not one of the three keys (`validation`);
 * - it answers with the figures for the period it was asked about, labelled
 *   with that period, and a fresh object every time, so nothing a caller does
 *   to one answer can change the next.
 *
 * ⚠️ It counts nothing. The figures are a fixture table per vendor and per
 * period (`mockVendorReportData`), not a sum over the mock requests or reviews
 * — those mocks share no data with this one, and working out where a vendor's
 * day, week and month begin is the server's (`VendorReportService`). So
 * answering a request in the app changes no figure here.
 *
 * Slow and fallible like every mock (`simulateNetwork` with `AppConfig.mock`),
 * so the loading, error and retry states are reachable before the backend.
 *
 * Replacing this with an ApiVendorReportService requires no change to any screen.
 */

import { createLogger } from '@/core/logger/Logger';
import type { AuthUser } from '@/features/auth/types';
import { mockVendorReportFor } from '@/shared/services/mock/mockVendorReportData';
import { NO_LATENCY, simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import {
  VENDOR_REPORT_PERIODS,
  type VendorReport,
  type VendorReportPeriod,
  type VendorReportService,
} from '@/shared/services/types/VendorReportService';
import { AppError } from '@/shared/types/error';

const log = createLogger('MockVendorReportService');

export interface MockVendorReportServiceOptions {
  /** Simulated latency. Pass `NO_LATENCY` in tests. */
  latency?: MockLatency;

  /** The signed-in account, or null. Asked on every call. */
  currentUser?: () => Promise<AuthUser | null>;

  /** A vendor's figures for a period. Defaults to the table beside the fixtures. */
  reportFor?: (vendorId: string, period: VendorReportPeriod) => VendorReport;
}

export class MockVendorReportService implements VendorReportService {
  private readonly latency: MockLatency;
  private readonly currentUser?: () => Promise<AuthUser | null>;
  private readonly reportFor: (vendorId: string, period: VendorReportPeriod) => VendorReport;

  constructor(options: MockVendorReportServiceOptions = {}) {
    this.latency = options.latency ?? NO_LATENCY;
    this.currentUser = options.currentUser;
    this.reportFor = options.reportFor ?? mockVendorReportFor;
  }

  async getReport(period: VendorReportPeriod): Promise<VendorReport> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();

      // The type says it is one of three; a server cannot rely on that, and nor does this.
      if (!VENDOR_REPORT_PERIODS.includes(period)) {
        throw new AppError({ kind: 'validation', message: 'Mock vendor report: unknown period' });
      }

      // A copy, whatever the table hands back, so a caller can never reach into it.
      const report = { ...this.reportFor(vendor.id, period), period };

      // Which period, never the figures.
      log.info('Mock report read', { period });
      return report;
    }, this.latency);
  }

  /** What an authenticated vendor endpoint does to anybody else. */
  private async requireVendor(): Promise<AuthUser> {
    const user = (await this.currentUser?.()) ?? null;
    if (!user || user.role !== 'vendor') {
      throw new AppError({ kind: 'unauthorized', message: 'Mock vendor report: no vendor session' });
    }

    return user;
  }
}
