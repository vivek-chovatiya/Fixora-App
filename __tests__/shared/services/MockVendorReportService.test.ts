/**
 * The mock vendor report service stands in for the endpoint section 42's
 * report will live on, so it is held to what a backend would do,
 * independently of any screen:
 *
 * - it answers for the signed-in vendor only — nobody, and a customer, are
 *   refused; the call takes a period and nothing else, never a vendor id
 * - it answers the period it was asked about, labelled with it, with exactly
 *   the report's fields
 * - Ravi's figures differ from period to period, and one period has no
 *   ratings at all (`null`, never 0); Meena's are zeros everywhere, and so are
 *   those of any vendor registered in the app
 * - it refuses a period that is not one of the three
 * - every answer is a fresh object, so a caller cannot change the next one
 */

import type { AuthUser } from '@/features/auth/types';
import { MockVendorReportService } from '@/shared/services/mock/MockVendorReportService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import {
  VENDOR_REPORT_PERIODS,
  type VendorReport,
  type VendorReportPeriod,
} from '@/shared/services/types/VendorReportService';
import { AppError } from '@/shared/types/error';

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const MEENA: AuthUser = {
  id: 'usr_vendor_2',
  firstName: 'Meena',
  lastName: 'Iyer',
  phone: '9000000002',
  role: 'vendor',
};

const ASHA: AuthUser = {
  id: 'usr_customer_1',
  firstName: 'Asha',
  lastName: 'Patel',
  phone: '9876543210',
  role: 'customer',
};

/** Ravi's figures, as the fixtures write them. */
const RAVI_REPORTS: Record<VendorReportPeriod, VendorReport> = {
  today: {
    period: 'today',
    totalRequests: 4,
    completedRequests: 1,
    rejectedRequests: 1,
    cancelledRequests: 0,
    averageRating: null,
    ratingCount: 0,
  },
  week: {
    period: 'week',
    totalRequests: 15,
    completedRequests: 9,
    rejectedRequests: 2,
    cancelledRequests: 1,
    averageRating: 4.5,
    ratingCount: 6,
  },
  month: {
    period: 'month',
    totalRequests: 48,
    completedRequests: 34,
    rejectedRequests: 6,
    cancelledRequests: 3,
    averageRating: 4.3,
    ratingCount: 21,
  },
};

const zerosFor = (period: VendorReportPeriod): VendorReport => ({
  period,
  totalRequests: 0,
  completedRequests: 0,
  rejectedRequests: 0,
  cancelledRequests: 0,
  averageRating: null,
  ratingCount: 0,
});

let current: AuthUser | null;

function service() {
  return new MockVendorReportService({ latency: NO_LATENCY, currentUser: async () => current });
}

/** What the service rejected with, as an AppError. */
async function refusal(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    return AppError.from(caught);
  }
  throw new Error('Expected the call to be refused');
}

beforeEach(() => {
  current = RAVI;
});

describe('MockVendorReportService — Ravi’s figures', () => {
  it.each(VENDOR_REPORT_PERIODS)('answers %s with that period’s figures, labelled with it', async period => {
    expect(await service().getReport(period)).toEqual(RAVI_REPORTS[period]);
  });

  it('gives each period different figures', async () => {
    const reports = service();
    const answers = await Promise.all(VENDOR_REPORT_PERIODS.map(period => reports.getReport(period)));
    const totals = answers.map(report => report.totalRequests);

    expect(new Set(totals).size).toBe(VENDOR_REPORT_PERIODS.length);
  });

  it('has a period with no ratings, said as null with a count of zero — never an average of 0', async () => {
    const today = await service().getReport('today');

    expect(today.averageRating).toBeNull();
    expect(today.ratingCount).toBe(0);
  });

  it('carries exactly a report’s fields', async () => {
    const report = await service().getReport('week');

    expect(Object.keys(report).sort()).toEqual([
      'averageRating',
      'cancelledRequests',
      'completedRequests',
      'period',
      'ratingCount',
      'rejectedRequests',
      'totalRequests',
    ]);
  });

  it('has no money anywhere in it', async () => {
    const report = await service().getReport('month');

    // Nor a rate: a key ending in "Rate" (a completion or acceptance rate) is section 78's, Phase 2.
    expect(JSON.stringify(report)).not.toMatch(/amount|earning|revenue|payment|price|rate"/i);
  });
});

describe('MockVendorReportService — nothing yet', () => {
  it.each(VENDOR_REPORT_PERIODS)('gives Meena zeros and no rating for %s', async period => {
    current = MEENA;

    expect(await service().getReport(period)).toEqual(zerosFor(period));
  });

  it('gives a vendor registered in the app zeros too', async () => {
    current = { ...MEENA, id: 'usr_vendor_registered_9' };

    expect(await service().getReport('month')).toEqual(zerosFor('month'));
  });
});

describe('MockVendorReportService — whose report', () => {
  it('refuses when nobody is signed in, and for a customer', async () => {
    const reports = service();

    for (const who of [null, ASHA]) {
      current = who;
      for (const period of VENDOR_REPORT_PERIODS) {
        expect((await refusal(reports.getReport(period))).kind).toBe('unauthorized');
      }
    }

    current = RAVI;
    expect(await reports.getReport('today')).toEqual(RAVI_REPORTS.today);
  });

  it('refuses when it was never told who is signed in', async () => {
    const reports = new MockVendorReportService({ latency: NO_LATENCY });

    expect((await refusal(reports.getReport('today'))).kind).toBe('unauthorized');
  });

  it('never shows one vendor another’s figures', async () => {
    const reports = service();
    expect(await reports.getReport('week')).toEqual(RAVI_REPORTS.week);

    current = MEENA;
    expect(await reports.getReport('week')).toEqual(zerosFor('week'));

    current = RAVI;
    expect(await reports.getReport('week')).toEqual(RAVI_REPORTS.week);
  });

  it('takes a period and nothing else: whose report it is, is the session’s alone', () => {
    expect(service().getReport.length).toBe(1);
  });
});

describe('MockVendorReportService — what it is sent', () => {
  it('refuses a period that is not one of the three', async () => {
    const reports = service();

    for (const period of ['year', 'yesterday', '', 'TODAY']) {
      const refused = await refusal(reports.getReport(period as VendorReportPeriod));
      expect(refused.kind).toBe('validation');
    }
  });

  it('checks who is asking before what they asked for', async () => {
    current = null;

    expect((await refusal(service().getReport('year' as VendorReportPeriod))).kind).toBe('unauthorized');
  });
});

describe('MockVendorReportService — copies', () => {
  it('hands out fresh objects, so a caller cannot change the next answer', async () => {
    const reports = service();
    const first = await reports.getReport('month');
    first.totalRequests = 999;
    first.averageRating = 1;

    expect(await reports.getReport('month')).toEqual(RAVI_REPORTS.month);
  });

  it('never hands back the table it reads from, even when the table hands back the same object', async () => {
    const shared: VendorReport = { ...RAVI_REPORTS.week };
    const reports = new MockVendorReportService({
      latency: NO_LATENCY,
      currentUser: async () => current,
      reportFor: () => shared,
    });

    const answer = await reports.getReport('week');
    answer.completedRequests = 0;

    expect(answer).not.toBe(shared);
    expect(shared.completedRequests).toBe(RAVI_REPORTS.week.completedRequests);
  });

  it('labels the answer with the period asked for, whatever the table says', async () => {
    const reports = new MockVendorReportService({
      latency: NO_LATENCY,
      currentUser: async () => current,
      reportFor: () => ({ ...RAVI_REPORTS.week }),
    });

    expect((await reports.getReport('month')).period).toBe('month');
  });
});
