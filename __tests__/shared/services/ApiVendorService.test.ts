/**
 * ApiVendorService lists the professionals a customer may ask for, from the
 * backend's public vendor list. These tests pin:
 *
 * - the route and its exact body — the sub-category is never sent (the
 *   backend's validation refuses a key it does not know), every page is read;
 * - who is left out: not available or not offering the category (both must be
 *   stated), approval or status flags that disagree when they are still sent,
 *   repeated — and that a row in the public contract's slim shape, which has no
 *   status flags at all (`requests-contract.md` §3), is kept;
 * - the backend's order, untouched (section 18A.2);
 * - a rating only with reviews behind it;
 * - that a vendor's email, phone, documents, address and owner's name never
 *   leave the service.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network. The
 * rows are `vendorMapper`'s fat shape, as the dev backend sent them on
 * 17/11/2026 (to prove nothing leaks), and the contract's slim one.
 */

import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import { ApiVendorService } from '@/shared/services/api/ApiVendorService';
import { AppError } from '@/shared/types/error';

type Reply = { status: number; body: unknown } | 'network';

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

function backendAnswers(reply: (body: Record<string, unknown>) => Reply): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    const answer = reply(JSON.parse((config.data as string) ?? '{}'));
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

function list(data: unknown, meta: Record<string, unknown> = {}): Reply {
  const count = Array.isArray(data) ? data.length : 0;
  return {
    status: 200,
    body: {
      success: true,
      message: 'Vendor list retrieved successfully.',
      data,
      meta: { total: count, page: 1, limit: 100, pages: 1, hasNextPage: false, ...meta },
      errors: null,
    },
  };
}

function bodies(): Record<string, unknown>[] {
  return sent.map(config => JSON.parse(config.data as string));
}

const ELECTRICAL = '6afc3e5d7c2e50812e44de7b';
const PLUMBING = '6afc3e5d7c2e50812e44de7c';
const FAN_INSTALL = '6afc3e5d7c2e50812e44de82';

function vendorRow(id: string, businessName: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    businessName,
    ownerName: 'Ravi Kumar',
    ownerFirstName: 'Ravi',
    ownerLastName: 'Kumar',
    email: 'ravi.kumar@example.com',
    phone: '9000000001',
    categoryIds: [ELECTRICAL],
    address: '9 Market Street, Bengaluru',
    description: 'Wiring and fittings',
    profileImage: null,
    shopImages: ['https://cdn.example/shop.jpg'],
    documents: ['https://files.example/licence.pdf'],
    averageRating: 0,
    totalReviews: 0,
    approvalStatus: 'APPROVED',
    availability: true,
    status: 'ACTIVE',
    createdAt: '2026-11-17T11:45:33.896Z',
    updatedAt: '2026-11-17T11:45:33.896Z',
    ...extra,
  };
}

/** A row in exactly the public list's contracted fields. */
function contractRow(id: string, businessName: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    businessName,
    ownerName: 'Ravi Kumar',
    description: 'Wiring and fittings',
    profileImage: null,
    categoryIds: [ELECTRICAL],
    address: 'Indiranagar',
    averageRating: 4.2,
    totalReviews: 5,
    availability: true,
    ...extra,
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

let service: ApiVendorService;

beforeEach(() => {
  sent.length = 0;
  for (const method of ['log', 'warn', 'error'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  service = new ApiVendorService();
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

describe('listEligibleVendors', () => {
  it('asks for approved, active vendors offering the category — and never sends the sub-category', async () => {
    backendAnswers(() => list([]));

    await service.listEligibleVendors(ELECTRICAL, FAN_INSTALL);

    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/vendors/list');
    expect(Object.keys(bodies()[0]).sort()).toEqual(['approvalStatus', 'categoryId', 'limit', 'page', 'status']);
    expect(bodies()[0]).toEqual({
      approvalStatus: 'APPROVED',
      status: 'ACTIVE',
      categoryId: ELECTRICAL,
      page: AppConfig.pagination.initialPage,
      limit: AppConfig.api.fullListPageSize,
    });
    expect(JSON.stringify(bodies())).not.toContain(FAN_INSTALL);
  });

  it('reads each vendor into four fields and nothing else', async () => {
    backendAnswers(() =>
      list([
        vendorRow('6afc3e5d7c2e50812e44de9b', 'Kumar Electricals', {
          profileImage: 'https://cdn.example/ravi.jpg',
          averageRating: 4.5,
          totalReviews: 12,
        }),
      ]),
    );

    const vendors = await service.listEligibleVendors(ELECTRICAL, FAN_INSTALL);

    expect(vendors).toEqual([
      {
        id: '6afc3e5d7c2e50812e44de9b',
        name: 'Kumar Electricals',
        imageUrl: 'https://cdn.example/ravi.jpg',
        rating: 4.5,
        reviewCount: 12,
      },
    ]);
  });

  it('lets no email, phone, document, address or owner’s name out', async () => {
    backendAnswers(() => list([vendorRow('6afc3e5d7c2e50812e44de9b', 'Kumar Electricals')]));

    const serialised = JSON.stringify(await service.listEligibleVendors(ELECTRICAL, FAN_INSTALL));

    for (const secret of [
      'ravi.kumar@example.com',
      '9000000001',
      'licence.pdf',
      'shop.jpg',
      '9 Market Street',
      'Ravi',
      'Wiring and fittings',
      '_id',
      'APPROVED',
    ]) {
      expect(serialised).not.toContain(secret);
    }
  });

  it('keeps a vendor in the contract’s slim shape, which carries no status flags', async () => {
    backendAnswers(() => list([contractRow('6afc3e5d7c2e50812e44de9b', 'Kumar Electricals')]));

    const vendors = await service.listEligibleVendors(ELECTRICAL, FAN_INSTALL);

    expect(vendors).toEqual([
      { id: '6afc3e5d7c2e50812e44de9b', name: 'Kumar Electricals', rating: 4.2, reviewCount: 5 },
    ]);
    expect(JSON.stringify(vendors)).not.toMatch(/Ravi|Indiranagar|Wiring/);
  });

  it.each([
    ['not available', { availability: false }],
    ['silent about availability', { availability: undefined }],
    ['offering another category', { categoryIds: [PLUMBING] }],
  ])('leaves out a slim-shaped vendor who is %s', async (_case, extra) => {
    backendAnswers(() => list([contractRow('6afc3e5d7c2e50812e44de9b', 'Left out', extra)]));

    await expect(service.listEligibleVendors(ELECTRICAL, FAN_INSTALL)).resolves.toEqual([]);
  });

  it('shows no rating for a vendor nobody has reviewed — not nought stars', async () => {
    backendAnswers(() => list([vendorRow('6afc3e5d7c2e50812e44de9b', 'Kumar Electricals', { averageRating: 0, totalReviews: 0 })]));

    const [vendor] = await service.listEligibleVendors(ELECTRICAL, FAN_INSTALL);

    expect(vendor).toEqual({ id: '6afc3e5d7c2e50812e44de9b', name: 'Kumar Electricals' });
  });

  it.each([
    ['not approved', { approvalStatus: 'PENDING' }],
    ['rejected', { approvalStatus: 'REJECTED' }],
    ['blocked', { status: 'BLOCKED' }],
    ['inactive', { status: 'INACTIVE' }],
    ['not available', { availability: false }],
    ['silent about availability', { availability: undefined }],
    ['offering another category', { categoryIds: [PLUMBING] }],
    ['offering no categories', { categoryIds: undefined }],
  ])('leaves out a vendor who is %s, should the filter ever be ignored', async (_case, extra) => {
    backendAnswers(() =>
      list([
        vendorRow('6afc3e5d7c2e50812e44de9b', 'Shown'),
        vendorRow('6afc3e5d7c2e50812e44de9c', 'Left out', extra),
      ]),
    );

    const vendors = await service.listEligibleVendors(ELECTRICAL, FAN_INSTALL);

    expect(vendors.map(vendor => vendor.name)).toEqual(['Shown']);
  });

  it('keeps the backend’s order across every page, dropping a vendor a page repeats', async () => {
    backendAnswers(body =>
      body.page === 1
        ? list([vendorRow('6afc3e5d7c2e50812e44dea1', 'Third'), vendorRow('6afc3e5d7c2e50812e44dea2', 'First')], {
            hasNextPage: true,
          })
        : list([vendorRow('6afc3e5d7c2e50812e44dea2', 'First'), vendorRow('6afc3e5d7c2e50812e44dea3', 'Second')], {
            page: 2,
            hasNextPage: false,
          }),
    );

    const vendors = await service.listEligibleVendors(ELECTRICAL, FAN_INSTALL);

    expect(bodies().map(body => body.page)).toEqual([1, 2]);
    expect(vendors.map(vendor => vendor.name)).toEqual(['Third', 'First', 'Second']);
  });

  it('answers nobody eligible with an empty list, not an error', async () => {
    backendAnswers(() => list([]));

    await expect(service.listEligibleVendors(ELECTRICAL, FAN_INSTALL)).resolves.toEqual([]);
  });

  it.each([
    ['no connection', 'network' as const, 'network'],
    [
      'a refused category id',
      {
        status: 400,
        body: { success: false, message: 'Validation Failed', code: 'VALIDATION_FAILED', data: null, errors: [{ field: 'categoryId', message: 'x' }] },
      },
      'validation',
    ],
    ['a server fault', { status: 500, body: { success: false, message: 'x', code: 'INTERNAL_ERROR', data: null, errors: null } }, 'server'],
  ])('reads %s as %s', async (_case, reply, kind) => {
    backendAnswers(() => reply as Reply);

    const error = await rejectionOf(service.listEligibleVendors(ELECTRICAL, FAN_INSTALL));

    expect(error.kind).toBe(kind);
  });

  it.each([
    ['no id', { id: undefined }],
    ['no business name', { businessName: '' }],
  ])('refuses an eligible vendor with %s as a server fault', async (_case, extra) => {
    backendAnswers(() => list([vendorRow('6afc3e5d7c2e50812e44de9b', 'Kumar Electricals', extra)]));

    const error = await rejectionOf(service.listEligibleVendors(ELECTRICAL, FAN_INSTALL));

    expect(error.kind).toBe('server');
  });
});
