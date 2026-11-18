/**
 * The code review's list rules (lead, 17/11/2026), across the Api services:
 *
 * - a list the app reads whole says when it was cut short at the page ceiling
 *   (`postAllPages` → `{ items, truncated }`), logs that once, and a count taken
 *   from it says it is "at least" (`VendorDashboardCounts.isLowerBound`);
 * - one row that breaks the contract is left out of its list with one log line
 *   — never an id or a value — rather than failing the whole list, for the
 *   customer's requests and the vendor's work alike;
 * - a customer's request with no sub-category still opens, named by its
 *   category, with no `subCategoryId` key at all.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import type { AuthUser } from '@/features/auth/types';
import { ApiRequestService } from '@/shared/services/api/ApiRequestService';
import { ApiVendorDashboardService } from '@/shared/services/api/ApiVendorDashboardService';
import { malformedResponse, readRows } from '@/shared/services/api/apiResponse';
import { groupVendorWork } from '@/shared/services/api/vendorWork';
import { AppError } from '@/shared/types/error';

type Answer = { status: number; body: unknown };

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

function backendAnswers(answer: (config: InternalAxiosRequestConfig) => Answer): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    const reply = answer(config);
    const response: AxiosResponse = {
      data: reply.body,
      status: reply.status,
      statusText: '',
      headers: {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

function ok(data: unknown, meta: Record<string, unknown> = {}): Answer {
  return {
    status: 200,
    body: { success: true, message: 'ok', data, meta: { hasNextPage: false, ...meta }, errors: null },
  };
}

const CUSTOMER_ID = '6afc3e5d7c2e50812e44de8f';
const VENDOR_ID = '6afc3e5d7c2e50812e44de9b';
const CATEGORY_ID = '6afc3e5d7c2e50812e44de7b';

let idSeed = 0;
function nextId(): string {
  idSeed += 1;
  return `6afc3ea3c2951ec40c9a${String(idSeed).padStart(4, '0')}`;
}

/** A request as the backend lists it, waiting for any vendor. */
function requestRow(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    requestNumber: `REQ-${id.slice(-6)}`,
    customerId: { _id: CUSTOMER_ID, firstName: 'Asha', lastName: 'Patel' },
    vendorId: null,
    categoryId: { _id: CATEGORY_ID, name: 'Electrical' },
    subCategoryId: { _id: '6afc3e5d7c2e50812e44de83', name: 'Switch & Socket Repair' },
    serviceAddress: '12 Park Street, Pune',
    status: 'PENDING',
    priority: 'NORMAL',
    createdAt: '2026-11-17T09:00:00.000Z',
    updatedAt: '2026-11-17T09:00:00.000Z',
    ...extra,
  };
}

const VENDOR: AuthUser = {
  id: VENDOR_ID,
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

let warnings: unknown[][] = [];

beforeEach(() => {
  sent.length = 0;
  warnings = [];
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    warnings.push(args);
  });
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

describe('a list cut short at the page ceiling', () => {
  // First in the file on purpose: "once" is once per list for the life of the app.
  it('flags the dashboard counts as lower bounds, and logs it once however often it is read', async () => {
    backendAnswers(() => ok([requestRow(nextId())], { hasNextPage: true }));
    const dashboard = new ApiVendorDashboardService({ currentUser: async () => VENDOR });

    const first = await dashboard.getDashboard(3);
    await dashboard.getDashboard(3);

    expect(sent).toHaveLength(2 * AppConfig.api.fullListMaxPages);
    expect(first.counts.isLowerBound).toBe(true);
    expect(first.counts.pending).toBe(AppConfig.api.fullListMaxPages);
    const ceilingLines = warnings.filter(line => JSON.stringify(line).includes('page ceiling'));
    expect(ceilingLines).toHaveLength(1);
  });

  it('leaves the flag out entirely when the whole list was read', async () => {
    backendAnswers(() => ok([requestRow(nextId()), requestRow(nextId())]));
    const dashboard = new ApiVendorDashboardService({ currentUser: async () => VENDOR });

    const { counts } = await dashboard.getDashboard(3);

    expect(counts).toEqual({ pending: 2, active: 0, completed: 0 });
    expect(counts).not.toHaveProperty('isLowerBound');
  });
});

describe('readRows', () => {
  const read = (row: unknown) => {
    if (typeof row !== 'string') {
      throw malformedResponse('thing.name');
    }
    return row.toUpperCase();
  };

  it('keeps the good rows and leaves out the broken ones, logging once by count', () => {
    const items = readRows(['a', 42, 'b', null], read, 'thing');

    expect(items).toEqual(['A', 'B']);
    expect(warnings).toHaveLength(1);
    expect(JSON.stringify(warnings[0])).toContain('"skipped":2');
    expect(JSON.stringify(warnings[0])).not.toContain('42');
  });

  it('logs nothing when every row is good', () => {
    readRows(['a', 'b'], read, 'thing');

    expect(warnings).toHaveLength(0);
  });

  it('still rejects a failure that is not a broken row', () => {
    const failing = () => {
      throw new AppError({ kind: 'network' });
    };

    expect(() => readRows(['a'], failing, 'thing')).toThrow(AppError);
  });
});

describe('the customer’s requests', () => {
  const service = () => new ApiRequestService({ currentCustomerId: async () => CUSTOMER_ID });

  it('leave a broken row out of the recent list and keep the rest', async () => {
    const good = nextId();
    const broken = nextId();
    backendAnswers(() =>
      ok([requestRow(broken, { categoryId: CATEGORY_ID, subCategoryId: null }), requestRow(good)]),
    );

    const recent = await service().listRecentRequests(5);

    expect(recent.map(request => request.id)).toEqual([good]);
    const logged = JSON.stringify(warnings);
    expect(logged).toContain('"skipped":1');
    expect(logged).not.toContain(broken);
  });

  it('leave a broken row out of the Active view, which the app pages itself', async () => {
    const good = nextId();
    backendAnswers(() => ok([requestRow(nextId(), { priority: undefined }), requestRow(good)]));

    const page = await service().listRequests('active', { page: 1, pageSize: 20 });

    expect(page.items.map(request => request.id)).toEqual([good]);
    expect(page.total).toBe(1);
  });

  it('open a request with no sub-category, named by its category', async () => {
    const id = nextId();
    backendAnswers(() => ok(requestRow(id, { subCategoryId: null })));

    const details = await service().getRequest(id);

    expect(details).not.toBeNull();
    expect(details?.serviceName).toBe('Electrical');
    expect(details?.categoryId).toBe(CATEGORY_ID);
    expect(details).not.toHaveProperty('subCategoryId');
  });

  it('still keep the sub-category when there is one', async () => {
    const id = nextId();
    backendAnswers(() => ok(requestRow(id)));

    const details = await service().getRequest(id);

    expect(details?.subCategoryId).toBe('6afc3e5d7c2e50812e44de83');
  });
});

describe('the vendor’s work', () => {
  it('leaves a broken row out of its groups with one log line, and keeps the rest', () => {
    const good = nextId();
    const noName = nextId();
    const noPriority = nextId();

    const work = groupVendorWork(
      [
        requestRow(noName, { categoryId: CATEGORY_ID, subCategoryId: null }),
        requestRow(good),
        requestRow(noPriority, { priority: undefined }),
        { status: 'PENDING' },
      ],
      VENDOR_ID,
      [requestRow(nextId(), { createdAt: 'not a date' })],
    );

    expect(work.pending.map(job => job.id)).toEqual([good]);
    expect(work.rejected).toEqual([]);
    expect(warnings).toHaveLength(1);
    const logged = JSON.stringify(warnings);
    expect(logged).toContain('"skipped":4');
    expect(logged).not.toContain(noName);
    expect(logged).not.toContain(noPriority);
  });
});
