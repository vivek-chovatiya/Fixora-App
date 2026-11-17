/**
 * The mock request table has to behave like a table, because request details
 * now depends on it: what is accepted can be read back, what is read back is
 * what was sent, and what is listed is ordered by when it was raised rather than
 * by the accident of when it was inserted.
 *
 * It also has to stay a mock that nothing leans on by mistake — every instance
 * starts from the same seed, a result cannot be used to edit the table, a list
 * carries only what a card shows, and a request the backend would refuse is
 * refused rather than stored with a blank where a name should be.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { requestStateOf } from '@/features/customer/constants/requestStatus';
import {
  AsyncStorageMockRequestHistory,
  type MockRequestHistoryStorage,
} from '@/shared/services/mock/MockRequestHistoryStorage';
import { MockRequestService } from '@/shared/services/mock/MockRequestService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type { CreateRequestInput } from '@/shared/services/types/RequestService';
import { AppError } from '@/shared/types/error';

/** Real catalogue and vendor fixture ids, since the mock names requests from them. */
const INPUT: CreateRequestInput = {
  categoryId: 'cat_electrician',
  subCategoryId: 'sub_fan_repair',
  priority: 'HIGH',
  preferredDate: '2026-09-11',
  preferredTime: '18:00',
  notes: 'It rattles, then stops.',
  imageUrls: ['https://cdn.example.test/a.jpg'],
  address: {
    formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
    latitude: 12.9352,
    longitude: 77.6245,
  },
  vendorId: 'ven_sharma_electricals',
};

/** The fields a request card shows (PROJECT_BIBLE.md section 23), and no others. */
const SUMMARY_FIELDS = [
  'createdAt',
  'id',
  'preferredVendor',
  'priority',
  'serviceName',
  'status',
  'vendorName',
];

function service() {
  return new MockRequestService({ latency: NO_LATENCY });
}

describe('MockRequestService — reading back what was sent', () => {
  it('hands back the request it just accepted, as it was sent', async () => {
    const requests = service();

    const created = await requests.createRequest(INPUT);
    const record = await requests.getRequest(created.id);

    expect(record).toEqual({
      id: created.id,
      status: created.status,
      createdAt: created.createdAt,
      categoryId: INPUT.categoryId,
      subCategoryId: INPUT.subCategoryId,
      categoryName: 'Electrician',
      serviceName: 'Fan Repair',
      priority: 'HIGH',
      preferredDate: '2026-09-11',
      preferredTime: '18:00',
      notes: INPUT.notes,
      imageUrls: INPUT.imageUrls,
      address: INPUT.address,
      preferredVendor: { id: 'ven_sharma_electricals', name: 'Sharma Electricals' },
    });
  });

  it('records open dispatch as the absence of a preference', async () => {
    const requests = service();

    const { vendorId, ...open } = INPUT;
    // The fixture is directed, so removing the field is what makes this open.
    expect(vendorId).toBeDefined();

    const created = await requests.createRequest(open);
    const record = await requests.getRequest(created.id);

    // Not null and not a sentinel — absent, exactly as `vendorId` was.
    expect(record).not.toHaveProperty('preferredVendor');
    // And nobody is assigned just because nobody was asked for.
    expect(record).not.toHaveProperty('vendorName');
  });

  it('leaves optional answers out rather than storing them empty', async () => {
    const requests = service();

    const created = await requests.createRequest({
      categoryId: INPUT.categoryId,
      subCategoryId: INPUT.subCategoryId,
      priority: 'LOW',
      address: { formattedAddress: '17 Cross Lane, Devanahalli' },
    });
    const record = await requests.getRequest(created.id);

    expect(Object.keys(record ?? {}).sort()).toEqual([
      'address',
      'categoryId',
      'categoryName',
      'createdAt',
      'id',
      'priority',
      'serviceName',
      'status',
      'subCategoryId',
    ]);
    // A typed address stays a line of text; nothing adds a point to it.
    expect(record?.address).toEqual({ formattedAddress: '17 Cross Lane, Devanahalli' });
  });

  it('answers an unknown reference with null, not a failure', async () => {
    await expect(service().getRequest('REQ-00000')).resolves.toBeNull();
  });

  it('gives each request its own reference, continuing the seeded numbering', async () => {
    const requests = service();

    const first = await requests.createRequest(INPUT);
    const second = await requests.createRequest(INPUT);

    expect(first.id).toBe('REQ-24083');
    expect(second.id).toBe('REQ-24084');
    expect((await requests.getRequest(first.id))?.id).toBe(first.id);
  });

  it('reads every seeded request in full', async () => {
    const requests = service();

    const listed = await requests.listRecentRequests(50);

    expect(listed.length).toBeGreaterThan(0);
    for (const summary of listed) {
      const record = await requests.getRequest(summary.id);

      expect(record?.address.formattedAddress.trim().length).toBeGreaterThan(0);
      expect(record?.serviceName).toBe(summary.serviceName);
    }
  });
});

/**
 * The mock stores section 21 statuses and never moves them. What the customer is
 * told is derived from the status and the dispatch mode, so these assert both:
 * the stored constant, and the stage it reads as.
 */
describe('MockRequestService — status', () => {
  it('starts a request with no preference as searching', async () => {
    const requests = service();

    const { vendorId, ...open } = INPUT;
    expect(vendorId).toBeDefined();

    const created = await requests.createRequest(open);
    const record = await requests.getRequest(created.id);

    expect(created.status).toBe('PENDING_VENDOR');
    expect(record?.status).toBe('PENDING_VENDOR');
    expect(requestStateOf(record!.status, record!.preferredVendor ? 'directed' : 'open')).toBe(
      'searching',
    );
  });

  it('starts a request for a chosen professional as awaiting their response', async () => {
    const requests = service();

    const created = await requests.createRequest(INPUT);
    const record = await requests.getRequest(created.id);

    expect(record?.status).toBe('PENDING_VENDOR');
    expect(requestStateOf(record!.status, record!.preferredVendor ? 'directed' : 'open')).toBe(
      'awaiting_vendor',
    );
    // Asked for, not assigned.
    expect(record).not.toHaveProperty('vendorName');
  });

  it('never advances a status on its own, however much time passes', async () => {
    jest.useFakeTimers();

    try {
      const requests = service();
      const created = await requests.createRequest(INPUT);

      jest.advanceTimersByTime(7 * 24 * 60 * 60 * 1000);

      const record = await requests.getRequest(created.id);
      const [newest] = await requests.listRecentRequests(1);

      expect(record?.status).toBe(created.status);
      expect(newest.status).toBe(created.status);
      expect(record).not.toHaveProperty('vendorName');
    } finally {
      jest.useRealTimers();
    }
  });

  it('reads the same status back however many times it is asked', async () => {
    const requests = service();
    const created = await requests.createRequest(INPUT);

    const reads = await Promise.all([1, 2, 3].map(() => requests.getRequest(created.id)));

    expect(new Set(reads.map(record => record?.status))).toEqual(new Set(['PENDING_VENDOR']));
  });

  it('seeds every customer-facing stage, so each can be opened on a device', async () => {
    const requests = service();

    const stages = new Set<string>();
    for (const summary of await requests.listRecentRequests(50)) {
      const record = await requests.getRequest(summary.id);
      stages.add(requestStateOf(record!.status, record!.preferredVendor ? 'directed' : 'open'));
    }

    for (const stage of [
      'submitted',
      'searching',
      'awaiting_vendor',
      'assigned',
      'in_progress',
      'completed',
      'cancelled',
    ]) {
      expect(stages).toContain(stage);
    }
  });

  it('seeds no status section 21 does not name', async () => {
    const requests = service();

    for (const summary of await requests.listRecentRequests(50)) {
      expect(requestStateOf(summary.status, 'open')).not.toBe('unknown');
    }
  });
});

describe('MockRequestService — the recent list', () => {
  it('puts a request that was just raised first', async () => {
    const requests = service();

    const created = await requests.createRequest(INPUT);
    const [newest] = await requests.listRecentRequests(3);

    expect(newest.id).toBe(created.id);
    expect(newest.serviceName).toBe('Fan Repair');
    expect(newest.status).toBe('PENDING_VENDOR');
  });

  it('orders by when requests were raised, newest first', async () => {
    const requests = service();

    await requests.createRequest(INPUT);
    await requests.createRequest(INPUT);

    const listed = await requests.listRecentRequests(50);
    const times = listed.map(summary => Date.parse(summary.createdAt));

    expect(times).toEqual([...times].sort((a, b) => b - a));
    // Two raised in the same instant still come out newest first.
    expect(listed.slice(0, 2).map(summary => summary.id)).toEqual(['REQ-24084', 'REQ-24083']);
  });

  it('carries only what a card shows', async () => {
    const requests = service();

    await requests.createRequest(INPUT);
    const listed = await requests.listRecentRequests(50);

    for (const summary of listed) {
      for (const key of Object.keys(summary)) {
        expect(SUMMARY_FIELDS).toContain(key);
      }
    }
    // The address, notes and photographs stay on the record.
    expect(JSON.stringify(listed)).not.toContain(INPUT.address.formattedAddress);
    expect(JSON.stringify(listed)).not.toContain(INPUT.notes);
  });

  it('never returns more than it was asked for, nor fewer than zero', async () => {
    const requests = service();

    expect(await requests.listRecentRequests(2)).toHaveLength(2);
    expect(await requests.listRecentRequests(-4)).toHaveLength(0);
  });
});

describe('MockRequestService — staying a mock', () => {
  it('offers no way to change a request once it is sent, but to cancel it', () => {
    // The roadmap gives a customer no such operation (docs/WORKING_NOTES.md,
    // "Customer actions") except the owner's cancel of 21/10/2026, so the mock
    // carries no other for a screen to lean on.
    const operations = Object.getOwnPropertyNames(MockRequestService.prototype);

    expect(operations).toEqual(
      expect.arrayContaining(['listRecentRequests', 'getRequest', 'createRequest', 'cancelRequest']),
    );
    for (const name of operations.filter(operation => operation !== 'cancelRequest')) {
      expect(name).not.toMatch(/cancel|reschedul|update|edit|assign|accept|reject|start|complete|close|review/i);
    }
  });

  it('starts every instance from the same seed', async () => {
    const first = service();
    const created = await first.createRequest(INPUT);

    const second = service();

    // What one instance raised is invisible to another, so no test depends on
    // what a previous test happened to create.
    await expect(second.getRequest(created.id)).resolves.toBeNull();
    expect((await second.listRecentRequests(50)).map(summary => summary.id)).not.toContain(
      created.id,
    );
  });

  it('cannot be edited through a result', async () => {
    const requests = service();

    const created = await requests.createRequest(INPUT);
    const record = await requests.getRequest(created.id);

    record!.address.formattedAddress = 'Somewhere else entirely';
    record!.imageUrls!.push('https://cdn.example.test/injected.jpg');
    record!.preferredVendor!.name = 'Someone else';

    const again = await requests.getRequest(created.id);

    expect(again?.address.formattedAddress).toBe(INPUT.address.formattedAddress);
    expect(again?.imageUrls).toEqual(INPUT.imageUrls);
    expect(again?.preferredVendor?.name).toBe('Sharma Electricals');
  });

  it('cannot be edited through the payload it was sent', async () => {
    const requests = service();

    const input: CreateRequestInput = {
      ...INPUT,
      address: { ...INPUT.address },
      imageUrls: [...(INPUT.imageUrls ?? [])],
    };
    const created = await requests.createRequest(input);

    input.address.formattedAddress = 'Changed after sending';
    input.imageUrls?.push('https://cdn.example.test/late.jpg');

    const record = await requests.getRequest(created.id);

    expect(record?.address.formattedAddress).toBe(INPUT.address.formattedAddress);
    expect(record?.imageUrls).toEqual(INPUT.imageUrls);
  });

  it('refuses a service the catalogue does not offer, and stores nothing', async () => {
    const requests = service();

    const refusal = requests.createRequest({ ...INPUT, subCategoryId: 'sub_does_not_exist' });

    await expect(refusal).rejects.toBeInstanceOf(AppError);
    await expect(refusal).rejects.toMatchObject({ kind: 'validation' });
    // Nothing half-stored, and no reference spent on it.
    const created = await requests.createRequest(INPUT);
    expect(created.id).toBe('REQ-24083');
  });

  it('refuses a professional who is not offered for this service', async () => {
    const requests = service();

    // A real vendor, but a plumber — not offered for fan repair.
    const refusal = requests.createRequest({ ...INPUT, vendorId: 'ven_citywide_plumbing' });

    await expect(refusal).rejects.toMatchObject({ kind: 'validation' });
  });
});

/**
 * My Requests (PROJECT_BIBLE.md section 23) pages through the same table Home
 * summarises, so the pages have to add up: newest first, no request on two
 * pages, none skipped, the same page the same twice — and each of section 23's
 * views showing the statuses the owner confirmed and no others.
 */
describe('MockRequestService — the request history', () => {
  const CUSTOMER = 'usr_customer_1';

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  /** How many requests the seed holds. */
  const SEEDED = 8;

  const ids = (page: { items: { id: string }[] }) => page.items.map(summary => summary.id);

  it('pages the requests newest first, the same order Home uses', async () => {
    const requests = service();

    const first = await requests.listRequests('all', { page: 1, pageSize: 3 });
    const recent = await requests.listRecentRequests(3);

    expect(ids(first)).toEqual(recent.map(summary => summary.id));
    expect(first).toMatchObject({ page: 1, pageSize: 3, total: SEEDED, hasMore: true });
  });

  it('never shows a request on two pages, and skips none', async () => {
    const requests = service();

    const pages = [];
    for (let page = 1; page <= 3; page += 1) {
      pages.push(await requests.listRequests('all', { page, pageSize: 3 }));
    }
    const everything = pages.flatMap(ids);

    expect(pages.map(page => page.items.length)).toEqual([3, 3, 2]);
    expect(pages.map(page => page.hasMore)).toEqual([true, true, false]);
    expect(new Set(everything).size).toBe(SEEDED);
    expect(everything).toEqual((await requests.listRecentRequests(50)).map(summary => summary.id));
  });

  it('answers the same page the same way twice', async () => {
    const requests = service();

    const once = await requests.listRequests('all', { page: 2, pageSize: 3 });
    const twice = await requests.listRequests('all', { page: 2, pageSize: 3 });

    expect(twice).toEqual(once);
  });

  it('answers a page past the last with nothing, rather than failing', async () => {
    const past = await service().listRequests('all', { page: 9, pageSize: 3 });

    expect(past).toMatchObject({ items: [], page: 9, total: SEEDED, hasMore: false });
  });

  it('refuses a page that cannot exist, as a backend would', async () => {
    const requests = service();

    for (const request of [
      { page: 0, pageSize: 3 },
      { page: 1, pageSize: 0 },
      { page: 1.5, pageSize: 3 },
    ]) {
      await expect(requests.listRequests('all', request)).rejects.toMatchObject({
        kind: 'validation',
      });
    }
    await expect(
      requests.listRequests('everything' as never, { page: 1, pageSize: 3 }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });

  it('carries what a card shows and nothing more — the preference, never the address', async () => {
    const requests = service();
    const created = await requests.createRequest(INPUT);

    const { items } = await requests.listRequests('all', { page: 1, pageSize: 50 });
    const summary = items.find(item => item.id === created.id);

    expect(summary?.preferredVendor).toEqual({
      id: 'ven_sharma_electricals',
      name: 'Sharma Electricals',
    });
    for (const item of items) {
      for (const key of Object.keys(item)) {
        expect(SUMMARY_FIELDS).toContain(key);
      }
    }
    expect(JSON.stringify(items)).not.toContain(INPUT.address.formattedAddress);
  });

  /**
   * Every section 21 status, and one it does not name, put in the table the way
   * a restart would — through the device's saved history.
   */
  async function withEveryStatus() {
    const extra: Array<[string, string]> = [
      ['REQ-24101', 'CLOSED'],
      ['REQ-24102', 'REJECTED'],
      ['REQ-24103', 'ON_HOLD'],
      ['REQ-24104', 'ESCALATED_TO_REGION'],
      ['REQ-24105', ' in_progress '],
    ];
    const history = new AsyncStorageMockRequestHistory();
    const base = (await service().getRequest('REQ-24048'))!;

    for (const [id, status] of extra) {
      await history.save(CUSTOMER, { ...base, id, status, createdAt: new Date().toISOString() });
    }

    return new MockRequestService({
      latency: NO_LATENCY,
      history,
      currentCustomerId: async () => CUSTOMER,
    });
  }

  it('shows each view the statuses the owner confirmed', async () => {
    const requests = await withEveryStatus();
    const view = async (filter: 'all' | 'active' | 'completed' | 'cancelled') =>
      ids(await requests.listRequests(filter, { page: 1, pageSize: 50 })).sort();

    expect(await view('active')).toEqual(
      // Created, waiting, accepted, in progress (however it is cased) and on hold.
      ['REQ-24063', 'REQ-24070', 'REQ-24076', 'REQ-24079', 'REQ-24081', 'REQ-24103', 'REQ-24105'],
    );
    expect(await view('completed')).toEqual(['REQ-24012', 'REQ-24048', 'REQ-24101']);
    expect(await view('cancelled')).toEqual(['REQ-24020']);
    expect(await view('all')).toHaveLength(SEEDED + 5);
  });

  it('shows a request that was not accepted, or whose status it does not know, under All only', async () => {
    const requests = await withEveryStatus();

    for (const filter of ['active', 'completed', 'cancelled'] as const) {
      const shown = ids(await requests.listRequests(filter, { page: 1, pageSize: 50 }));
      expect(shown).not.toContain('REQ-24102');
      expect(shown).not.toContain('REQ-24104');
    }
    const all = ids(await requests.listRequests('all', { page: 1, pageSize: 50 }));
    expect(all).toEqual(expect.arrayContaining(['REQ-24102', 'REQ-24104']));
  });

  it('pages a view by its own count', async () => {
    const requests = await withEveryStatus();

    const first = await requests.listRequests('active', { page: 1, pageSize: 5 });
    const second = await requests.listRequests('active', { page: 2, pageSize: 5 });

    expect(first).toMatchObject({ total: 7, hasMore: true });
    expect(second).toMatchObject({ total: 7, hasMore: false });
    expect(second.items).toHaveLength(2);
  });

  it('lists a request raised before a restart, first, and once', async () => {
    const launch = () =>
      new MockRequestService({
        latency: NO_LATENCY,
        history: new AsyncStorageMockRequestHistory(),
        currentCustomerId: async () => CUSTOMER,
      });

    const created = await launch().createRequest(INPUT);
    const after = launch();

    const first = await after.listRequests('all', { page: 1, pageSize: 3 });
    const again = await after.listRequests('all', { page: 1, pageSize: 3 });
    const everything = ids(await after.listRequests('all', { page: 1, pageSize: 50 }));

    expect(ids(first)[0]).toBe(created.id);
    expect(again).toEqual(first);
    expect(everything.filter(id => id === created.id)).toHaveLength(1);
    // Waiting on the professional it was sent to: active, and still active.
    expect(ids(await after.listRequests('active', { page: 1, pageSize: 3 }))[0]).toBe(created.id);
  });

  it('lists one customer none of another customer’s requests', async () => {
    const mine = new MockRequestService({
      latency: NO_LATENCY,
      history: new AsyncStorageMockRequestHistory(),
      currentCustomerId: async () => CUSTOMER,
    });
    const created = await mine.createRequest(INPUT);

    const theirs = new MockRequestService({
      latency: NO_LATENCY,
      history: new AsyncStorageMockRequestHistory(),
      currentCustomerId: async () => 'usr_customer_2',
    });

    expect(ids(await theirs.listRequests('all', { page: 1, pageSize: 50 }))).not.toContain(
      created.id,
    );
  });
});

/**
 * Cancelling (owner decision, 21/10/2026): a customer may cancel a request only
 * while no professional has accepted it. The mock stands for the backend's
 * rule, so it refuses everything later — which is how the race with a
 * professional accepting it is answered — and enforces whose request it is,
 * whatever the screens offer.
 */
describe('MockRequestService — cancelling', () => {
  const CUSTOMER = 'usr_customer_1';
  const HISTORY_KEY = `${AppConfig.storage.mockRequestHistoryKey}/${CUSTOMER}`;

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  /** A service the way the app builds one: device storage, and whoever is signed in. */
  function launch(customer: () => Promise<string | null> = async () => CUSTOMER) {
    return new MockRequestService({
      latency: NO_LATENCY,
      history: new AsyncStorageMockRequestHistory(),
      currentCustomerId: customer,
    });
  }

  /** A table holding one request per status given, as a restart would restore them. */
  async function withStatuses(statuses: string[]) {
    const history = new AsyncStorageMockRequestHistory();
    const base = (await service().getRequest('REQ-24048'))!;
    const references = statuses.map((_, index) => `REQ-${24101 + index}`);

    for (const [index, status] of statuses.entries()) {
      await history.save(CUSTOMER, {
        ...base,
        id: references[index],
        status,
        createdAt: new Date().toISOString(),
      });
    }

    return { requests: launch(), references };
  }

  it('cancels a request that is received or waiting for a professional, either way it was sent', async () => {
    const requests = service();
    const created = await requests.createRequest(INPUT);

    // Received; waiting on a chosen professional; open to anybody; just raised.
    for (const id of ['REQ-24079', 'REQ-24081', 'REQ-24070', created.id]) {
      const before = await requests.getRequest(id);
      const result = await requests.cancelRequest(id);

      expect(result).toEqual({ outcome: 'cancelled', request: { ...before, status: 'CANCELLED' } });
      expect((await requests.getRequest(id))?.status).toBe('CANCELLED');
    }
  });

  it('forgives the case and padding of a waiting status, as the screens do', async () => {
    const { requests, references } = await withStatuses([' pending_vendor ', 'Created']);

    for (const id of references) {
      await expect(requests.cancelRequest(id)).resolves.toMatchObject({ outcome: 'cancelled' });
    }
  });

  it('refuses once a professional has it, or it is over, and changes nothing', async () => {
    const { requests, references } = await withStatuses(['REJECTED', 'ON_HOLD', 'ESCALATED_TO_REGION']);

    // Accepted, in progress, completed and closed from the seed; not accepted,
    // on hold and a status section 21 does not name from the device.
    for (const id of ['REQ-24063', 'REQ-24076', 'REQ-24048', 'REQ-24012', ...references]) {
      const before = await requests.getRequest(id);

      await expect(requests.cancelRequest(id)).resolves.toEqual({
        outcome: 'refused',
        reason: 'notCancellable',
      });
      expect(await requests.getRequest(id)).toEqual(before);
    }
    // Nothing written for a refusal.
    const saved = JSON.parse((await AsyncStorage.getItem(HISTORY_KEY)) ?? '{}').requests;
    expect(saved.map((record: { status: string }) => record.status)).toEqual([
      'REJECTED',
      'ON_HOLD',
      'ESCALATED_TO_REGION',
    ]);
  });

  it('answers a request already cancelled as cancelled, unchanged and not saved again', async () => {
    const history = new AsyncStorageMockRequestHistory();
    const save = jest.spyOn(history, 'save');
    const requests = new MockRequestService({
      latency: NO_LATENCY,
      history,
      currentCustomerId: async () => CUSTOMER,
    });
    const created = await requests.createRequest(INPUT);
    await requests.cancelRequest(created.id);
    save.mockClear();

    // A cancellation sent again after its first answer was lost.
    for (const id of [created.id, 'REQ-24020']) {
      const before = await requests.getRequest(id);

      await expect(requests.cancelRequest(id)).resolves.toEqual({ outcome: 'cancelled', request: before });
    }
    expect(save).not.toHaveBeenCalled();
  });

  it('cancels once when two cancellations arrive together', async () => {
    const history = new AsyncStorageMockRequestHistory();
    const save = jest.spyOn(history, 'save');
    const requests = new MockRequestService({
      latency: NO_LATENCY,
      history,
      currentCustomerId: async () => CUSTOMER,
    });
    const created = await requests.createRequest(INPUT);
    save.mockClear();

    const [first, second] = await Promise.all([
      requests.cancelRequest(created.id),
      requests.cancelRequest(created.id),
    ]);

    expect(first.outcome).toBe('cancelled');
    expect(second.outcome).toBe('cancelled');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('keeps the request where it was in the order, and moves it to the Cancelled view', async () => {
    const requests = service();
    const order = async () => (await requests.listRecentRequests(50)).map(summary => summary.id);
    const view = async (filter: 'active' | 'cancelled') =>
      (await requests.listRequests(filter, { page: 1, pageSize: 50 })).items.map(item => item.id);
    const before = await order();

    await requests.cancelRequest('REQ-24081');

    expect(await order()).toEqual(before);
    expect(await view('cancelled')).toEqual(['REQ-24081', 'REQ-24020']);
    expect(await view('active')).not.toContain('REQ-24081');
  });

  it('answers a reference it does not hold as not found, and changes nothing', async () => {
    const requests = service();

    await expect(requests.cancelRequest('REQ-00000')).rejects.toMatchObject({ kind: 'notFound' });
    await expect(requests.cancelRequest('REQ-00000')).rejects.toBeInstanceOf(AppError);
  });

  it('never cancels another customer’s request, nor says it exists', async () => {
    let signedIn: string | null = CUSTOMER;
    const requests = launch(async () => signedIn);
    const mine = await requests.createRequest(INPUT);

    signedIn = 'usr_customer_2';
    await expect(requests.cancelRequest(mine.id)).rejects.toMatchObject({ kind: 'notFound' });
    await expect(launch(async () => 'usr_customer_2').cancelRequest(mine.id)).rejects.toMatchObject({
      kind: 'notFound',
    });

    // Still waiting, for the customer who raised it — here and after a restart.
    signedIn = CUSTOMER;
    expect((await requests.getRequest(mine.id))?.status).toBe('PENDING_VENDOR');
    expect((await launch().getRequest(mine.id))?.status).toBe('PENDING_VENDOR');
  });

  it('refuses anybody who is not a signed-in customer, and changes nothing', async () => {
    const nobody = launch(async () => null);
    const unknown = launch(async () => {
      throw new Error('session unreadable');
    });

    for (const requests of [nobody, unknown]) {
      await expect(requests.cancelRequest('REQ-24081')).rejects.toMatchObject({
        kind: 'unauthorized',
      });
      expect((await requests.getRequest('REQ-24081'))?.status).toBe('PENDING_VENDOR');
    }
  });

  it('refuses when the customer changes while it is in the air, and changes nothing', async () => {
    let signedIn: string | null = CUSTOMER;
    const requests = new MockRequestService({
      latency: { minLatencyMs: 20, maxLatencyMs: 20 },
      history: new AsyncStorageMockRequestHistory(),
      currentCustomerId: async () => signedIn,
    });
    const mine = await requests.createRequest(INPUT);

    const sent = requests.cancelRequest(mine.id);
    // Signed out and somebody else in, whose first read starts their table.
    signedIn = 'usr_customer_2';
    const theirs = requests.listRecentRequests(3);

    await expect(sent).rejects.toMatchObject({ kind: 'unauthorized' });
    await theirs;

    signedIn = CUSTOMER;
    expect((await requests.getRequest(mine.id))?.status).toBe('PENDING_VENDOR');
  });

  it('keeps a cancellation the customer made across a restart, saved once', async () => {
    const created = await launch().createRequest(INPUT);
    await launch().cancelRequest(created.id);

    const after = launch();

    expect((await after.getRequest(created.id))?.status).toBe('CANCELLED');
    const saved = JSON.parse((await AsyncStorage.getItem(HISTORY_KEY)) ?? '{}').requests;
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe('CANCELLED');
    // The status and nothing more: no time of cancelling, no reason, nothing derived.
    expect(Object.keys(saved[0]).sort()).toEqual([
      'address',
      'categoryId',
      'categoryName',
      'createdAt',
      'id',
      'imageUrls',
      'notes',
      'preferredDate',
      'preferredTime',
      'preferredVendor',
      'priority',
      'serviceName',
      'status',
      'subCategoryId',
    ]);
  });

  it('keeps a seeded request’s cancellation for this table only — the seed is never saved', async () => {
    const requests = launch();

    await requests.cancelRequest('REQ-24079');

    expect((await requests.getRequest('REQ-24079'))?.status).toBe('CANCELLED');
    expect(await AsyncStorage.getItem(HISTORY_KEY)).toBeNull();
    expect((await launch().getRequest('REQ-24079'))?.status).toBe('CREATED');
  });

  it('still cancels when saving fails, for this session only', async () => {
    const device = new AsyncStorageMockRequestHistory();
    const created = await launch().createRequest(INPUT);
    const failing = new MockRequestService({
      latency: NO_LATENCY,
      history: { read: customerId => device.read(customerId), save: async () => false },
      currentCustomerId: async () => CUSTOMER,
    });

    await expect(failing.cancelRequest(created.id)).resolves.toMatchObject({ outcome: 'cancelled' });
    expect((await failing.getRequest(created.id))?.status).toBe('CANCELLED');
    expect((await launch().getRequest(created.id))?.status).toBe('PENDING_VENDOR');
  });

  it('cannot be edited through the record it answers with', async () => {
    const requests = service();

    const result = await requests.cancelRequest('REQ-24081');
    if (result.outcome !== 'cancelled') {
      throw new Error('expected a cancellation');
    }
    result.request.status = 'PENDING_VENDOR';
    result.request.address.formattedAddress = 'Somewhere else entirely';

    const again = await requests.getRequest('REQ-24081');
    expect(again?.status).toBe('CANCELLED');
    expect(again?.address.formattedAddress).not.toBe('Somewhere else entirely');
  });
});

/**
 * A request the customer raised has to still be there when they come back, and
 * be exactly what it was: the same reference, the same status, the same address.
 * "Launching" here is what the app does on startup — a new service over the
 * same device storage, with a customer signed in.
 */
describe('MockRequestService — after a restart', () => {
  const CUSTOMER = 'usr_customer_1';
  const HISTORY_KEY = `${AppConfig.storage.mockRequestHistoryKey}/${CUSTOMER}`;

  /** How many requests the seed holds, which a launch with no history shows. */
  const SEEDED = 8;

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** A service the way the app builds one: device storage, and a customer signed in. */
  function launch({
    customer = async (): Promise<string | null> => CUSTOMER,
    history = new AsyncStorageMockRequestHistory(),
  }: {
    customer?: () => Promise<string | null>;
    history?: MockRequestHistoryStorage;
  } = {}) {
    return new MockRequestService({ latency: NO_LATENCY, history, currentCustomerId: customer });
  }

  it('keeps a created request, exactly as it was', async () => {
    const before = launch();
    const created = await before.createRequest(INPUT);
    const original = await before.getRequest(created.id);

    const after = launch();

    expect(original).not.toBeNull();
    expect(await after.getRequest(created.id)).toEqual(original);
  });

  it('lists it first, as the newest request', async () => {
    const created = await launch().createRequest(INPUT);

    const [newest] = await launch().listRecentRequests(3);

    expect(newest.id).toBe(created.id);
  });

  it('keeps a saved request above the seed, however long ago it was raised', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-11T09:00:00.000Z') });
    const created = await launch().createRequest(INPUT);

    // Three days later. A seed re-dated to "35 minutes ago" would now sit above
    // the customer's own request and push it off Home's short list.
    jest.setSystemTime(new Date('2026-09-14T09:00:00.000Z'));
    const after = launch();
    const listed = await after.listRecentRequests(50);

    expect(listed[0].id).toBe(created.id);
    for (const seeded of listed.slice(1)) {
      expect(Date.parse(seeded.createdAt)).toBeLessThan(Date.parse(created.createdAt));
    }
    // The seed keeps its own order among itself.
    expect(listed.slice(1, 4).map(summary => summary.id)).toEqual([
      'REQ-24081',
      'REQ-24079',
      'REQ-24076',
    ]);
  });

  it('keeps newest first by when they were raised, not by where storage keeps them', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-11T09:00:00.000Z') });
    const before = launch();
    const older = await before.createRequest(INPUT);

    jest.setSystemTime(new Date('2026-09-11T09:01:00.000Z'));
    const newer = await before.createRequest({ ...INPUT, vendorId: undefined });

    // Saved again, so the device now holds the older request after the newer.
    const olderRecord = await before.getRequest(older.id);
    await new AsyncStorageMockRequestHistory().save(CUSTOMER, olderRecord!);

    jest.setSystemTime(new Date('2026-09-11T09:02:00.000Z'));
    const ids = (await launch().listRecentRequests(3)).map(summary => summary.id);

    expect(ids).toEqual([newer.id, older.id, 'REQ-24081']);
  });

  it('lists a request once, however often it is read, refreshed or relaunched', async () => {
    const created = await launch().createRequest(INPUT);

    await launch().listRecentRequests(3);
    const after = launch();
    for (let pull = 0; pull < 3; pull += 1) {
      await after.listRecentRequests(3);
    }
    await after.getRequest(created.id);

    const everything = (await after.listRecentRequests(50)).map(summary => summary.id);

    expect(everything.filter(id => id === created.id)).toHaveLength(1);
    expect(everything).toHaveLength(SEEDED + 1);
    expect(new Set(everything).size).toBe(everything.length);
    // And the device holds it once.
    expect(JSON.parse((await AsyncStorage.getItem(HISTORY_KEY)) ?? '{}').requests).toHaveLength(1);
  });

  it('reopens with the status it had — nothing moves while the app is closed', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-11T09:00:00.000Z') });
    const created = await launch().createRequest({ ...INPUT, vendorId: undefined });

    // Three days later.
    jest.setSystemTime(new Date('2026-09-14T09:00:00.000Z'));
    const record = await launch().getRequest(created.id);

    expect(record?.status).toBe('PENDING_VENDOR');
    expect(record?.createdAt).toBe(created.createdAt);
    // And the stage is derived again from it, the same as before.
    expect(requestStateOf(record!.status, 'open')).toBe('searching');
  });

  it('saves nothing for a request that was refused', async () => {
    const history = new AsyncStorageMockRequestHistory();
    const save = jest.spyOn(history, 'save');

    await expect(
      launch({ history }).createRequest({ ...INPUT, subCategoryId: 'sub_does_not_exist' }),
    ).rejects.toMatchObject({ kind: 'validation' });

    expect(save).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(await launch().listRecentRequests(50)).toHaveLength(SEEDED);
  });

  it('saves a request once it is accepted, under the customer who raised it', async () => {
    const history = new AsyncStorageMockRequestHistory();
    const save = jest.spyOn(history, 'save');

    const created = await launch({ history }).createRequest(INPUT);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      CUSTOMER,
      expect.objectContaining({ id: created.id, status: created.status }),
    );
  });

  it('never hands out a reference an earlier request holds', async () => {
    const before = launch();
    const first = await before.createRequest(INPUT);
    const second = await before.createRequest(INPUT);

    const third = await launch().createRequest(INPUT);

    expect([first.id, second.id, third.id]).toEqual(['REQ-24083', 'REQ-24084', 'REQ-24085']);
    const ids = (await launch().listRecentRequests(50)).map(summary => summary.id);
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id, third.id]));
    expect(ids).toHaveLength(SEEDED + 3);
  });

  it('reads the device once for calls that arrive together', async () => {
    const created = await launch().createRequest(INPUT);

    const history = new AsyncStorageMockRequestHistory();
    const read = jest.spyOn(history, 'read');
    const after = launch({ history });

    await Promise.all([
      after.listRecentRequests(3),
      after.listRecentRequests(3),
      after.getRequest(created.id),
    ]);
    await after.listRecentRequests(3);

    expect(read).toHaveBeenCalledTimes(1);
  });

  it('shows one customer none of another customer’s requests', async () => {
    const created = await launch().createRequest(INPUT);

    const someoneElse = launch({ customer: async () => 'usr_customer_2' });

    await expect(someoneElse.getRequest(created.id)).resolves.toBeNull();
    expect((await someoneElse.listRecentRequests(50)).map(summary => summary.id)).not.toContain(
      created.id,
    );
  });

  it('changes whose requests it holds when a different customer signs in', async () => {
    let signedIn: string | null = CUSTOMER;
    const requests = launch({ customer: async () => signedIn });
    const mine = await requests.createRequest(INPUT);

    signedIn = 'usr_customer_2';
    await expect(requests.getRequest(mine.id)).resolves.toBeNull();

    signedIn = CUSTOMER;
    await expect(requests.getRequest(mine.id)).resolves.toMatchObject({ id: mine.id });
  });

  it('keeps a request raised with nobody signed in for this session only', async () => {
    const requests = launch({ customer: async () => null });
    const created = await requests.createRequest(INPUT);

    await expect(requests.getRequest(created.id)).resolves.toMatchObject({ id: created.id });
    await expect(launch({ customer: async () => null }).getRequest(created.id)).resolves.toBeNull();
    await expect(launch().getRequest(created.id)).resolves.toBeNull();
  });

  it('still creates the request when saving it fails, and keeps it for this session', async () => {
    const device = new AsyncStorageMockRequestHistory();
    const failing: MockRequestHistoryStorage = {
      read: customerId => device.read(customerId),
      save: async () => false,
    };
    const requests = launch({ history: failing });

    const created = await requests.createRequest(INPUT);

    expect(created.status).toBe('PENDING_VENDOR');
    await expect(requests.getRequest(created.id)).resolves.toMatchObject({ id: created.id });
    // Not claimed as kept: after a restart it is gone.
    await expect(launch().getRequest(created.id)).resolves.toBeNull();
  });

  it('survives storage that throws, though it promised not to', async () => {
    const broken: MockRequestHistoryStorage = {
      read: async () => {
        throw new Error('storage unavailable');
      },
      save: async () => {
        throw new Error('storage unavailable');
      },
    };
    const requests = launch({ history: broken });

    expect(await requests.listRecentRequests(50)).toHaveLength(SEEDED);
    const created = await requests.createRequest(INPUT);
    await expect(requests.getRequest(created.id)).resolves.toMatchObject({ id: created.id });
  });

  it('works from memory when it cannot tell who is asking', async () => {
    const requests = launch({
      customer: async () => {
        throw new Error('session unreadable');
      },
    });

    expect(await requests.listRecentRequests(50)).toHaveLength(SEEDED);
    const created = await requests.createRequest(INPUT);
    await expect(requests.getRequest(created.id)).resolves.toMatchObject({ id: created.id });
    expect(await AsyncStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it('keeps the request on the device, and nothing a screen derives from it', async () => {
    const created = await launch().createRequest(INPUT);

    const raw = (await AsyncStorage.getItem(HISTORY_KEY)) ?? '';
    const [saved] = JSON.parse(raw).requests;

    expect(saved.id).toBe(created.id);
    expect(saved.status).toBe('PENDING_VENDOR');
    expect(Object.keys(saved).sort()).toEqual([
      'address',
      'categoryId',
      'categoryName',
      'createdAt',
      'id',
      'imageUrls',
      'notes',
      'preferredDate',
      'preferredTime',
      'preferredVendor',
      'priority',
      'serviceName',
      'status',
      'subCategoryId',
    ]);
    for (const words of Object.values(CUSTOMER_COPY.requestStatus)) {
      if (typeof words === 'object') {
        expect(raw).not.toContain(words.title);
      }
    }
  });
});
