/**
 * The vendor's side of the per-service switch (Phase 4A, 17/11/2026): which
 * vendor services run on the backend by default, and the one rule between
 * them. Kept beside `ServiceRegistry.test.ts`, which pins the rest.
 *
 * - The request list, the dashboard, the team, the profile and the reports are
 *   live (the reports refuse their periods and count today's requests from the
 *   list — code review, 17/11/2026: a real vendor never sees fixture figures).
 * - The request list and the dashboard move together: both read the vendor's
 *   `/requests/list`, and their mocks share one book of answers.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { ApiVendorDashboardService } from '@/shared/services/api/ApiVendorDashboardService';
import { ApiVendorProfileService } from '@/shared/services/api/ApiVendorProfileService';
import { ApiVendorReportService } from '@/shared/services/api/ApiVendorReportService';
import { ApiVendorRequestService } from '@/shared/services/api/ApiVendorRequestService';
import { ApiVendorTeamService } from '@/shared/services/api/ApiVendorTeamService';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorReportService } from '@/shared/services/mock/MockVendorReportService';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import { MockVendorTeamService } from '@/shared/services/mock/MockVendorTeamService';
import { configureServices, getService, resetServices } from '@/shared/services/ServiceRegistry';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  resetServices();
  jest.restoreAllMocks();
});

describe('the vendor’s services, by default', () => {
  it('runs the request list, the dashboard, the team and the profile on the backend', () => {
    configureServices();

    expect(getService('vendorRequests')).toBeInstanceOf(ApiVendorRequestService);
    expect(getService('vendorDashboard')).toBeInstanceOf(ApiVendorDashboardService);
    expect(getService('vendorTeam')).toBeInstanceOf(ApiVendorTeamService);
    expect(getService('vendorProfile')).toBeInstanceOf(ApiVendorProfileService);
  });

  it('runs the reports on the backend too, so no fixture figure sits beside live work', () => {
    configureServices();

    expect(getService('vendorReports')).toBeInstanceOf(ApiVendorReportService);
  });

  it('moves the request list and the dashboard together', () => {
    const live: readonly string[] = AppConfig.services.live;

    expect(live.includes('vendorRequests')).toBe(live.includes('vendorDashboard'));
  });
});

describe('flipping them', () => {
  it('runs every vendor service on its mock when none is named', () => {
    configureServices({ live: [] });

    expect(getService('vendorRequests')).toBeInstanceOf(MockVendorRequestService);
    expect(getService('vendorDashboard')).toBeInstanceOf(MockVendorDashboardService);
    expect(getService('vendorTeam')).toBeInstanceOf(MockVendorTeamService);
    expect(getService('vendorProfile')).toBeInstanceOf(MockVendorProfileService);
  });

  it('moves only the one it names', () => {
    configureServices({ live: ['vendorTeam'] });

    expect(getService('vendorTeam')).toBeInstanceOf(ApiVendorTeamService);
    expect(getService('vendorProfile')).toBeInstanceOf(MockVendorProfileService);
    expect(getService('vendorRequests')).toBeInstanceOf(MockVendorRequestService);
  });

  it('runs the reports on their mock when they are not named', () => {
    configureServices({ live: ['vendorRequests', 'vendorDashboard'] });

    expect(getService('vendorReports')).toBeInstanceOf(MockVendorReportService);
  });
});
