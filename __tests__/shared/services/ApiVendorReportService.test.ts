/**
 * ApiVendorReportService reads the vendor's report from `POST /vendors/report
 * { period }` (Phase 4B contract §5, 24/11/2026; PROJECT_BIBLE.md sections 30
 * and 42). Pinned here:
 *
 * - the one route and its exact body — the period key and nothing else: no
 *   vendor id, no dates the phone worked out;
 * - the answer checked against `VendorReport` — the period echoed, whole
 *   counts, an average or `null` — and nothing financial passed on;
 * - Today's requests as the `today` report's total, one call, whole — the same
 *   figure the Reports screen shows, never counted on the phone;
 * - the session, and failures as their own kinds.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';

import { httpClient } from '@/core/http/HttpClient';
import type { AuthUser } from '@/features/auth/types';
import { ApiVendorReportService } from '@/shared/services/api/ApiVendorReportService';
import { VENDOR_REPORT_PERIODS, type VendorReportPeriod } from '@/shared/services/types/VendorReportService';
import { AppError } from '@/shared/types/error';

type Reply = { status: number; body: unknown } | 'network';

const sent: { method: string; url?: string; body: Record<string, unknown> }[] = [];
const originalAdapter = httpClient.defaults.adapter;

/** The report route, answering each call with `reply(body)`. */
function backend(reply: (body: Record<string, unknown>) => Reply): void {
  const adapter: AxiosAdapter = async config => {
    const body = JSON.parse((config.data as string) ?? '{}');
    sent.push({ method: (config.method ?? 'get').toUpperCase(), url: config.url, body });
    const answer = config.url === '/vendors/report' ? reply(body) : 'network';
    if (answer === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response: AxiosResponse = { data: answer.body, status: answer.status, statusText: '', headers: {}, config };
    if (answer.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

const ok = (data: unknown): Reply => ({
  status: 200,
  body: { success: true, message: 'Done.', data, meta: null, errors: null },
});
const fail = (status: number, message: string, code?: string): Reply => ({
  status,
  body: { success: false, message, code, errors: null, data: null },
});

/** The contract's answer for a period, as the backend sends it. */
function report(period: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    period,
    totalRequests: 12,
    completedRequests: 7,
    rejectedRequests: 2,
    cancelledRequests: 1,
    averageRating: 4.6,
    ratingCount: 5,
    from: '2026-11-17T18:30:00.000Z',
    to: '2026-11-18T18:30:00.000Z',
    timeZone: 'Asia/Kolkata',
    ...extra,
  };
}

const ME = '6afc3ce87d5e8db042251443';
const vendor: AuthUser = { id: ME, firstName: 'Ravi', lastName: 'Kumar', phone: '9000000001', role: 'vendor' };
let session: AuthUser | null;
const service = () => new ApiVendorReportService({ currentUser: async () => session });

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

beforeEach(() => {
  sent.length = 0;
  session = vendor;
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

describe('getReport', () => {
  it.each(VENDOR_REPORT_PERIODS)('asks for %s by its key alone, and reads the figures as the server counted them', async period => {
    backend(body => ok(report(String(body.period))));

    const figures = await service().getReport(period);

    expect(sent).toEqual([{ method: 'POST', url: '/vendors/report', body: { period } }]);
    expect(figures).toEqual({
      period,
      totalRequests: 12,
      completedRequests: 7,
      rejectedRequests: 2,
      cancelledRequests: 1,
      averageRating: 4.6,
      ratingCount: 5,
    });
  });

  it('passes on exactly the report’s figures — not the backend’s working, and nothing financial', async () => {
    backend(() => ok(report('week', { amount: 1999, earnings: 5000 })));

    const figures = await service().getReport('week');

    expect(Object.keys(figures).sort()).toEqual(
      [
        'averageRating',
        'cancelledRequests',
        'completedRequests',
        'period',
        'ratingCount',
        'rejectedRequests',
        'totalRequests',
      ].sort(),
    );
    expect(JSON.stringify(figures)).not.toMatch(/from|to"|timeZone|amount|earnings|1999|5000/);
  });

  it('keeps a period nobody rated as no average — never zero stars', async () => {
    backend(() => ok(report('month', { averageRating: null, ratingCount: 0 })));

    await expect(service().getReport('month')).resolves.toMatchObject({ averageRating: null, ratingCount: 0 });
  });

  it('never checks that completed, rejected and cancelled fit inside the total — they count when they happened', async () => {
    backend(() => ok(report('today', { totalRequests: 0, completedRequests: 1 })));

    await expect(service().getReport('today')).resolves.toMatchObject({ totalRequests: 0, completedRequests: 1 });
  });

  it.each([
    ['another period than the one asked for', { period: 'month' }],
    ['a count that is not whole', { completedRequests: 1.5 }],
    ['a negative count', { rejectedRequests: -1 }],
    ['a count as text', { totalRequests: '12' }],
    ['a missing count', { cancelledRequests: undefined }],
    ['an average that is not a number', { averageRating: '4.6' }],
    ['a rating count that is not whole', { ratingCount: null }],
  ])('refuses an answer with %s as a server fault — no figures drawn from a guess', async (_name, extra) => {
    backend(() => ok(report('week', extra)));

    expect((await rejectionOf(service().getReport('week'))).kind).toBe('server');
  });

  it('refuses a period that is not one of the three as validation, and sends nothing', async () => {
    backend(() => ok(report('year')));

    expect((await rejectionOf(service().getReport('year' as VendorReportPeriod))).kind).toBe('validation');
    expect(sent).toEqual([]);
  });

  it.each([
    ['a refusal of the period', fail(400, 'Validation Failed', 'VALIDATION_FAILED'), 'validation'],
    ['a server fault', fail(500, 'Internal Server Error', 'INTERNAL_ERROR'), 'server'],
    ['a dropped connection', 'network' as const, 'network'],
  ])('rejects %s as its own kind, so the screen shows its error with Try again where it helps', async (_name, reply, kind) => {
    backend(() => reply);

    expect((await rejectionOf(service().getReport('today'))).kind).toBe(kind);
  });
});

describe('getTodayRequests', () => {
  it('is the today report’s total — one call, whole, never a lower bound', async () => {
    backend(body => ok(report(String(body.period), { totalRequests: 3 })));

    await expect(service().getTodayRequests()).resolves.toEqual({ totalRequests: 3 });
    expect(sent).toEqual([{ method: 'POST', url: '/vendors/report', body: { period: 'today' } }]);
  });

  it('is the same figure the Reports screen shows for Today', async () => {
    backend(body => ok(report(String(body.period), { totalRequests: 8 })));

    const reports = service();
    const [today, figure] = await Promise.all([reports.getReport('today'), reports.getTodayRequests()]);

    expect(figure.totalRequests).toBe(today.totalRequests);
  });

  it('never reads the request list to count it on the phone', async () => {
    backend(body => ok(report(String(body.period))));

    await service().getTodayRequests();

    expect(sent.map(call => call.url)).toEqual(['/vendors/report']);
  });

  it('refuses an answer for another period as a server fault', async () => {
    backend(() => ok(report('week')));

    expect((await rejectionOf(service().getTodayRequests())).kind).toBe('server');
  });

  it('rejects a dropped connection as network, so the figure shows its own failure', async () => {
    backend(() => 'network');

    expect((await rejectionOf(service().getTodayRequests())).kind).toBe('network');
  });
});

describe('the session', () => {
  it.each([
    ['nobody', null],
    ['a customer', { ...vendor, role: 'customer' as const }],
  ])('refuses %s as unauthorized, and sends nothing', async (_name, who) => {
    session = who;
    backend(body => ok(report(String(body.period))));

    expect((await rejectionOf(service().getTodayRequests())).kind).toBe('unauthorized');
    expect((await rejectionOf(service().getReport('today'))).kind).toBe('unauthorized');
    expect(sent).toEqual([]);
  });

  it('never sends a vendor id — whose report it is, is the token’s', async () => {
    backend(body => ok(report(String(body.period))));

    await service().getReport('month');

    expect(JSON.stringify(sent)).not.toContain(ME);
  });
});
