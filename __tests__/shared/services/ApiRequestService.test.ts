/**
 * ApiRequestService reads and raises a customer's requests against the real
 * backend, so these tests pin what crosses that line:
 *
 * - each endpoint, method and exact body — including what is never sent
 *   (photos, a time with no date, a vendor for open dispatch, a description
 *   nobody wrote, address details the app does not hold, a saved-address id);
 * - the one vocabulary table in both directions (PENDING ↔ PENDING_VENDOR,
 *   ASSIGNED → ACCEPTED, URGENT ↔ EMERGENCY, unknown words passed through);
 *   which vendor reference a status lets the app name;
 * - the views: one status filtered by the backend, Active paged here;
 * - the reference as `requestNumber`, the id as the database id;
 * - India time both ways; the address as the text sent, never the backend's;
 * - every failure as the interface's answer (null, or an AppError of the right
 *   kind); cancel's three answers — cancelled, refused (409
 *   `REQUEST_NOT_CANCELLABLE`), not found (404 `REQUEST_NOT_FOUND`);
 * - that the backend's populated customer and vendor — phones, emails, the
 *   vendor's auth code hash, `_id` — never leave the service.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network. The
 * row shapes are the dev backend's own (`serviceRequestMapper` with its
 * populated references), as read on 17/11/2026 — the fat, pre-privacy-fix vendor
 * on purpose, to prove nothing leaks — and the slim vendor `requests-contract.md`
 * §3 promises, to prove the mapping needs nothing more.
 */

import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import { ApiRequestService } from '@/shared/services/api/ApiRequestService';
import type { CreateRequestInput } from '@/shared/services/types/RequestService';
import { AppError } from '@/shared/types/error';

type Reply = { status: number; body: unknown } | 'network';

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

/** Answers each request with whatever `reply` gives for its URL and parsed body. */
function backendAnswers(reply: (url: string, body: Record<string, unknown>) => Reply): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    const answer = reply(config.url ?? '', JSON.parse((config.data as string) ?? '{}'));
    if (answer === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response: AxiosResponse = {
      data: answer.body,
      status: answer.status,
      statusText: '',
      headers: {},
      config,
    };
    if (answer.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

function ok(data: unknown, meta?: Record<string, unknown>, status = 200): Reply {
  return { status, body: { success: true, message: 'OK', data, meta: meta ?? {}, errors: null } };
}

function list(data: unknown[], meta: Record<string, unknown> = {}): Reply {
  return ok(data, {
    total: data.length,
    page: 1,
    limit: 20,
    pages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    ...meta,
  });
}

function failure(status: number, code: string, errors: unknown = null): Reply {
  return { status, body: { success: false, message: 'Backend English', code, errors, data: null } };
}

function bodies(): Record<string, unknown>[] {
  return sent.map(config => JSON.parse((config.data as string) ?? '{}'));
}

const CUSTOMER_ID = '6afc3e5d7c2e50812e44de8f';
const OTHER_CUSTOMER_ID = '6afc3e5d7c2e50812e44de90';
const VENDOR_ID = '6afc3e5d7c2e50812e44de9b';
const CATEGORY_ID = '6afc3e5d7c2e50812e44de7b';
const SUB_ID = '6afc3e5d7c2e50812e44de83';
const REQUEST_ID = '6afc3ea3c2951ec40c9a177a';

const SECRETS = {
  customerEmail: 'customer@fixora.com',
  customerPhone: '18005550100',
  vendorEmail: 'ravi.kumar@example.com',
  vendorPhone: '9000000001',
  authCodeHash: '$2a$10$k3Yq0mS0Hn1Vb3xQe8rNcuTqvYJ6mZp0b4yQwE2xGq1uY8l9sF1aW',
  ownerName: 'Ravi Kumar',
  savedAddress: '742 Evergreen Terrace',
};

/** The populated customer, as `/requests/list` and `/requests/detail` send it. */
function customerDocument(id = CUSTOMER_ID) {
  return {
    _id: id,
    firstName: 'Alex',
    lastName: 'Morgan',
    email: SECRETS.customerEmail,
    phone: SECRETS.customerPhone,
    profileImage: null,
    defaultAddress: '6afc3e5d7c2e50812e44de91',
    isVerified: true,
    status: 'ACTIVE',
    isDeleted: false,
    __v: 0,
  };
}

/** The populated vendor — auth code hash and all, as the dev backend really sends it. */
function vendorDocument() {
  return {
    _id: VENDOR_ID,
    businessName: 'Kumar Electricals',
    ownerName: SECRETS.ownerName,
    ownerFirstName: 'Ravi',
    ownerLastName: 'Kumar',
    email: SECRETS.vendorEmail,
    phone: SECRETS.vendorPhone,
    authCodeHash: SECRETS.authCodeHash,
    authCodeIssuedAt: '2026-11-17T11:45:33.896Z',
    categoryIds: [CATEGORY_ID],
    address: '9 Market Street, Bengaluru',
    documents: ['https://files.example/licence.pdf'],
    averageRating: 4.5,
    totalReviews: 3,
    approvalStatus: 'APPROVED',
    availability: true,
    status: 'ACTIVE',
    __v: 0,
  };
}

/** The vendor a customer may see, per `requests-contract.md` §3 — and nothing else. */
function contractVendor() {
  return {
    id: VENDOR_ID,
    businessName: 'Kumar Electricals',
    ownerName: SECRETS.ownerName,
    profileImage: null,
    averageRating: 4.5,
    totalReviews: 3,
  };
}

function requestRow(extra: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    requestNumber: 'REQ-0031002405',
    customerId: customerDocument(),
    vendorId: null,
    assignedTeamMemberId: null,
    categoryId: { _id: CATEGORY_ID, name: 'Electrical', slug: 'electrical', icon: 'flash', __v: 0 },
    subCategoryId: {
      _id: SUB_ID,
      categoryId: CATEGORY_ID,
      name: 'Switch & Socket Repair',
      estimatedPrice: 0,
      __v: 0,
    },
    // The backend fills this with whichever saved address it found first.
    addressId: {
      _id: '6afc3e5d7c2e50812e44de91',
      addressLine1: SECRETS.savedAddress,
      city: 'Springfield',
      state: 'IL',
      pincode: '62704',
    },
    serviceAddress: '12 MG Road, Ashok Nagar, Bengaluru 560001',
    description: 'The switch sparks when pressed.',
    images: [],
    completionImages: [],
    priority: 'URGENT',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    paymentMode: 'CASH',
    amount: 0,
    scheduledAt: '2026-11-20T03:30:00.000Z',
    completedAt: null,
    notes: '',
    timeline: [],
    createdAt: '2026-11-17T11:46:43.130Z',
    updatedAt: '2026-11-17T11:46:43.130Z',
    ...extra,
  };
}

/** What `POST /requests` answers: references unpopulated, as bare ids. */
function createdRow(extra: Record<string, unknown> = {}) {
  return {
    ...requestRow(),
    customerId: CUSTOMER_ID,
    categoryId: CATEGORY_ID,
    subCategoryId: SUB_ID,
    addressId: '6afc3e5d7c2e50812e44de91',
    ...extra,
  };
}

function input(extra: Partial<CreateRequestInput> = {}): CreateRequestInput {
  return {
    categoryId: CATEGORY_ID,
    subCategoryId: SUB_ID,
    priority: 'EMERGENCY',
    preferredDate: '2026-11-20',
    preferredTime: '09:00',
    notes: 'The switch sparks when pressed.',
    address: { formattedAddress: '12 MG Road, Ashok Nagar, Bengaluru 560001' },
    vendorId: VENDOR_ID,
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

function expectNothingPrivate(value: unknown): void {
  const serialised = JSON.stringify(value);
  for (const secret of Object.values(SECRETS)) {
    expect(serialised).not.toContain(secret);
  }
  expect(serialised).not.toContain('_id');
  expect(serialised).not.toContain(CUSTOMER_ID);
}

let currentCustomer: string | null;
let service: ApiRequestService;

beforeEach(() => {
  sent.length = 0;
  currentCustomer = CUSTOMER_ID;
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  service = new ApiRequestService({ currentCustomerId: async () => currentCustomer });
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

describe('createRequest', () => {
  it('sends exactly the backend’s fields, in its words, in one call', async () => {
    backendAnswers(() => ok(createdRow({ vendorId: VENDOR_ID }), undefined, 201));

    await service.createRequest(input());

    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/requests');
    expect(Object.keys(bodies()[0]).sort()).toEqual([
      'categoryId',
      'description',
      'priority',
      'scheduledAt',
      'serviceAddress',
      'subCategoryId',
      'vendorId',
    ]);
    expect(bodies()[0]).toEqual({
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_ID,
      serviceAddress: '12 MG Road, Ashok Nagar, Bengaluru 560001',
      description: 'The switch sparks when pressed.',
      // Section 15's EMERGENCY is the backend's URGENT.
      priority: 'URGENT',
      vendorId: VENDOR_ID,
      // 09:00 in India, whatever the phone's clock says.
      scheduledAt: '2026-11-20T09:00:00+05:30',
    });
  });

  it.each([
    ['LOW', 'LOW'],
    ['MEDIUM', 'MEDIUM'],
    ['HIGH', 'HIGH'],
    ['EMERGENCY', 'URGENT'],
    ['SOMEDAY', 'SOMEDAY'],
  ])('sends the app’s %s as the backend’s %s', async (app, backend) => {
    backendAnswers(() => ok(createdRow(), undefined, 201));

    await service.createRequest(input({ priority: app }));

    expect(bodies()[0].priority).toBe(backend);
  });

  it('sends no vendor for open dispatch — no key at all', async () => {
    backendAnswers(() => ok(createdRow(), undefined, 201));

    await service.createRequest(input({ vendorId: undefined }));

    expect(bodies()[0]).not.toHaveProperty('vendorId');
  });

  it('sends the parts of the address the app holds as serviceAddressDetails — and only those', async () => {
    backendAnswers(() => ok(createdRow(), undefined, 201));

    await service.createRequest(
      input({
        address: {
          formattedAddress: '12 MG Road, Ashok Nagar, Bengaluru 560001',
          addressLine: '12 MG Road',
          locality: 'Ashok Nagar, Bengaluru',
          postalCode: '560001',
          latitude: 12.9757,
          longitude: 77.6052,
          placeId: 'place_mg_road',
        },
      }),
    );

    expect(bodies()[0].serviceAddress).toBe('12 MG Road, Ashok Nagar, Bengaluru 560001');
    expect(bodies()[0].serviceAddressDetails).toEqual({
      line1: '12 MG Road',
      city: 'Ashok Nagar, Bengaluru',
      pincode: '560001',
      latitude: 12.9757,
      longitude: 77.6052,
    });
    // No second line, landmark or area the app was never told; no saved-address id (3D-10).
    expect(bodies()[0]).not.toHaveProperty('addressId');
    expect(JSON.stringify(bodies())).not.toContain('place_mg_road');
  });

  it('sends no details for a line typed by hand, and a point only as a pair', async () => {
    backendAnswers(() => ok(createdRow(), undefined, 201));

    await service.createRequest(input({ address: { formattedAddress: '12 MG Road, Bengaluru', latitude: 12.97 } }));

    expect(bodies()[0]).not.toHaveProperty('serviceAddressDetails');
  });

  it('never sends photos: there is nowhere the backend can fetch them from', async () => {
    backendAnswers(() => ok(createdRow(), undefined, 201));

    await service.createRequest(input({ imageUrls: ['file:///data/user/0/com.fixora/cache/a.jpg'] }));

    expect(bodies()[0]).not.toHaveProperty('images');
    expect(JSON.stringify(bodies())).not.toContain('a.jpg');
  });

  it('sends a date with no time as that day at midnight, India time', async () => {
    backendAnswers(() => ok(createdRow(), undefined, 201));

    await service.createRequest(input({ preferredTime: undefined }));

    expect(bodies()[0].scheduledAt).toBe('2026-11-20T00:00:00+05:30');
  });

  it.each([
    ['a time with no date', { preferredDate: undefined }],
    ['no preference', { preferredDate: undefined, preferredTime: undefined }],
  ])('sends no scheduledAt for %s', async (_case, extra) => {
    backendAnswers(() => ok(createdRow(), undefined, 201));

    await service.createRequest(input(extra));

    expect(bodies()[0]).not.toHaveProperty('scheduledAt');
  });

  it.each([
    ['absent', undefined],
    ['blank', '   '],
  ])('with notes %s, sends no description at all — nothing is written in their place', async (_case, notes) => {
    backendAnswers(() => ok(createdRow({ description: '' }), undefined, 201));

    await service.createRequest(input({ notes }));

    expect(sent.map(config => config.url)).toEqual(['/requests']);
    expect(bodies()[0]).not.toHaveProperty('description');
    expect(bodies()[0]).not.toHaveProperty('notes');
  });

  it('sends the notes exactly as typed', async () => {
    backendAnswers(() => ok(createdRow(), undefined, 201));

    await service.createRequest(input({ notes: '  Sparks when pressed.\nSecond floor.  ' }));

    expect(bodies()[0].description).toBe('  Sparks when pressed.\nSecond floor.  ');
  });

  it('refuses a blank address before sending, so the backend’s invented one is never used', async () => {
    backendAnswers(() => ok(createdRow(), undefined, 201));

    const error = await rejectionOf(service.createRequest(input({ address: { formattedAddress: '  ' } })));

    expect(error.kind).toBe('validation');
    expect(sent).toHaveLength(0);
  });

  it('answers with the id that opens it, the reference a customer quotes, and the app’s status', async () => {
    backendAnswers(() => ok(createdRow({ vendorId: VENDOR_ID }), undefined, 201));

    const created = await service.createRequest(input());

    expect(created).toEqual({
      id: REQUEST_ID,
      reference: 'REQ-0031002405',
      status: 'PENDING_VENDOR',
      createdAt: '2026-11-17T11:46:43.130Z',
    });
    expectNothingPrivate(created);
  });

  it.each([
    ['a rejected field', failure(400, 'VALIDATION_FAILED', [{ field: 'categoryId', message: '"categoryId" x' }]), 'validation'],
    ['a category that is gone', failure(404, 'NOT_FOUND'), 'notFound'],
    ['an expired session', failure(401, 'UNAUTHORIZED'), 'unauthorized'],
    ['a server fault', failure(500, 'INTERNAL_ERROR'), 'server'],
    ['no connection', 'network' as const, 'network'],
  ])('reads %s as %s', async (_case, reply, kind) => {
    backendAnswers(() => reply);

    const error = await rejectionOf(service.createRequest(input()));

    expect(error.kind).toBe(kind);
    expect(error.userMessage).not.toContain('Backend English');
  });

  it('refuses an answer with no id as a server fault', async () => {
    backendAnswers(() => ok({ ...createdRow(), id: undefined }, undefined, 201));

    const error = await rejectionOf(service.createRequest(input()));

    expect(error.kind).toBe('server');
  });
});

describe('the vocabulary', () => {
  it.each([
    ['PENDING', 'PENDING_VENDOR'],
    ['ACCEPTED', 'ACCEPTED'],
    ['ASSIGNED', 'ACCEPTED'],
    ['IN_PROGRESS', 'IN_PROGRESS'],
    ['COMPLETED', 'COMPLETED'],
    ['CANCELLED', 'CANCELLED'],
    ['REJECTED', 'REJECTED'],
    ['ON_SITE', 'ON_SITE'],
  ])('reads the backend’s %s as %s', async (backend, app) => {
    backendAnswers(() => list([requestRow({ status: backend })]));

    const page = await service.listRequests('all', { page: 1, pageSize: 20 });

    expect(page.items[0].status).toBe(app);
  });

  it.each([
    ['LOW', 'LOW'],
    ['MEDIUM', 'MEDIUM'],
    ['HIGH', 'HIGH'],
    ['URGENT', 'EMERGENCY'],
    ['WHENEVER', 'WHENEVER'],
  ])('reads the backend’s %s priority as %s', async (backend, app) => {
    backendAnswers(() => list([requestRow({ priority: backend })]));

    const page = await service.listRequests('all', { page: 1, pageSize: 20 });

    expect(page.items[0].priority).toBe(app);
  });
});

describe('listRequests', () => {
  it('asks the backend for one page of everything', async () => {
    backendAnswers(() => list([requestRow()], { total: 41, page: 2, limit: 20, pages: 3, hasNextPage: true }));

    const page = await service.listRequests('all', { page: 2, pageSize: 20 });

    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/requests/list');
    expect(bodies()[0]).toEqual({ page: 2, limit: 20 });
    expect(page).toMatchObject({ page: 2, pageSize: 20, total: 41, hasMore: true });
  });

  it.each([
    ['completed', 'COMPLETED'],
    ['cancelled', 'CANCELLED'],
  ] as const)('lets the backend filter the %s view by %s', async (filter, status) => {
    backendAnswers(() => list([]));

    await service.listRequests(filter, { page: 1, pageSize: 20 });

    expect(bodies()[0]).toEqual({ status, page: 1, limit: 20 });
  });

  it('reads every page for the active view, keeps its four statuses and pages them itself', async () => {
    const rows = [
      requestRow({ id: '6afc3ea3c2951ec40c9a1701', status: 'PENDING' }),
      requestRow({ id: '6afc3ea3c2951ec40c9a1702', status: 'COMPLETED' }),
      requestRow({ id: '6afc3ea3c2951ec40c9a1703', status: 'ACCEPTED' }),
      requestRow({ id: '6afc3ea3c2951ec40c9a1704', status: 'REJECTED' }),
      requestRow({ id: '6afc3ea3c2951ec40c9a1705', status: 'ASSIGNED' }),
      requestRow({ id: '6afc3ea3c2951ec40c9a1706', status: 'IN_PROGRESS' }),
      requestRow({ id: '6afc3ea3c2951ec40c9a1707', status: 'CANCELLED' }),
    ];
    backendAnswers((_url, body) =>
      body.page === 1
        ? list(rows.slice(0, 4), { page: 1, limit: 100, pages: 2, hasNextPage: true })
        : // The first row again: a request raised between the two reads.
          list([rows[3], ...rows.slice(4)], { page: 2, limit: 100, pages: 2, hasNextPage: false }),
    );

    const first = await service.listRequests('active', { page: 1, pageSize: 2 });

    expect(bodies().slice(0, 2)).toEqual([
      { page: 1, limit: AppConfig.api.fullListPageSize },
      { page: 2, limit: AppConfig.api.fullListPageSize },
    ]);
    expect(first.items.map(item => item.id)).toEqual(['6afc3ea3c2951ec40c9a1701', '6afc3ea3c2951ec40c9a1703']);
    expect(first).toMatchObject({ page: 1, pageSize: 2, total: 4, hasMore: true });

    const second = await service.listRequests('active', { page: 2, pageSize: 2 });

    expect(second.items.map(item => item.status)).toEqual(['ACCEPTED', 'IN_PROGRESS']);
    expect(second).toMatchObject({ page: 2, total: 4, hasMore: false });
  });

  it('answers a page past the last active one with nothing, not an error', async () => {
    backendAnswers(() => list([requestRow()]));

    const page = await service.listRequests('active', { page: 3, pageSize: 20 });

    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  it('refuses a view section 23 does not name, sending nothing', async () => {
    backendAnswers(() => list([]));

    const error = await rejectionOf(service.listRequests('archived' as never, { page: 1, pageSize: 20 }));

    expect(error.kind).toBe('validation');
    expect(sent).toHaveLength(0);
  });

  it('names a waiting request’s vendor as the one asked for, never as assigned', async () => {
    backendAnswers(() => list([requestRow({ vendorId: vendorDocument() })]));

    const [item] = (await service.listRequests('all', { page: 1, pageSize: 20 })).items;

    expect(item).toEqual({
      id: REQUEST_ID,
      reference: 'REQ-0031002405',
      serviceName: 'Switch & Socket Repair',
      status: 'PENDING_VENDOR',
      priority: 'EMERGENCY',
      createdAt: '2026-11-17T11:46:43.130Z',
      preferredVendor: { id: VENDOR_ID, name: 'Kumar Electricals' },
    });
    expect(item).not.toHaveProperty('vendorName');
  });

  it('names nobody on a request waiting for anyone', async () => {
    backendAnswers(() => list([requestRow({ vendorId: null })]));

    const [item] = (await service.listRequests('all', { page: 1, pageSize: 20 })).items;

    expect(item).not.toHaveProperty('vendorName');
    expect(item).not.toHaveProperty('preferredVendor');
  });

  it.each(['ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'])(
    'names the vendor doing a %s job as assigned, not as asked for',
    async status => {
      backendAnswers(() => list([requestRow({ status, vendorId: vendorDocument() })]));

      const [item] = (await service.listRequests('all', { page: 1, pageSize: 20 })).items;

      expect(item.vendorName).toBe('Kumar Electricals');
      expect(item).not.toHaveProperty('preferredVendor');
    },
  );

  it.each(['CANCELLED', 'REJECTED', 'ON_SITE'])(
    'names neither on a %s request, where the vendor could be either',
    async status => {
      backendAnswers(() => list([requestRow({ status, vendorId: vendorDocument() })]));

      const [item] = (await service.listRequests('all', { page: 1, pageSize: 20 })).items;

      expect(item).not.toHaveProperty('vendorName');
      expect(item).not.toHaveProperty('preferredVendor');
    },
  );

  it('names the service by its category when the sub-category is gone', async () => {
    backendAnswers(() => list([requestRow({ subCategoryId: null })]));

    const [item] = (await service.listRequests('all', { page: 1, pageSize: 20 })).items;

    expect(item.serviceName).toBe('Electrical');
  });

  it('lets no phone, email, auth code hash or _id out of a page', async () => {
    backendAnswers(() =>
      list([requestRow({ vendorId: vendorDocument() }), requestRow({ status: 'IN_PROGRESS', vendorId: vendorDocument() })]),
    );

    const page = await service.listRequests('all', { page: 1, pageSize: 20 });

    expectNothingPrivate(page);
    for (const item of page.items) {
      expect(Object.keys(item).every(key =>
        ['id', 'reference', 'serviceName', 'vendorName', 'status', 'priority', 'createdAt', 'preferredVendor'].includes(key),
      )).toBe(true);
    }
  });

  it.each([
    ['no service name at all', { subCategoryId: null, categoryId: CATEGORY_ID }],
    ['no status', { status: undefined }],
    ['no id', { id: undefined }],
  ])('leaves out a row with %s and keeps the rest (code review, 17/11/2026)', async (_case, extra) => {
    backendAnswers(() => list([requestRow(extra), requestRow({ id: '6afc3ea3c2951ec40c9a1709' })]));

    const page = await service.listRequests('all', { page: 1, pageSize: 20 });

    expect(page.items.map(item => item.id)).toEqual(['6afc3ea3c2951ec40c9a1709']);
  });
});

describe('listRecentRequests', () => {
  it('asks for the first page of exactly that many', async () => {
    backendAnswers(() => list([requestRow(), requestRow({ id: '6afc3ea3c2951ec40c9a1709' })]));

    const recent = await service.listRecentRequests(3);

    expect(bodies()[0]).toEqual({ page: 1, limit: 3 });
    expect(recent).toHaveLength(2);
  });

  it.each([
    ['none', 0],
    ['a negative number', -4],
    ['not a number', Number.NaN],
  ])('asks for nothing when the limit is %s', async (_case, limit) => {
    backendAnswers(() => list([requestRow()]));

    await expect(service.listRecentRequests(limit)).resolves.toEqual([]);
    expect(sent).toHaveLength(0);
  });

  it('asks for no more than one page can hold', async () => {
    backendAnswers(() => list([]));

    await service.listRecentRequests(500);

    expect(bodies()[0].limit).toBe(AppConfig.api.fullListPageSize);
  });
});

describe('getRequest', () => {
  it('reads one request in full by its id', async () => {
    backendAnswers(() => ok(requestRow({ vendorId: vendorDocument(), images: ['https://cdn.example/a.jpg', ''] })));

    const details = await service.getRequest(REQUEST_ID);

    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/requests/detail');
    expect(bodies()[0]).toEqual({ id: REQUEST_ID });
    expect(details).toEqual({
      id: REQUEST_ID,
      reference: 'REQ-0031002405',
      serviceName: 'Switch & Socket Repair',
      status: 'PENDING_VENDOR',
      priority: 'EMERGENCY',
      createdAt: '2026-11-17T11:46:43.130Z',
      preferredVendor: { id: VENDOR_ID, name: 'Kumar Electricals' },
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_ID,
      categoryName: 'Electrical',
      // 03:30 UTC is 09:00 in India.
      preferredDate: '2026-11-20',
      preferredTime: '09:00',
      notes: 'The switch sparks when pressed.',
      imageUrls: ['https://cdn.example/a.jpg'],
      // The text sent, never the saved address the backend linked it to.
      address: { formattedAddress: '12 MG Road, Ashok Nagar, Bengaluru 560001' },
    });
    expectNothingPrivate(details);
  });

  it('shows no notes for a request sent without a description', async () => {
    backendAnswers(() => ok(requestRow({ description: '' })));

    const details = await service.getRequest(REQUEST_ID);

    expect(details).not.toHaveProperty('notes');
  });

  it('needs nothing of the vendor beyond what the privacy contract sends', async () => {
    backendAnswers(() => ok(requestRow({ status: 'ACCEPTED', vendorId: contractVendor() })));

    const details = await service.getRequest(REQUEST_ID);

    expect(details?.vendorName).toBe('Kumar Electricals');
    expect(JSON.stringify(details)).not.toContain(SECRETS.ownerName);
  });

  it('reads a midnight preference as a day with no time, and none as none', async () => {
    backendAnswers(() => ok(requestRow({ scheduledAt: '2026-11-19T18:30:00.000Z' })));
    const dayOnly = await service.getRequest(REQUEST_ID);

    backendAnswers(() => ok(requestRow({ scheduledAt: null })));
    const none = await service.getRequest(REQUEST_ID);

    expect(dayOnly).toMatchObject({ preferredDate: '2026-11-20' });
    expect(dayOnly).not.toHaveProperty('preferredTime');
    expect(none).not.toHaveProperty('preferredDate');
    expect(none).not.toHaveProperty('preferredTime');
  });

  it('carries the payment a completed job recorded, in paise', async () => {
    backendAnswers(() =>
      ok(requestRow({ status: 'COMPLETED', vendorId: vendorDocument(), amount: 499, paymentStatus: 'PAID' })),
    );

    const details = await service.getRequest(REQUEST_ID);

    expect(details?.payment).toEqual({ finalAmountMinor: 49900, currency: 'INR', paymentStatus: 'PAID' });
    expect(details?.vendorName).toBe('Kumar Electricals');
  });

  it.each([
    // The backend's default, which nobody recorded — and the vendor's completion cannot set.
    ['completed with the payment status still the default', { status: 'COMPLETED', amount: 350, paymentStatus: 'PENDING' }],
    ['completed and paid with no amount', { status: 'COMPLETED', amount: 0, paymentStatus: 'PAID' }],
    ['paid but not completed', { status: 'IN_PROGRESS', amount: 499, paymentStatus: 'PAID' }],
  ])('says nothing about payment for a request %s', async (_case, extra) => {
    backendAnswers(() => ok(requestRow(extra)));

    const details = await service.getRequest(REQUEST_ID);

    expect(details).not.toHaveProperty('payment');
  });

  it.each([
    ['not found', failure(404, 'REQUEST_NOT_FOUND')],
    ['not found, from a backend without the new code', failure(404, 'NOT_FOUND')],
    ['an id the backend refuses', failure(400, 'VALIDATION_FAILED', [{ field: 'id', message: 'x' }])],
  ])('answers null for %s', async (_case, reply) => {
    backendAnswers(() => reply);

    await expect(service.getRequest('REQ-24081')).resolves.toBeNull();
  });

  it('answers null for a request the backend hands back for another customer', async () => {
    backendAnswers(() => ok(requestRow({ customerId: customerDocument(OTHER_CUSTOMER_ID) })));

    await expect(service.getRequest(REQUEST_ID)).resolves.toBeNull();
  });

  it('refuses with no customer signed in, asking the backend nothing', async () => {
    currentCustomer = null;
    backendAnswers(() => ok(requestRow()));

    const error = await rejectionOf(service.getRequest(REQUEST_ID));

    expect(error.kind).toBe('unauthorized');
    expect(sent).toHaveLength(0);
  });

  it.each([
    ['a server fault', failure(500, 'INTERNAL_ERROR'), 'server'],
    ['no connection', 'network' as const, 'network'],
  ])('rejects on %s rather than answering null', async (_case, reply, kind) => {
    backendAnswers(() => reply);

    const error = await rejectionOf(service.getRequest(REQUEST_ID));

    expect(error.kind).toBe(kind);
    expect(error.isRetryable).toBe(true);
  });

  it('refuses a record with no address as a server fault', async () => {
    backendAnswers(() => ok(requestRow({ serviceAddress: '' })));

    const error = await rejectionOf(service.getRequest(REQUEST_ID));

    expect(error.kind).toBe('server');
  });
});

describe('cancelRequest', () => {
  it('asks the backend to cancel by id, and shows the record it answers', async () => {
    backendAnswers(() => ok(requestRow({ status: 'CANCELLED', vendorId: vendorDocument() })));

    const result = await service.cancelRequest(REQUEST_ID);

    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/requests/cancel');
    // No reason: Phase 1 asks none.
    expect(bodies()[0]).toEqual({ id: REQUEST_ID });
    expect(result.outcome).toBe('cancelled');
    if (result.outcome === 'cancelled') {
      expect(result.request).toMatchObject({ id: REQUEST_ID, reference: 'REQ-0031002405', status: 'CANCELLED' });
      // Neither preferred nor assigned on a cancelled request.
      expect(result.request).not.toHaveProperty('vendorName');
      expect(result.request).not.toHaveProperty('preferredVendor');
    }
    expectNothingPrivate(result);
  });

  it('reads a professional having accepted it meanwhile as the refused outcome, not a failure', async () => {
    backendAnswers(() => failure(409, 'REQUEST_NOT_CANCELLABLE'));

    await expect(service.cancelRequest(REQUEST_ID)).resolves.toEqual({
      outcome: 'refused',
      reason: 'notCancellable',
    });
  });

  it('rejects a request that is not this customer’s, or gone, as not found', async () => {
    backendAnswers(() => failure(404, 'REQUEST_NOT_FOUND'));

    const error = await rejectionOf(service.cancelRequest(REQUEST_ID));

    expect(error.kind).toBe('notFound');
    expect(error.userMessage).toBe('We could not find that request.');
  });

  it.each([
    ['another conflict', failure(409, 'CONFLICT'), 'conflict'],
    ['no connection', 'network' as const, 'network'],
    ['a server fault', failure(500, 'INTERNAL_ERROR'), 'server'],
  ])('rejects %s as %s — nothing changed', async (_case, reply, kind) => {
    backendAnswers(() => reply);

    const error = await rejectionOf(service.cancelRequest(REQUEST_ID));

    expect(error.kind).toBe(kind);
  });

  it.each([
    ['a status that is not cancelled', { status: 'PENDING' }],
    ['another customer’s record', { status: 'CANCELLED', customerId: customerDocument(OTHER_CUSTOMER_ID) }],
  ])('refuses a success carrying %s as a server fault', async (_case, extra) => {
    backendAnswers(() => ok(requestRow(extra)));

    const error = await rejectionOf(service.cancelRequest(REQUEST_ID));

    expect(error.kind).toBe('server');
  });

  it('refuses with no customer signed in, asking the backend nothing', async () => {
    currentCustomer = null;
    backendAnswers(() => ok(requestRow({ status: 'CANCELLED' })));

    const error = await rejectionOf(service.cancelRequest(REQUEST_ID));

    expect(error.kind).toBe('unauthorized');
    expect(sent).toHaveLength(0);
  });
});
