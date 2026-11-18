/**
 * ApiVendorDashboardService composes the dashboard on the device from the
 * vendor's own `/requests/list` (Phase 4A, 17/11/2026: the backend has no
 * dashboard endpoint). Pinned here: it is a derivation and nothing more — the
 * counts are the request list's group sizes and the previews their first few,
 * so the dashboard and the list cannot disagree; the rejected group is not
 * counted; section 32 holds on its cards; and it asks nothing a vendor session
 * does not own.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import type { AuthUser } from '@/features/auth/types';
import { ApiVendorDashboardService } from '@/shared/services/api/ApiVendorDashboardService';
import { ApiVendorRequestService } from '@/shared/services/api/ApiVendorRequestService';
import { AppError } from '@/shared/types/error';

const sent: { url?: string; body: unknown }[] = [];
const originalAdapter = httpClient.defaults.adapter;

function listAnswers(rows: unknown[] | 'network'): void {
  const adapter: AxiosAdapter = async config => {
    sent.push({ url: config.url, body: JSON.parse((config.data as string) ?? '{}') });
    if (rows === 'network' || config.url !== '/requests/list') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    // The request list's second answer (what this vendor declined); the dashboard never asks it.
    const declined = JSON.parse((config.data as string) ?? '{}').declined === true;
    const response: AxiosResponse = {
      data: {
        success: true,
        message: 'Service requests retrieved successfully.',
        data: declined ? [] : rows,
        meta: { total: declined ? 0 : rows.length, page: 1, limit: 100, pages: 1, hasNextPage: false },
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
const CUSTOMER = { _id: '6afc3ce87d5e8db04225143e', firstName: 'Ashwini', lastName: 'Kulkarni', phone: '9876543210', email: 'a@example.com' };

let counter = 0;
/** A real instant, an hour later for each row made. */
const hoursAfterStart = (hours: number) =>
  new Date(Date.UTC(2026, 10, 1) + hours * 3_600_000).toISOString();

function row(status: string, vendor: 'me' | 'other' | null, extra: Record<string, unknown> = {}) {
  counter += 1;
  return {
    id: `6afc3ce97d5e8db0422${String(counter).padStart(5, '0')}`,
    customerId: CUSTOMER,
    vendorId: vendor === null ? null : { _id: vendor === 'me' ? ME : OTHER },
    categoryId: { _id: '6afc3ce87d5e8db04225142a', name: 'Electrical' },
    subCategoryId: { _id: '6afc3ce87d5e8db042251431', name: 'Fan & Light Installation' },
    addressId: '6afc3ce87d5e8db042251440',
    serviceAddress: '14, 3rd Cross, 5th Block, Koramangala',
    priority: 'MEDIUM',
    status,
    createdAt: hoursAfterStart(counter),
    updatedAt: hoursAfterStart(counter),
    ...extra,
  };
}

const vendor: AuthUser = { id: ME, firstName: 'Ravi', lastName: 'Kumar', phone: '9000000001', role: 'vendor' };
let session: AuthUser | null;
const currentUser = async () => session;

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

/** A vendor's work: three waiting, two under way, three finished, one declined, and others' work. */
function work() {
  return [
    row('PENDING', null),
    row('PENDING', 'me'),
    row('PENDING', null),
    row('ACCEPTED', 'me'),
    row('IN_PROGRESS', 'me'),
    row('COMPLETED', 'me', { completedAt: '2026-11-12T10:00:00.000Z' }),
    row('COMPLETED', 'me', { completedAt: '2026-11-14T10:00:00.000Z' }),
    row('COMPLETED', 'me', { completedAt: '2026-11-13T10:00:00.000Z' }),
    row('REJECTED', 'me'),
    row('ACCEPTED', 'other'),
    row('REJECTED', null),
  ];
}

describe('getDashboard', () => {
  it('reads the vendor’s own list — never the declined answer, which is no dashboard’s business', async () => {
    listAnswers([]);

    await new ApiVendorDashboardService({ currentUser }).getDashboard(3);

    expect(sent).toEqual([
      {
        url: '/requests/list',
        body: { page: AppConfig.pagination.initialPage, limit: AppConfig.api.fullListPageSize },
      },
    ]);
  });

  it('counts every group whole and previews only as many as asked', async () => {
    listAnswers(work());

    const dashboard = await new ApiVendorDashboardService({ currentUser }).getDashboard(2);

    // The declined request and other vendors' work are counted nowhere.
    expect(dashboard.counts).toEqual({ pending: 3, active: 2, completed: 3 });
    expect(dashboard.pending).toHaveLength(2);
    expect(dashboard.active).toHaveLength(2);
    expect(dashboard.recentlyCompleted).toHaveLength(2);
    expect(Object.keys(dashboard).sort()).toEqual(['active', 'counts', 'pending', 'recentlyCompleted']);
  });

  it('is the request list’s groups, in the request list’s order — the two cannot disagree', async () => {
    const rows = work();
    listAnswers(rows);

    const dashboard = await new ApiVendorDashboardService({ currentUser }).getDashboard(10);
    const list = await new ApiVendorRequestService({ currentUser }).listRequests();

    expect(dashboard.pending).toEqual(list.pending);
    expect(dashboard.active).toEqual(list.active);
    expect(dashboard.recentlyCompleted).toEqual(list.completed);
    expect(dashboard.counts).toEqual({
      pending: list.pending.length,
      active: list.active.length,
      completed: list.completed.length,
    });
  });

  it('keeps the customer off the waiting cards (section 32), and `_id` off every card', async () => {
    listAnswers(work());

    const dashboard = await new ApiVendorDashboardService({ currentUser }).getDashboard(10);

    const waiting = JSON.stringify(dashboard.pending);
    for (const secret of ['Ashwini', 'Kulkarni', '9876543210', 'a@example.com', '3rd Cross']) {
      expect(waiting).not.toContain(secret);
    }
    expect(JSON.stringify(dashboard)).not.toMatch(/_id|serviceAddress|email/);
    expect(dashboard.active[0].customerName).toBe('Ashwini Kulkarni');
  });

  it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])(
    'previews nothing for a limit that is not a usable number (%p), and still counts',
    async limit => {
      listAnswers(work());

      const dashboard = await new ApiVendorDashboardService({ currentUser }).getDashboard(limit);

      expect(dashboard.pending).toEqual([]);
      expect(dashboard.counts.pending).toBe(3);
    },
  );

  it('marks the counts a lower bound when the list was longer than the app reads — never silently low', async () => {
    // A backend that always says there is more: the read stops at the page ceiling.
    const adapter: AxiosAdapter = async config => {
      sent.push({ url: config.url, body: JSON.parse((config.data as string) ?? '{}') });
      const response: AxiosResponse = {
        data: {
          success: true,
          message: 'Done.',
          data: [row('PENDING', null)],
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

    const dashboard = await new ApiVendorDashboardService({ currentUser }).getDashboard(3);

    expect(sent).toHaveLength(AppConfig.api.fullListMaxPages);
    expect(dashboard.counts.isLowerBound).toBe(true);
    expect(dashboard.counts.pending).toBe(AppConfig.api.fullListMaxPages);
  });

  it('leaves whole counts unmarked', async () => {
    listAnswers(work());

    const dashboard = await new ApiVendorDashboardService({ currentUser }).getDashboard(3);

    expect(dashboard.counts).not.toHaveProperty('isLowerBound');
  });

  it('answers a vendor with no work with zeros and empty lists, not an error', async () => {
    listAnswers([]);

    await expect(new ApiVendorDashboardService({ currentUser }).getDashboard(3)).resolves.toEqual({
      counts: { pending: 0, active: 0, completed: 0 },
      pending: [],
      active: [],
      recentlyCompleted: [],
    });
  });

  it.each([
    ['nobody', null],
    ['a customer', { ...vendor, role: 'customer' as const }],
  ])('refuses %s as unauthorized, and sends nothing', async (_name, who) => {
    session = who;
    listAnswers([]);

    const error = await new ApiVendorDashboardService({ currentUser })
      .getDashboard(3)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).kind).toBe('unauthorized');
    expect(sent).toEqual([]);
  });

  it('rejects a dropped connection as network', async () => {
    listAnswers('network');

    const error = await new ApiVendorDashboardService({ currentUser })
      .getDashboard(3)
      .catch((caught: unknown) => caught);

    expect((error as AppError).kind).toBe('network');
  });
});
