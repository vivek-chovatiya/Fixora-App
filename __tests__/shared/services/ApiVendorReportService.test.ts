/**
 * ApiVendorReportService (code review, 17/11/2026): the backend has no report
 * endpoint, so the period reports refuse — no figures nobody counted — and the
 * dashboard's Today's requests is counted from the vendor's own request list,
 * exactly as the service documents: the requests in the vendor's groups whose
 * `createdAt` is today's calendar date in India time.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import type { AuthUser } from '@/features/auth/types';
import { ApiVendorReportService } from '@/shared/services/api/ApiVendorReportService';
import { VENDOR_REPORT_PERIODS } from '@/shared/services/types/VendorReportService';
import { AppError } from '@/shared/types/error';

const sent: { url?: string; body: Record<string, unknown> }[] = [];
const originalAdapter = httpClient.defaults.adapter;

function listAnswers(rows: unknown[] | 'network'): void {
  const adapter: AxiosAdapter = async config => {
    sent.push({ url: config.url, body: JSON.parse((config.data as string) ?? '{}') });
    if (rows === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response: AxiosResponse = {
      data: {
        success: true,
        message: 'Done.',
        data: rows,
        meta: { total: rows.length, page: 1, limit: 100, pages: 1, hasNextPage: false },
        errors: null,
      },
      status: 200,
      statusText: '',
      headers: {},
      config,
    };
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

const ME = '6afc3ce87d5e8db042251443';
const OTHER = '6afc3ce87d5e8db042251499';

let counter = 0;
function row(createdAt: string, status = 'PENDING', vendor: 'me' | 'other' | null = null) {
  counter += 1;
  return {
    id: `6afc3ce97d5e8db0422${String(counter).padStart(5, '0')}`,
    customerId: '6afc3ce87d5e8db04225143e',
    vendorId: vendor === null ? null : { _id: vendor === 'me' ? ME : OTHER },
    categoryId: { _id: '6afc3ce87d5e8db04225142a', name: 'Electrical' },
    subCategoryId: { _id: '6afc3ce87d5e8db042251431', name: 'Fan & Light Installation' },
    priority: 'MEDIUM',
    status,
    createdAt,
    updatedAt: createdAt,
    declinedByMe: false,
  };
}

/** 15:00 on 18 November 2026 in India (09:30 UTC). */
const NOW = Date.parse('2026-11-18T09:30:00.000Z');

const vendor: AuthUser = { id: ME, firstName: 'Ravi', lastName: 'Kumar', phone: '9000000001', role: 'vendor' };
let session: AuthUser | null;
const service = () => new ApiVendorReportService({ currentUser: async () => session, now: () => NOW });

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
  it.each(VENDOR_REPORT_PERIODS)('refuses %s calmly — no figures nobody counted — and sends nothing', async period => {
    listAnswers([]);

    const error = await rejectionOf(service().getReport(period));

    expect(error.kind).toBe('forbidden');
    expect(error.code).toBe('REPORTS_NOT_SUPPORTED');
    expect(error.isRetryable).toBe(false);
    expect(error.userMessage).toBe('Reports aren’t available yet.');
    expect(sent).toEqual([]);
  });
});

describe('getTodayRequests', () => {
  it('reads the vendor’s own list, as the dashboard does', async () => {
    listAnswers([]);

    await expect(service().getTodayRequests()).resolves.toEqual({ totalRequests: 0 });
    expect(sent).toEqual([
      {
        url: '/requests/list',
        body: { page: AppConfig.pagination.initialPage, limit: AppConfig.api.fullListPageSize },
      },
    ]);
  });

  it('counts the requests in the vendor’s groups raised today in India time, and nothing else', async () => {
    listAnswers([
      // Today in India: counted, whichever group they are in.
      row('2026-11-18T04:00:00.000Z'), // open, waiting — 09:30 IST
      row('2026-11-17T18:40:00.000Z', 'PENDING', 'me'), // directed — 00:10 IST on the 18th
      row('2026-11-18T06:00:00.000Z', 'ACCEPTED', 'me'),
      row('2026-11-18T07:00:00.000Z', 'COMPLETED', 'me'),
      row('2026-11-18T08:00:00.000Z', 'REJECTED', 'me'), // a directed one they declined
      // Not counted:
      row('2026-11-17T18:20:00.000Z'), // 23:50 IST on the 17th: yesterday in India
      row('2026-11-18T05:00:00.000Z', 'ACCEPTED', 'other'), // another vendor's
      row('2026-11-18T05:00:00.000Z', 'CANCELLED', 'me'), // cancelled
      row('2026-11-18T05:00:00.000Z', 'REJECTED'), // open, no longer waiting
    ]);

    await expect(service().getTodayRequests()).resolves.toEqual({ totalRequests: 5 });
  });

  it('marks the figure a lower bound when the list was longer than the app reads — never silently low', async () => {
    const adapter: AxiosAdapter = async config => {
      sent.push({ url: config.url, body: JSON.parse((config.data as string) ?? '{}') });
      const response: AxiosResponse = {
        data: {
          success: true,
          message: 'Done.',
          data: [row('2026-11-18T04:00:00.000Z')],
          meta: { total: 5000, page: 1, limit: 100, pages: 50, hasNextPage: true },
          errors: null,
        },
        status: 200,
        statusText: '',
        headers: {},
        config,
      };
      return response;
    };
    httpClient.defaults.adapter = adapter;

    await expect(service().getTodayRequests()).resolves.toEqual({
      totalRequests: AppConfig.api.fullListMaxPages,
      isLowerBound: true,
    });
  });

  it('starts "today" at midnight in India, not at the phone’s or UTC’s midnight', async () => {
    // 00:10 on the 18th in India is still the 17th in UTC, and the 17th in New York.
    listAnswers([row('2026-11-17T18:40:00.000Z'), row('2026-11-17T18:29:00.000Z')]);

    await expect(service().getTodayRequests()).resolves.toEqual({ totalRequests: 1 });
  });

  it.each([
    ['nobody', null],
    ['a customer', { ...vendor, role: 'customer' as const }],
  ])('refuses %s as unauthorized, and sends nothing', async (_name, who) => {
    session = who;
    listAnswers([]);

    expect((await rejectionOf(service().getTodayRequests())).kind).toBe('unauthorized');
    expect((await rejectionOf(service().getReport('today'))).kind).toBe('unauthorized');
    expect(sent).toEqual([]);
  });

  it('rejects a dropped connection as network, so the figure shows its own failure', async () => {
    listAnswers('network');

    expect((await rejectionOf(service().getTodayRequests())).kind).toBe('network');
  });
});
