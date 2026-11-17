/**
 * What a request's details tell a vendor, on the mock backend
 * (PROJECT_BIBLE.md section 32; owner decision, 21/10/2026).
 *
 * It stands in for a backend, so what is pinned here is the half of the
 * privacy rule a backend must keep whatever the screen draws:
 *
 * - before the vendor holds the work — waiting for their answer, or declined
 *   by them — the record carries the service, its category, what the customer
 *   said, the photographs, the preferred date and time, and the area; the
 *   customer's name, phone and full address are absent, not blanked, and
 *   nowhere in the serialised record
 * - once they hold it — accepted (on the answer itself and every read after),
 *   in progress, finished — the name, the phone and the full address are there
 * - another vendor still waiting on an open request is told no more than before
 * - the preferred date is a calendar date against the service's clock
 * - a request the customer added nothing to has no empty fields for it
 * - an answer is a copy: editing it does not edit the record
 * - the list never carries the phone, the address or the photographs at all
 * - the cards keep the same rule (owner decision, 21/10/2026): waiting and
 *   declined summaries — on the list and the dashboard — carry no customer
 *   name; held ones still do
 */

import type { AuthUser } from '@/features/auth/types';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorRequestBook } from '@/shared/services/mock/MockVendorRequestBook';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import type { MockDashboardScenario } from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};
const MEENA: AuthUser = { ...RAVI, id: 'usr_vendor_2', firstName: 'Meena', phone: '9000000002' };

/** Open, waiting for Ravi and Meena; its customer, their phone and their street. */
const OPEN = 'REQ-31042';
const OPEN_CUSTOMER = 'Asha Patel';
const OPEN_PHONE = '9000031042';
const OPEN_STREET = '14, 3rd Cross';
/** Directed to Ravi, waiting. */
const DIRECTED = 'REQ-31038';
/** Waiting, and the customer added nothing. */
const PLAIN = 'REQ-30987';
const IN_PROGRESS = 'REQ-30954';
const ACCEPTED = 'REQ-30961';
const FINISHED = 'REQ-30912';

/** Half past eleven at night, local: a UTC date would already be tomorrow east of Greenwich. */
const NOW = new Date(2026, 9, 21, 23, 30).getTime();

let book: MockVendorRequestBook;

function as(vendor: AuthUser) {
  const scenarios: Record<string, MockDashboardScenario> = {
    [RAVI.id]: 'mixed',
    [MEENA.id]: 'openOnly',
  };
  return new MockVendorRequestService({
    latency: NO_LATENCY,
    currentUser: async () => vendor,
    scenarioFor: vendorId => scenarios[vendorId] ?? 'empty',
    now: () => NOW,
    book,
  });
}

beforeEach(() => {
  book = new MockVendorRequestBook();
});

/** None of the three, as keys or anywhere in the record. */
function expectNothingOfTheCustomer(record: object, values: string[]) {
  for (const key of ['customerName', 'customerPhone', 'address']) {
    expect(key in record).toBe(false);
  }
  const serialised = JSON.stringify(record);
  for (const value of values) {
    expect(serialised).not.toContain(value);
  }
}

describe('Before the vendor holds the work', () => {
  it('tells them the job and the area — exactly these keys, and nothing of the customer', async () => {
    const opened = await as(RAVI).getRequest(OPEN);

    expect(Object.keys(opened).sort()).toEqual(
      [
        'categoryName',
        'createdAt',
        'description',
        'dispatch',
        'id',
        'imageUrls',
        'locality',
        'preferredDate',
        'priority',
        'serviceName',
        'status',
      ].sort(),
    );
    expect(opened.locality).toBe('Koramangala');
    expect(opened.imageUrls).toHaveLength(2);
    expectNothingOfTheCustomer(opened, [OPEN_CUSTOMER, OPEN_PHONE, OPEN_STREET, '560095']);
  });

  it('withholds the same from a request directed to them', async () => {
    const opened = await as(RAVI).getRequest(DIRECTED);

    expect(opened.preferredTime).toBe('10:00');
    expectNothingOfTheCustomer(opened, ['Rahul Menon', '9000031038', 'Sobha Daffodil']);
  });

  it('withholds it from a request they declined — on the answer and every read after', async () => {
    const ravi = as(RAVI);
    const result = await ravi.rejectRequest(OPEN);
    if (result.outcome !== 'rejected') {
      throw new Error('expected the rejection to go through');
    }

    expectNothingOfTheCustomer(result.request, [OPEN_CUSTOMER, OPEN_PHONE, OPEN_STREET]);
    expectNothingOfTheCustomer(await ravi.getRequest(OPEN), [OPEN_CUSTOMER, OPEN_PHONE, OPEN_STREET]);
    // The job itself is still described: what was declined is still known.
    expect((await ravi.getRequest(OPEN)).description).toContain('switchboard');
  });

  it('still withholds it from another vendor when one has declined — and tells them no more', async () => {
    await as(RAVI).rejectRequest(OPEN);

    expectNothingOfTheCustomer(await as(MEENA).getRequest(OPEN), [OPEN_CUSTOMER, OPEN_PHONE]);
  });

  it('gives no empty field for what the customer did not add', async () => {
    const opened = await as(RAVI).getRequest(PLAIN);

    for (const key of ['categoryName', 'description', 'imageUrls', 'preferredDate', 'preferredTime']) {
      expect(key in opened).toBe(false);
    }
    expectNothingOfTheCustomer(opened, ['Neha Sharma', '9000030987', 'Jeevan Bhima Nagar']);
  });
});

describe('Once the vendor holds the work', () => {
  it('tells them who and where on the accept itself', async () => {
    const result = await as(RAVI).acceptRequest(OPEN);
    if (result.outcome !== 'accepted') {
      throw new Error('expected the accept to go through');
    }

    expect(result.request.customerName).toBe(OPEN_CUSTOMER);
    expect(result.request.customerPhone).toBe(OPEN_PHONE);
    expect(result.request.address).toEqual({
      formattedAddress: '14, 3rd Cross, 5th Block, Koramangala, Bengaluru 560095',
      addressLine: '14, 3rd Cross, 5th Block',
      locality: 'Koramangala, Bengaluru',
      postalCode: '560095',
      latitude: 12.9352,
      longitude: 77.6245,
    });
    // The rest of the job is unchanged by accepting.
    expect(result.request.imageUrls).toHaveLength(2);
  });

  it('keeps telling them on every read after the accept — the address appears on re-read', async () => {
    const ravi = as(RAVI);
    expect('address' in (await ravi.getRequest(OPEN))).toBe(false);

    await ravi.acceptRequest(OPEN);
    const opened = await ravi.getRequest(OPEN);

    expect(opened.customerName).toBe(OPEN_CUSTOMER);
    expect(opened.customerPhone).toBe(OPEN_PHONE);
    expect(opened.address?.formattedAddress).toContain(OPEN_STREET);
  });

  it.each([
    ['accepted', ACCEPTED, 'Divya Rao', '9000030961'],
    ['in progress', IN_PROGRESS, 'Imran Sheikh', '9000030954'],
    ['finished', FINISHED, 'Karthik Iyer', '9000030912'],
  ])('tells them on work that is %s', async (_state, reference, name, phone) => {
    const opened = await as(RAVI).getRequest(reference);

    expect(opened.customerName).toBe(name);
    expect(opened.customerPhone).toBe(phone);
    expect(opened.address?.formattedAddress).toEqual(expect.any(String));
  });

  it('carries the work forward when it is started and completed', async () => {
    const ravi = as(RAVI);
    const started = await ravi.startRequest(ACCEPTED);
    expect(started.outcome === 'started' && started.request.customerPhone).toBe('9000030961');

    const completed = await ravi.completeRequest(ACCEPTED, {
      finalAmountMinor: 50_000,
      currency: 'INR',
      paymentStatus: 'UNPAID',
    });
    expect(completed.outcome === 'completed' && completed.request.address?.formattedAddress).toContain(
      'Koramangala',
    );
  });

  it('never lets the other vendor see what the winner now sees', async () => {
    await as(RAVI).acceptRequest(OPEN);

    await expect(as(MEENA).getRequest(OPEN)).rejects.toMatchObject({ kind: 'notFound' });
  });
});

describe('The rest of the record', () => {
  it('turns the preferred day into a calendar date against the service’s clock, in local time', async () => {
    const ravi = as(RAVI);

    expect((await ravi.getRequest(OPEN)).preferredDate).toBe('2026-10-21');
    expect((await ravi.getRequest(DIRECTED)).preferredDate).toBe('2026-10-22');
    expect((await ravi.getRequest(FINISHED)).preferredDate).toBe('2026-10-20');
  });

  it('hands out copies — editing an answer edits nothing the service holds', async () => {
    const ravi = as(RAVI);
    await ravi.acceptRequest(OPEN);
    const first = await ravi.getRequest(OPEN);
    first.imageUrls?.pop();
    if (first.address) {
      first.address.formattedAddress = 'Somewhere else';
    }

    const second = await ravi.getRequest(OPEN);
    expect(second.imageUrls).toHaveLength(2);
    expect(second.address?.formattedAddress).toContain(OPEN_STREET);
  });

  it('never puts a phone, an address or a photograph on the list, held or not', async () => {
    const ravi = as(RAVI);
    await ravi.acceptRequest(OPEN);
    const list = await ravi.listRequests();
    const serialised = JSON.stringify(list);

    for (const value of ['customerPhone', 'address', 'imageUrls', OPEN_PHONE, OPEN_STREET, 'picsum']) {
      expect(serialised).not.toContain(value);
    }
  });
});

describe('The cards keep the rule too', () => {
  it('lists waiting and declined requests without the customer’s name, and held work with it', async () => {
    const ravi = as(RAVI);
    await ravi.rejectRequest(DIRECTED);
    const list = await ravi.listRequests();

    for (const job of [...list.pending, ...list.rejected]) {
      expect('customerName' in job).toBe(false);
    }
    expect(list.pending.find(job => job.id === OPEN)?.locality).toBe('Koramangala');
    expect(list.rejected.map(job => job.id)).toEqual([DIRECTED]);
    for (const job of [...list.active, ...list.completed]) {
      expect(job.customerName).toEqual(expect.any(String));
    }
    const serialised = JSON.stringify([list.pending, list.rejected]);
    for (const name of [OPEN_CUSTOMER, 'Rahul Menon', 'Neha Sharma']) {
      expect(serialised).not.toContain(name);
    }
  });

  it('gives the name back on the card once the vendor accepts', async () => {
    const ravi = as(RAVI);
    await ravi.acceptRequest(OPEN);

    const accepted = (await ravi.listRequests()).active.find(job => job.id === OPEN);
    expect(accepted?.customerName).toBe(OPEN_CUSTOMER);
  });

  it('previews waiting requests on the dashboard without the name, and held work with it', async () => {
    const dashboard = await new MockVendorDashboardService({
      latency: NO_LATENCY,
      currentUser: async () => RAVI,
      scenarioFor: () => 'mixed',
      now: () => NOW,
      book,
    }).getDashboard(10);

    expect(dashboard.pending.length).toBeGreaterThan(0);
    for (const job of dashboard.pending) {
      expect('customerName' in job).toBe(false);
    }
    expect(JSON.stringify(dashboard.pending)).not.toContain(OPEN_CUSTOMER);
    expect(dashboard.active[0].customerName).toEqual(expect.any(String));
  });
});
