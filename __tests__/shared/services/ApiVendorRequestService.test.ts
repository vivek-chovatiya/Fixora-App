/**
 * ApiVendorRequestService reads the backend's service requests into the
 * vendor's list, details and work steps, built to the shared request contract
 * (`requests-contract.md`, 17/11/2026). These tests pin what crosses that line:
 *
 * - each call's exact route, method and body key set;
 * - the groups built from the two list answers — this vendor's records and
 *   open ones, and `declined: true` — and what belongs to none;
 * - section 32 held by the service as well as the backend: a request the
 *   vendor does not hold never carries the customer's name, phone, email or
 *   street — tested on the contract's shapes AND on an older backend's rows
 *   that sent the whole customer everywhere;
 * - the contract's codes as the interface's refusals (`REQUEST_ALREADY_TAKEN`,
 *   `REQUEST_NOT_PENDING`, `INVALID_TRANSITION`, `REQUEST_NOT_FOUND`), and no
 *   English text read to decide anything;
 * - the reference (`requestNumber`) beside the id, and the preferred time read
 *   in India time whatever the phone's zone;
 * - the payment record the backend cannot keep, refused rather than faked;
 * - `_id` never leaving the service.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import type { AuthUser } from '@/features/auth/types';
import { ApiVendorRequestService } from '@/shared/services/api/ApiVendorRequestService';
import {
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_UNPAID,
  type VendorCompletionInput,
} from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';

/* The fake backend ----------------------------------------------------- */

type Reply = { status: number; body: unknown } | 'network';
type Route = (body: Record<string, unknown> | undefined) => Reply;

interface Sent {
  method: string;
  url: string;
  body: Record<string, unknown> | undefined;
}

const sent: Sent[] = [];
const unrouted: string[] = [];
const originalAdapter = httpClient.defaults.adapter;

function backend(routes: Record<string, Route>): void {
  const adapter: AxiosAdapter = async config => {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : undefined;
    const method = (config.method ?? 'get').toUpperCase();
    sent.push({ method, url: config.url ?? '', body });

    const route = routes[`${method} ${config.url}`];
    if (!route) {
      unrouted.push(`${method} ${config.url}`);
      throw new AxiosError('No route in the fake backend', AxiosError.ERR_NETWORK, config);
    }
    const answer = route(body);
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

function ok(data: unknown, meta?: Record<string, unknown>): Reply {
  return {
    status: 200,
    body: { success: true, message: 'Done.', data, ...(meta ? { meta } : {}), errors: null },
  };
}

function fail(status: number, message: string, code?: string): Reply {
  return { status, body: { success: false, message, code, errors: null, data: null } };
}

function page(rows: unknown[], meta: Record<string, unknown> = {}): Reply {
  return ok(rows, {
    total: rows.length,
    page: 1,
    limit: 100,
    pages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    ...meta,
  });
}

/** The list route: the main answer, and the `declined: true` one. */
function lists(main: unknown[], declined: unknown[] = []): Route {
  return body => page(body?.declined === true ? declined : main);
}

/* Fixtures --------------------------------------------------------------- */

const ME = '6afc3ce87d5e8db042251443';
const OTHER_VENDOR = '6afc3ce87d5e8db042251499';
const CUSTOMER_ID = '6afc3ce87d5e8db04225143e';
const CATEGORY_ID = '6afc3ce87d5e8db04225142a';
const SUB_CATEGORY_ID = '6afc3ce87d5e8db042251431';

const CUSTOMER_FIRST = 'Ashwini';
const CUSTOMER_LAST = 'Kulkarni';
const CUSTOMER_PHONE = '9876543210';
const CUSTOMER_EMAIL = 'ashwini.k@example.com';
const STREET = '14, 3rd Cross, 5th Block';
const SERVICE_ADDRESS = `${STREET}, Koramangala, Bengaluru 560095`;
const AREA = 'Koramangala';
const CITY = 'Bengaluru';

const vendorSession: AuthUser = {
  id: ME,
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

type Holder = 'me' | 'other' | 'open';

interface RowOptions {
  vendor?: Holder;
  status?: string;
  /**
   * `contract` — the shapes the request contract promises: the customer as
   * `{ id, firstName, lastName, phone }` and the full address only on held
   * work, the area alone otherwise. `oversharing` — an older backend's rows,
   * the whole customer document and the full address on every row.
   */
  shape?: 'contract' | 'oversharing';
  extra?: Record<string, unknown>;
}

let counter = 0;
/** A fresh backend id, 24 hex digits. */
function nextId(): string {
  counter += 1;
  return `6afc3ce97d5e8db0422${String(counter).padStart(5, '0')}`;
}

const HELD_STATUSES = ['ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

/** A request as the list and detail routes answer it. */
function requestRow(id: string, options: RowOptions = {}): Record<string, unknown> {
  const holder = options.vendor ?? 'open';
  const status = options.status ?? 'PENDING';
  const held = holder === 'me' && HELD_STATUSES.includes(status);
  const contract = (options.shape ?? 'contract') === 'contract';

  const customer = contract
    ? held
      ? { id: CUSTOMER_ID, firstName: CUSTOMER_FIRST, lastName: CUSTOMER_LAST, phone: CUSTOMER_PHONE }
      : CUSTOMER_ID
    : {
        _id: CUSTOMER_ID,
        firstName: CUSTOMER_FIRST,
        lastName: CUSTOMER_LAST,
        email: CUSTOMER_EMAIL,
        phone: CUSTOMER_PHONE,
        status: 'ACTIVE',
        __v: 0,
      };
  const fullAddress = !contract || held;

  return {
    id,
    requestNumber: `REQ-${id.slice(-6)}`,
    customerId: customer,
    vendorId:
      holder === 'open'
        ? null
        : { _id: holder === 'me' ? ME : OTHER_VENDOR, businessName: 'Kumar Electricals' },
    assignedTeamMemberId: null,
    categoryId: { _id: CATEGORY_ID, name: 'Electrical', slug: 'electrical', __v: 0 },
    subCategoryId: { _id: SUB_CATEGORY_ID, name: 'Fan & Light Installation', __v: 0 },
    addressId: null,
    serviceAddress: fullAddress ? SERVICE_ADDRESS : `${AREA}, ${CITY}`,
    serviceAddressDetails: fullAddress
      ? { line1: STREET, area: AREA, city: CITY, pincode: '560095' }
      : { area: AREA, city: CITY },
    description: 'Living room ceiling fan is making clicking noise.',
    images: [],
    completionImages: [],
    priority: 'HIGH',
    status,
    paymentStatus: 'PENDING',
    paymentMode: 'CASH',
    amount: 499,
    scheduledAt: null,
    completedAt: null,
    notes: '',
    timeline: [],
    createdAt: '2026-11-17T11:39:21.050Z',
    updatedAt: '2026-11-17T11:39:21.050Z',
    // The backend's flag on an open request; this vendor has not declined it, unless a test says so.
    ...(holder === 'open' ? { declinedByMe: false } : {}),
    ...options.extra,
  };
}

/** What an action route answers: the same record, every reference a bare id. */
function bareRow(row: Record<string, unknown>, changes: Record<string, unknown>): Record<string, unknown> {
  const bare = (value: unknown) =>
    typeof value === 'object' && value !== null
      ? ((value as { _id?: string; id?: string })._id ?? (value as { id?: string }).id)
      : value;
  return {
    ...row,
    customerId: bare(row.customerId),
    vendorId: bare(row.vendorId),
    categoryId: bare(row.categoryId),
    subCategoryId: bare(row.subCategoryId),
    ...changes,
  };
}

/** Everything about the customer section 32 withholds before the vendor holds the work. */
const WITHHELD = [CUSTOMER_FIRST, CUSTOMER_LAST, CUSTOMER_PHONE, CUSTOMER_EMAIL, STREET, '560095'];

function expectWithheld(value: unknown): void {
  const text = JSON.stringify(value);
  for (const secret of WITHHELD) {
    expect(text).not.toContain(secret);
  }
  expect(value).not.toHaveProperty('customerName');
  expect(value).not.toHaveProperty('customerPhone');
  expect(value).not.toHaveProperty('address');
}

function expectNoBackendKeys(value: unknown): void {
  expect(JSON.stringify(value)).not.toMatch(
    /_id|__v|requestNumber|serviceAddress|email|authCodeHash|paymentMode|timeline|declined/,
  );
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

let session: AuthUser | null;
let service: ApiVendorRequestService;

beforeEach(() => {
  sent.length = 0;
  unrouted.length = 0;
  session = vendorSession;
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  service = new ApiVendorRequestService({ currentUser: async () => session });
});

afterEach(() => {
  expect(unrouted).toEqual([]);
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

const calls = () => sent.map(call => `${call.method} ${call.url}`);

/* The session ---------------------------------------------------------- */

describe('the session', () => {
  const each: [string, (s: ApiVendorRequestService) => Promise<unknown>][] = [
    ['listRequests', s => s.listRequests()],
    ['getRequest', s => s.getRequest(nextId())],
    ['acceptRequest', s => s.acceptRequest(nextId())],
    ['rejectRequest', s => s.rejectRequest(nextId())],
    ['startRequest', s => s.startRequest(nextId())],
    [
      'completeRequest',
      s =>
        s.completeRequest(nextId(), {
          finalAmountMinor: 49_900,
          currency: 'INR',
          paymentStatus: PAYMENT_STATUS_UNPAID,
        }),
    ],
    [
      'recordPayment',
      s => s.recordPayment(nextId(), { paymentStatus: PAYMENT_STATUS_PAID, paymentMethodId: 'cash' }),
    ],
    ['listPaymentMethods', s => s.listPaymentMethods()],
  ];

  it.each(each)('%s refuses without a session, and sends nothing', async (_name, call) => {
    session = null;
    backend({});

    expect((await rejectionOf(call(service))).kind).toBe('unauthorized');
    expect(sent).toEqual([]);
  });

  it.each(each)('%s refuses a customer’s session, and sends nothing', async (_name, call) => {
    session = { ...vendorSession, role: 'customer' };
    backend({});

    expect((await rejectionOf(call(service))).kind).toBe('unauthorized');
    expect(sent).toEqual([]);
  });

  it.each([
    ['getRequest', (s: ApiVendorRequestService) => s.getRequest('REQ-31042')],
    ['acceptRequest', (s: ApiVendorRequestService) => s.acceptRequest('REQ-31042')],
    ['rejectRequest', (s: ApiVendorRequestService) => s.rejectRequest('REQ-31042')],
    ['startRequest', (s: ApiVendorRequestService) => s.startRequest('REQ-31042')],
  ])('%s answers a reference that is not a backend id as not found, without asking', async (_name, call) => {
    backend({});

    expect((await rejectionOf(call(service))).kind).toBe('notFound');
    expect(sent).toEqual([]);
  });
});

/* The list --------------------------------------------------------------- */

describe('listRequests', () => {
  it('asks the list route twice — the vendor’s work, and what they declined — a whole page at a time', async () => {
    backend({ 'POST /requests/list': lists([]) });

    await expect(service.listRequests()).resolves.toEqual({
      pending: [],
      active: [],
      completed: [],
      rejected: [],
    });

    const firstPage = { page: AppConfig.pagination.initialPage, limit: AppConfig.api.fullListPageSize };
    expect(sent.map(call => call.body)).toEqual(
      expect.arrayContaining([firstPage, { declined: true, ...firstPage }]),
    );
    expect(sent).toHaveLength(2);
  });

  it('sorts both answers into the four groups, and leaves out what is in none', async () => {
    const broadcast = nextId();
    const directed = nextId();
    const accepted = nextId();
    const assigned = nextId();
    const inProgress = nextId();
    const completed = nextId();
    const declinedDirected = nextId();
    const declinedOpen = nextId();
    const declinedThenTaken = nextId();
    const othersWork = nextId();
    const cancelledMine = nextId();

    backend({
      'POST /requests/list': lists(
        [
          requestRow(broadcast),
          requestRow(directed, { vendor: 'me' }),
          requestRow(accepted, { vendor: 'me', status: 'ACCEPTED' }),
          requestRow(assigned, { vendor: 'me', status: 'ASSIGNED' }),
          requestRow(inProgress, { vendor: 'me', status: 'IN_PROGRESS' }),
          requestRow(completed, {
            vendor: 'me',
            status: 'COMPLETED',
            extra: { completedAt: '2026-11-17T12:00:00.000Z' },
          }),
          requestRow(declinedDirected, { vendor: 'me', status: 'REJECTED' }),
          requestRow(othersWork, { vendor: 'other', status: 'ACCEPTED' }),
          requestRow(cancelledMine, { vendor: 'me', status: 'CANCELLED' }),
        ],
        [
          // Declined open requests: still waiting for everybody else, or taken since.
          requestRow(declinedOpen),
          requestRow(declinedThenTaken, { vendor: 'other', status: 'ACCEPTED' }),
        ],
      ),
    });

    const list = await service.listRequests();

    const ids = (jobs: { id: string }[]) => jobs.map(job => job.id).sort();
    expect(ids(list.pending)).toEqual([broadcast, directed].sort());
    expect(ids(list.active)).toEqual([accepted, assigned, inProgress].sort());
    expect(ids(list.completed)).toEqual([completed]);
    expect(ids(list.rejected)).toEqual([declinedDirected, declinedOpen, declinedThenTaken].sort());
    // Declined by this vendor is `REJECTED` to them, whatever it is for everybody else.
    expect(list.rejected.every(job => job.status === 'REJECTED')).toBe(true);
    expect(list.rejected.some(job => 'dispatch' in job)).toBe(false);

    const everywhere = JSON.stringify(list);
    for (const absent of [othersWork, cancelledMine]) {
      expect(everywhere).not.toContain(absent);
    }
  });

  it('puts a record the backend flags `declinedByMe` in the rejected group, whichever answer listed it', async () => {
    const flagged = nextId();
    backend({ 'POST /requests/list': lists([requestRow(flagged, { extra: { declinedByMe: true } })]) });

    const list = await service.listRequests();

    expect(list.pending).toEqual([]);
    expect(list.rejected).toEqual([expect.objectContaining({ id: flagged, status: 'REJECTED' })]);
    expectWithheld(list.rejected[0]);
  });

  it('lets the first answer win a record both list — a backend that ignored `declined` calls nothing declined', async () => {
    const waiting = nextId();
    const rows = [requestRow(waiting)];
    backend({ 'POST /requests/list': lists(rows, rows) });

    const list = await service.listRequests();

    expect(list.pending.map(job => job.id)).toEqual([waiting]);
    expect(list.rejected).toEqual([]);
  });

  it('says how each waiting request reached this vendor, and only on waiting ones', async () => {
    const broadcast = nextId();
    const directed = nextId();
    backend({
      'POST /requests/list': lists([
        requestRow(broadcast),
        requestRow(directed, { vendor: 'me' }),
        requestRow(nextId(), { vendor: 'me', status: 'ACCEPTED' }),
      ]),
    });

    const list = await service.listRequests();

    expect(list.pending.find(job => job.id === broadcast)?.dispatch).toBe('broadcast');
    expect(list.pending.find(job => job.id === directed)?.dispatch).toBe('directed');
    expect(list.active[0]).not.toHaveProperty('dispatch');
  });

  it('reads each card into exactly the summary’s fields — the reference beside the id, the area, the tables', async () => {
    const waiting = nextId();
    const held = nextId();
    backend({
      'POST /requests/list': lists([
        requestRow(waiting, { extra: { priority: 'URGENT' } }),
        requestRow(held, { vendor: 'me', status: 'ASSIGNED' }),
      ]),
    });

    const list = await service.listRequests();

    expect(list.pending[0]).toEqual({
      id: waiting,
      reference: `REQ-${waiting.slice(-6)}`,
      serviceName: 'Fan & Light Installation',
      locality: `${AREA}, ${CITY}`,
      priority: 'EMERGENCY',
      status: 'PENDING_VENDOR',
      dispatch: 'broadcast',
      createdAt: '2026-11-17T11:39:21.050Z',
    });
    expect(list.active[0]).toEqual({
      id: held,
      reference: `REQ-${held.slice(-6)}`,
      serviceName: 'Fan & Light Installation',
      customerName: `${CUSTOMER_FIRST} ${CUSTOMER_LAST}`,
      locality: `${AREA}, ${CITY}`,
      priority: 'HIGH',
      status: 'ACCEPTED',
      createdAt: '2026-11-17T11:39:21.050Z',
    });
    expectNoBackendKeys(list);
  });

  it('leaves the reference out when the backend sends none — the id stands in for it on screen', async () => {
    backend({ 'POST /requests/list': lists([requestRow(nextId(), { extra: { requestNumber: '' } })]) });

    expect((await service.listRequests()).pending[0]).not.toHaveProperty('reference');
  });

  it.each(['contract', 'oversharing'] as const)(
    'never puts the customer on a card the vendor does not hold (section 32) — %s rows',
    async shape => {
      backend({
        'POST /requests/list': lists(
          [
            requestRow(nextId(), { shape }),
            requestRow(nextId(), { vendor: 'me', shape }),
            requestRow(nextId(), { vendor: 'me', status: 'REJECTED', shape }),
          ],
          [requestRow(nextId(), { shape }), requestRow(nextId(), { vendor: 'other', status: 'ACCEPTED', shape })],
        ),
      });

      const list = await service.listRequests();

      expect(list.pending).toHaveLength(2);
      expect(list.rejected).toHaveLength(3);
      for (const job of [...list.pending, ...list.rejected]) {
        expectWithheld(job);
      }
    },
  );

  it('keeps a status it does not know, on this vendor’s own work, as active and as sent', async () => {
    const odd = nextId();
    backend({
      'POST /requests/list': lists([requestRow(odd, { vendor: 'me', status: 'ON_HOLD', shape: 'oversharing' })]),
    });

    const list = await service.listRequests();

    expect(list.active).toEqual([expect.objectContaining({ id: odd, status: 'ON_HOLD' })]);
    expectWithheld(list.active[0]);
  });

  it('orders each group as the contract says', async () => {
    const older = nextId();
    const newer = nextId();
    const started = nextId();
    const justAccepted = nextId();
    const finishedFirst = nextId();
    const finishedLast = nextId();
    backend({
      'POST /requests/list': lists([
        requestRow(older, { extra: { createdAt: '2026-11-15T09:00:00.000Z' } }),
        requestRow(newer, { extra: { createdAt: '2026-11-17T09:00:00.000Z' } }),
        requestRow(justAccepted, {
          vendor: 'me',
          status: 'ACCEPTED',
          extra: { updatedAt: '2026-11-17T10:00:00.000Z' },
        }),
        requestRow(started, {
          vendor: 'me',
          status: 'IN_PROGRESS',
          extra: { updatedAt: '2026-11-16T10:00:00.000Z' },
        }),
        requestRow(finishedFirst, {
          vendor: 'me',
          status: 'COMPLETED',
          extra: { completedAt: '2026-11-10T10:00:00.000Z' },
        }),
        requestRow(finishedLast, {
          vendor: 'me',
          status: 'COMPLETED',
          extra: { completedAt: '2026-11-16T10:00:00.000Z' },
        }),
      ]),
    });

    const list = await service.listRequests();

    expect(list.pending.map(job => job.id)).toEqual([newer, older]);
    expect(list.active.map(job => job.id)).toEqual([started, justAccepted]);
    expect(list.completed.map(job => job.id)).toEqual([finishedLast, finishedFirst]);
  });

  it('reads every page, and keeps a request two pages both listed once', async () => {
    const first = nextId();
    const second = nextId();
    backend({
      'POST /requests/list': body =>
        body?.declined === true
          ? page([])
          : body?.page === 1
            ? page([requestRow(first)], { total: 2, pages: 2, hasNextPage: true, limit: 1 })
            : page([requestRow(first), requestRow(second)], { page: 2, total: 2, pages: 2 }),
    });

    const list = await service.listRequests();

    expect(sent.filter(call => call.body?.declined !== true).map(call => call.body?.page)).toEqual([1, 2]);
    expect(list.pending.map(job => job.id).sort()).toEqual([first, second].sort());
  });

  it('refuses an answer that is not a list as a server fault', async () => {
    backend({ 'POST /requests/list': () => ok({ rows: [] }) });

    expect((await rejectionOf(service.listRequests())).kind).toBe('server');
  });

  it('leaves out a record with no service name, and keeps the rest of the list (code review)', async () => {
    const good = nextId();
    backend({
      'POST /requests/list': lists([
        requestRow(nextId(), { extra: { categoryId: CATEGORY_ID, subCategoryId: null } }),
        requestRow(good),
      ]),
    });

    const list = await service.listRequests();

    expect(list.pending.map(job => job.id)).toEqual([good]);
  });

  it.each([
    ['a dropped connection', 'network' as const, 'network'],
    ['a server fault', fail(500, 'Internal Server Error', 'INTERNAL_ERROR'), 'server'],
    ['an expired session', fail(401, 'Invalid or expired authentication token.', 'UNAUTHORIZED'), 'unauthorized'],
  ])('rejects %s as an AppError of its own kind', async (_name, reply, kind) => {
    backend({ 'POST /requests/list': () => reply });

    const error = await rejectionOf(service.listRequests());

    expect(error.kind).toBe(kind);
    expect(error.userMessage).not.toMatch(/Internal Server Error|authentication token/);
  });
});

/* One request opened -------------------------------------------------- */

describe('getRequest', () => {
  it('asks the detail route by id, and nothing else', async () => {
    const id = nextId();
    backend({ 'POST /requests/detail': () => ok(requestRow(id)) });

    await service.getRequest(id);

    expect(sent).toEqual([{ method: 'POST', url: '/requests/detail', body: { id } }]);
  });

  it('opens held work whole: the reference, the customer, the phone, the address and the rest', async () => {
    const id = nextId();
    backend({
      'POST /requests/detail': () =>
        ok(
          requestRow(id, {
            vendor: 'me',
            status: 'IN_PROGRESS',
            extra: {
              images: ['https://cdn.example.com/a.jpg', '', 'https://cdn.example.com/b.jpg'],
              // 09:30 on the 18th, India time.
              scheduledAt: '2026-11-18T09:30:00+05:30',
            },
          }),
        ),
    });

    const request = await service.getRequest(id);

    expect(request).toEqual({
      id,
      reference: `REQ-${id.slice(-6)}`,
      serviceName: 'Fan & Light Installation',
      categoryName: 'Electrical',
      customerName: `${CUSTOMER_FIRST} ${CUSTOMER_LAST}`,
      customerPhone: CUSTOMER_PHONE,
      address: { formattedAddress: SERVICE_ADDRESS },
      locality: `${AREA}, ${CITY}`,
      description: 'Living room ceiling fan is making clicking noise.',
      imageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      preferredDate: '2026-11-18',
      preferredTime: '09:30',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      createdAt: '2026-11-17T11:39:21.050Z',
    });
    expectNoBackendKeys(request);
  });

  describe('the preferred moment, read in India time whatever the phone’s zone', () => {
    /**
     * The phone's own clock, answering as New York's would for 04:00 UTC on the
     * 18th — 23:00 the evening before. A reader that used the device's zone
     * would say the 17th; India's answer is 09:30 on the 18th. Stubbed rather
     * than set with `TZ`: Jest does not pick up a zone changed at run time, and
     * Node on Windows ignores the variable altogether.
     */
    function phoneInNewYork(): void {
      jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2026);
      jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getDate').mockReturnValue(17);
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(23);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
      jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(300);
    }

    it('reads 04:00 UTC as 09:30 on the 18th in India, not the phone’s 23:00 on the 17th', async () => {
      const id = nextId();
      backend({
        'POST /requests/detail': () => ok(requestRow(id, { extra: { scheduledAt: '2026-11-18T04:00:00.000Z' } })),
      });
      phoneInNewYork();

      const request = await service.getRequest(id);

      expect(request.preferredDate).toBe('2026-11-18');
      expect(request.preferredTime).toBe('09:30');
    });

    it('reads midnight in India as a date with no time', async () => {
      const id = nextId();
      backend({
        'POST /requests/detail': () => ok(requestRow(id, { extra: { scheduledAt: '2026-11-19T18:30:00.000Z' } })),
      });
      phoneInNewYork();

      const request = await service.getRequest(id);

      expect(request.preferredDate).toBe('2026-11-20');
      expect(request).not.toHaveProperty('preferredTime');
    });

    it('carries no preference when the backend has none', async () => {
      const id = nextId();
      backend({ 'POST /requests/detail': () => ok(requestRow(id)) });

      const request = await service.getRequest(id);

      expect(request).not.toHaveProperty('preferredDate');
      expect(request).not.toHaveProperty('preferredTime');
    });
  });

  it.each([
    ['open and waiting', { vendor: 'open' as Holder }],
    ['directed at this vendor and waiting', { vendor: 'me' as Holder }],
    ['declined by this vendor', { vendor: 'me' as Holder, status: 'REJECTED' }],
  ])('opens work it does not hold — %s — with the area and no customer (section 32)', async (_name, options) => {
    for (const shape of ['contract', 'oversharing'] as const) {
      const id = nextId();
      backend({ 'POST /requests/detail': () => ok(requestRow(id, { ...options, shape })) });

      const request = await service.getRequest(id);

      expectWithheld(request);
      expect(request.locality).toBe(`${AREA}, ${CITY}`);
    }
  });

  it('never reads the area from the address text — an older backend sent the street there', async () => {
    const id = nextId();
    backend({
      'POST /requests/detail': () =>
        ok(requestRow(id, { shape: 'oversharing', extra: { serviceAddressDetails: null } })),
    });

    const request = await service.getRequest(id);

    expect(request).not.toHaveProperty('locality');
    expectWithheld(request);
  });

  it('falls back to the address-book entry’s city for the area', async () => {
    const id = nextId();
    backend({
      'POST /requests/detail': () =>
        ok(
          requestRow(id, {
            extra: {
              serviceAddressDetails: undefined,
              addressId: { _id: '6afc3ce87d5e8db042251440', addressLine1: STREET, city: 'Mysuru' },
            },
          }),
        ),
    });

    const request = await service.getRequest(id);

    expect(request.locality).toBe('Mysuru');
    expectWithheld(request);
  });

  describe('an open request this vendor declined (the detail route answers it as open, §2 amended)', () => {
    it('opens as rejected when `declinedByMe` is true — without another read', async () => {
      const id = nextId();
      backend({ 'POST /requests/detail': () => ok(requestRow(id, { extra: { declinedByMe: true } })) });

      const request = await service.getRequest(id);

      expect(calls()).toEqual(['POST /requests/detail']);
      expect(request).toMatchObject({ id, status: 'REJECTED' });
      expect(request).not.toHaveProperty('dispatch');
      expectWithheld(request);
    });

    it('opens as new when `declinedByMe` is false — without another read', async () => {
      const id = nextId();
      backend({ 'POST /requests/detail': () => ok(requestRow(id, { extra: { declinedByMe: false } })) });

      const request = await service.getRequest(id);

      expect(calls()).toEqual(['POST /requests/detail']);
      expect(request).toMatchObject({ status: 'PENDING_VENDOR', dispatch: 'broadcast' });
    });

    it('never reads a `declinedBy` array — without the flag it asks the declined answer instead', async () => {
      const id = nextId();
      backend({
        'POST /requests/detail': () =>
          ok(requestRow(id, { extra: { declinedByMe: undefined, declinedBy: [ME] } })),
        'POST /requests/list': lists([], []),
      });

      const request = await service.getRequest(id);

      expect(calls()).toEqual(['POST /requests/detail', 'POST /requests/list']);
      expect(request.status).toBe('PENDING_VENDOR');
    });

    it.each([
      ['in the declined answer', true, 'REJECTED'],
      ['not in the declined answer', false, 'PENDING_VENDOR'],
    ])('without the flag, asks the declined answer — %s, it opens as %s', async (_name, declined, status) => {
      const id = nextId();
      const row = requestRow(id, { extra: { declinedByMe: undefined } });
      backend({
        'POST /requests/detail': () => ok(row),
        'POST /requests/list': lists([], declined ? [row] : []),
      });

      const request = await service.getRequest(id);

      expect(calls()).toEqual(['POST /requests/detail', 'POST /requests/list']);
      expect(sent[1].body).toMatchObject({ declined: true });
      expect(request.status).toBe(status);
      expectWithheld(request);
    });

    it('never asks the declined answer about a request directed at this vendor, or held work', async () => {
      for (const options of [{ vendor: 'me' as Holder }, { vendor: 'me' as Holder, status: 'ACCEPTED' }]) {
        sent.length = 0;
        const id = nextId();
        backend({ 'POST /requests/detail': () => ok(requestRow(id, options)) });

        await service.getRequest(id);

        expect(calls()).toEqual(['POST /requests/detail']);
      }
    });
  });

  it('opens an open request this vendor declined — hidden from the detail route — as rejected, from the declined answer', async () => {
    const id = nextId();
    backend({
      'POST /requests/detail': () => fail(404, 'Service request not found.', 'REQUEST_NOT_FOUND'),
      'POST /requests/list': lists([], [requestRow(id)]),
    });

    const request = await service.getRequest(id);

    expect(calls()).toEqual(['POST /requests/detail', 'POST /requests/list']);
    expect(sent[1].body).toMatchObject({ declined: true });
    expect(request).toMatchObject({ id, status: 'REJECTED' });
    expectWithheld(request);
  });

  it('answers not found when the declined answer does not have it either', async () => {
    backend({
      'POST /requests/detail': () => fail(404, 'Service request not found.', 'REQUEST_NOT_FOUND'),
      'POST /requests/list': lists([], []),
    });

    const error = await rejectionOf(service.getRequest(nextId()));

    expect(error.kind).toBe('notFound');
    expect(error.code).toBe('REQUEST_NOT_FOUND');
  });

  it('answers another vendor’s record, should a backend hand one over, as not found', async () => {
    const id = nextId();
    backend({
      'POST /requests/detail': () => ok(requestRow(id, { vendor: 'other', status: 'ACCEPTED', shape: 'oversharing' })),
    });

    expect((await rejectionOf(service.getRequest(id))).kind).toBe('notFound');
  });

  it.each([
    ['500', fail(500, 'Internal Server Error', 'INTERNAL_ERROR'), 'server'],
    ['a dropped connection', 'network' as const, 'network'],
  ])('maps %s to its own kind, without looking among the declined', async (_name, reply, kind) => {
    backend({ 'POST /requests/detail': () => reply });

    expect((await rejectionOf(service.getRequest(nextId()))).kind).toBe(kind);
    expect(calls()).toEqual(['POST /requests/detail']);
  });

  it('carries a payment record only when the backend says paid, the amount read as paise', async () => {
    const paid = nextId();
    const unpaid = nextId();
    const finished = { vendor: 'me' as Holder, status: 'COMPLETED' };
    backend({
      'POST /requests/detail': body =>
        ok(
          body?.id === paid
            ? requestRow(paid, { ...finished, extra: { paymentStatus: 'PAID', amount: 185.5 } })
            : requestRow(unpaid, finished),
        ),
    });

    expect((await service.getRequest(paid)).completion).toEqual({
      finalAmountMinor: 18_550,
      currency: AppConfig.money.currency,
      paymentStatus: PAYMENT_STATUS_PAID,
    });
    expect(await service.getRequest(unpaid)).not.toHaveProperty('completion');
  });
});

/* Accepting ------------------------------------------------------------ */

describe('acceptRequest', () => {
  it('accepts by id, then reads the request whole — the customer is theirs to see now', async () => {
    const id = nextId();
    const accepted = requestRow(id, { vendor: 'me', status: 'ACCEPTED' });
    backend({
      'POST /requests/accept': () => ok(bareRow(accepted, {})),
      'POST /requests/detail': () => ok(accepted),
    });

    const result = await service.acceptRequest(id);

    expect(calls()).toEqual(['POST /requests/accept', 'POST /requests/detail']);
    expect(sent[0].body).toEqual({ id });
    expect(sent[1].body).toEqual({ id });
    expect(result).toEqual({
      outcome: 'accepted',
      request: expect.objectContaining({
        id,
        reference: `REQ-${id.slice(-6)}`,
        status: 'ACCEPTED',
        customerName: `${CUSTOMER_FIRST} ${CUSTOMER_LAST}`,
        customerPhone: CUSTOMER_PHONE,
        address: { formattedAddress: SERVICE_ADDRESS },
      }),
    });
    expectNoBackendKeys(result);
  });

  it.each([
    ['REQUEST_ALREADY_TAKEN', 'taken'],
    ['REQUEST_NOT_PENDING', 'notPending'],
  ])('reads 409 %s as the refusal %s, and reads nothing after', async (code, reason) => {
    backend({ 'POST /requests/accept': () => fail(409, 'Refused.', code) });

    await expect(service.acceptRequest(nextId())).resolves.toEqual({ outcome: 'refused', reason });
    expect(calls()).toEqual(['POST /requests/accept']);
  });

  it('decides by the code, never the words — the old English message alone is not a race', async () => {
    backend({
      'POST /requests/accept': () => fail(400, 'Cannot accept request in current status: ACCEPTED', 'BAD_REQUEST'),
    });

    expect((await rejectionOf(service.acceptRequest(nextId()))).kind).toBe('validation');
  });

  it.each([
    ['404 REQUEST_NOT_FOUND', fail(404, 'Not found.', 'REQUEST_NOT_FOUND'), 'notFound'],
    ['a 409 with a code the contract does not name', fail(409, 'Conflict.', 'CONFLICT'), 'conflict'],
    ['403 FORBIDDEN (not approved, or not this category)', fail(403, 'Forbidden.', 'FORBIDDEN'), 'forbidden'],
    ['a validation 400', fail(400, 'Validation Failed', 'VALIDATION_FAILED'), 'validation'],
    ['a server fault', fail(500, 'Internal Server Error', 'INTERNAL_ERROR'), 'server'],
    ['a dropped connection', 'network' as const, 'network'],
  ])('rejects %s as the failure it is', async (_name, reply, kind) => {
    backend({ 'POST /requests/accept': () => reply });

    expect((await rejectionOf(service.acceptRequest(nextId()))).kind).toBe(kind);
  });

  it('rejects with the read’s failure when the accepted request cannot be read after', async () => {
    const id = nextId();
    backend({
      'POST /requests/accept': () => ok(bareRow(requestRow(id, { vendor: 'me', status: 'ACCEPTED' }), {})),
      'POST /requests/detail': () => 'network',
    });

    expect((await rejectionOf(service.acceptRequest(id))).kind).toBe('network');
  });
});

/* Declining ------------------------------------------------------------ */

describe('rejectRequest', () => {
  it('reads the request, declines it by id, and answers it as rejected without the customer', async () => {
    const id = nextId();
    const before = requestRow(id);
    backend({
      'POST /requests/detail': () => ok(before),
      // An open request stays waiting for everybody else.
      'POST /requests/reject': () => ok(bareRow(before, {})),
    });

    const result = await service.rejectRequest(id);

    expect(calls()).toEqual(['POST /requests/detail', 'POST /requests/reject']);
    expect(sent[1].body).toEqual({ id });
    expect(result).toMatchObject({
      outcome: 'rejected',
      request: { id, status: 'REJECTED', serviceName: 'Fan & Light Installation' },
    });
    if (result.outcome === 'rejected') {
      expectWithheld(result.request);
      expect(result.request).not.toHaveProperty('rejectedAt');
      expect(result.request).not.toHaveProperty('dispatch');
    }
  });

  it('declines a request directed at this vendor', async () => {
    const id = nextId();
    const before = requestRow(id, { vendor: 'me' });
    backend({
      'POST /requests/detail': () => ok(before),
      'POST /requests/reject': () => ok(bareRow(before, { status: 'REJECTED' })),
    });

    await expect(service.rejectRequest(id)).resolves.toMatchObject({
      outcome: 'rejected',
      request: { status: 'REJECTED' },
    });
  });

  it('reads 409 REQUEST_NOT_PENDING on the reject as notPending', async () => {
    const id = nextId();
    backend({
      'POST /requests/detail': () => ok(requestRow(id)),
      'POST /requests/reject': () => fail(409, 'Not pending.', 'REQUEST_NOT_PENDING'),
    });

    await expect(service.rejectRequest(id)).resolves.toEqual({ outcome: 'refused', reason: 'notPending' });
  });

  it('refuses one this vendor already declined — hidden from the detail route — as notPending, sending no reject', async () => {
    const id = nextId();
    backend({
      'POST /requests/detail': () => fail(404, 'Not found.', 'REQUEST_NOT_FOUND'),
      'POST /requests/list': lists([], [requestRow(id)]),
    });

    await expect(service.rejectRequest(id)).resolves.toEqual({ outcome: 'refused', reason: 'notPending' });
    expect(calls()).not.toContain('POST /requests/reject');
  });

  it.each([
    ['held by another vendor', { vendor: 'other' as Holder, status: 'IN_PROGRESS' }, 'taken'],
    ['already accepted by this vendor', { vendor: 'me' as Holder, status: 'ACCEPTED' }, 'notPending'],
    ['already declined', { vendor: 'me' as Holder, status: 'REJECTED' }, 'notPending'],
  ])('refuses one the record shows %s, without sending the reject', async (_name, options, reason) => {
    const id = nextId();
    backend({ 'POST /requests/detail': () => ok(requestRow(id, options)) });

    await expect(service.rejectRequest(id)).resolves.toEqual({ outcome: 'refused', reason });
    expect(calls()).toEqual(['POST /requests/detail']);
  });

  it('answers a request it may not see as not found', async () => {
    backend({
      'POST /requests/detail': () => fail(404, 'Not found.', 'REQUEST_NOT_FOUND'),
      'POST /requests/list': lists([], []),
    });

    expect((await rejectionOf(service.rejectRequest(nextId()))).kind).toBe('notFound');
  });
});

/* The work ------------------------------------------------------------- */

describe('startRequest', () => {
  it.each(['ACCEPTED', 'ASSIGNED'])('starts this vendor’s %s work by id, the record whole', async status => {
    const id = nextId();
    const before = requestRow(id, { vendor: 'me', status });
    backend({
      'POST /requests/detail': () => ok(before),
      'POST /requests/start': () => ok(bareRow(before, { status: 'IN_PROGRESS' })),
    });

    const result = await service.startRequest(id);

    expect(sent[1]).toEqual({ method: 'POST', url: '/requests/start', body: { id } });
    expect(result).toMatchObject({
      outcome: 'started',
      request: {
        id,
        status: 'IN_PROGRESS',
        serviceName: 'Fan & Light Installation',
        customerName: `${CUSTOMER_FIRST} ${CUSTOMER_LAST}`,
      },
    });
  });

  it('reads 409 INVALID_TRANSITION as an invalid transition — started from somewhere else meanwhile', async () => {
    const id = nextId();
    backend({
      'POST /requests/detail': () => ok(requestRow(id, { vendor: 'me', status: 'ACCEPTED' })),
      'POST /requests/start': () => fail(409, 'Invalid transition.', 'INVALID_TRANSITION'),
    });

    await expect(service.startRequest(id)).resolves.toEqual({ outcome: 'refused', reason: 'invalidTransition' });
  });

  it.each([
    ['already started', { vendor: 'me' as Holder, status: 'IN_PROGRESS' }],
    ['still waiting for an answer', { vendor: 'me' as Holder }],
    ['open dispatch nobody has taken', { vendor: 'open' as Holder }],
  ])('refuses work the record shows %s, without sending the start', async (_name, options) => {
    const id = nextId();
    backend({ 'POST /requests/detail': () => ok(requestRow(id, options)) });

    await expect(service.startRequest(id)).resolves.toEqual({ outcome: 'refused', reason: 'invalidTransition' });
    expect(calls()).toEqual(['POST /requests/detail']);
  });

  it.each([
    ['404 REQUEST_NOT_FOUND', fail(404, 'Not found.', 'REQUEST_NOT_FOUND')],
    ['another vendor’s record handed over anyway', ok(requestRow(nextId(), { vendor: 'other', status: 'ACCEPTED' }))],
  ])('answers %s as not found', async (_name, reply) => {
    backend({ 'POST /requests/detail': () => reply });

    expect((await rejectionOf(service.startRequest(nextId()))).kind).toBe('notFound');
    expect(calls()).toEqual(['POST /requests/detail']);
  });
});

describe('completeRequest', () => {
  const unpaid = (finalAmountMinor: number): VendorCompletionInput => ({
    finalAmountMinor,
    currency: AppConfig.money.currency,
    paymentStatus: PAYMENT_STATUS_UNPAID,
  });

  it('completes work under way with the amount in rupees, and nothing else', async () => {
    const id = nextId();
    const before = requestRow(id, { vendor: 'me', status: 'IN_PROGRESS' });
    backend({
      'POST /requests/detail': () => ok(before),
      'POST /requests/complete': body =>
        ok(bareRow(before, { status: 'COMPLETED', amount: body?.amount, completedAt: '2026-11-17T13:00:00.000Z' })),
    });

    const result = await service.completeRequest(id, { ...unpaid(18_550), notes: 'Replaced the regulator.' });

    expect(sent[1]).toEqual({ method: 'POST', url: '/requests/complete', body: { id, amount: 185.5 } });
    expect(JSON.stringify(sent)).not.toContain('Replaced the regulator.');
    expect(result).toMatchObject({
      outcome: 'completed',
      request: { id, status: 'COMPLETED', completedAt: '2026-11-17T13:00:00.000Z' },
    });
  });

  it('sends a whole-rupee amount as a whole number', async () => {
    const id = nextId();
    const before = requestRow(id, { vendor: 'me', status: 'IN_PROGRESS' });
    backend({
      'POST /requests/detail': () => ok(before),
      'POST /requests/complete': () => ok(bareRow(before, { status: 'COMPLETED' })),
    });

    await service.completeRequest(id, unpaid(49_900));

    expect(sent[1].body).toEqual({ id, amount: 499 });
  });

  it('reads 409 INVALID_TRANSITION on the completion as an invalid transition', async () => {
    const id = nextId();
    backend({
      'POST /requests/detail': () => ok(requestRow(id, { vendor: 'me', status: 'IN_PROGRESS' })),
      'POST /requests/complete': () => fail(409, 'Invalid transition.', 'INVALID_TRANSITION'),
    });

    await expect(service.completeRequest(id, unpaid(49_900))).resolves.toEqual({
      outcome: 'refused',
      reason: 'invalidTransition',
    });
  });

  it('refuses a job recorded as paid — the backend cannot keep it — and sends nothing', async () => {
    backend({});

    const error = await rejectionOf(
      service.completeRequest(nextId(), {
        ...unpaid(49_900),
        paymentStatus: PAYMENT_STATUS_PAID,
        paymentMethodId: 'cash',
      }),
    );

    expect(error.kind).toBe('forbidden');
    expect(error.code).toBe('PAYMENT_RECORD_NOT_SUPPORTED');
    expect(error.isRetryable).toBe(false);
    expect(sent).toEqual([]);
  });

  it.each([
    ['no amount', { ...unpaid(0) }],
    ['a fraction of a paisa', { ...unpaid(100.5) }],
    ['more than the ceiling', { ...unpaid(100_000_001) }],
    ['another currency', { ...unpaid(49_900), currency: 'USD' }],
    ['a status nobody knows', { ...unpaid(49_900), paymentStatus: 'PART_PAID' }],
    ['a method on a job not paid', { ...unpaid(49_900), paymentMethodId: 'cash' }],
    ['notes over the ceiling', { ...unpaid(49_900), notes: 'x'.repeat(501) }],
  ])('refuses %s as validation, before anything is sent', async (_name, input) => {
    backend({});

    expect((await rejectionOf(service.completeRequest(nextId(), input))).kind).toBe('validation');
    expect(sent).toEqual([]);
  });

  it('refuses accepted work that was never started, without sending the completion', async () => {
    const id = nextId();
    backend({ 'POST /requests/detail': () => ok(requestRow(id, { vendor: 'me', status: 'ACCEPTED' })) });

    await expect(service.completeRequest(id, unpaid(49_900))).resolves.toEqual({
      outcome: 'refused',
      reason: 'invalidTransition',
    });
    expect(calls()).toEqual(['POST /requests/detail']);
  });
});

/* What the backend cannot keep -------------------------------------- */

describe('the payment record', () => {
  it.each([
    [
      'recordPayment',
      (s: ApiVendorRequestService) =>
        s.recordPayment(nextId(), { paymentStatus: PAYMENT_STATUS_PAID, paymentMethodId: 'cash' }),
    ],
    ['listPaymentMethods', (s: ApiVendorRequestService) => s.listPaymentMethods()],
  ])('%s refuses clearly — not retryable, the app’s own words — and sends nothing', async (_name, call) => {
    backend({});

    const error = await rejectionOf(call(service));

    expect(error.kind).toBe('forbidden');
    expect(error.code).toBe('PAYMENT_RECORD_NOT_SUPPORTED');
    expect(error.isRetryable).toBe(false);
    expect(error.userMessage).toBe('Recording a payment is not available in the app yet.');
    expect(sent).toEqual([]);
  });
});
