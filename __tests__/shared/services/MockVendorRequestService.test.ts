/**
 * The mock vendor request list (PROJECT_BIBLE.md sections 31 and 32, Phase 3E-3).
 *
 * It stands in for a backend, so what is pinned here is the backend's side:
 *
 * - every state a list must draw is reachable: nothing, only waiting, only
 *   under way, only finished, and all three
 * - it is the same work the dashboard counts, whole rather than previewed
 * - the answer is deterministic, and statuses pass through untouched — including
 *   one nobody has heard of
 * - it is scoped to the signed-in vendor: another vendor's list is their own,
 *   and another vendor's request cannot be opened
 * - it refuses without a vendor, and a customer is not a vendor
 * - neither the list nor a request carries an address, a phone or a photograph
 */

import type { AuthUser } from '@/features/auth/types';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import {
  buildMockVendorWork,
  type MockDashboardScenario,
  type MockVendorWork,
} from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { AppError } from '@/shared/types/error';

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const MEENA: AuthUser = { ...RAVI, id: 'usr_vendor_2', firstName: 'Meena', phone: '9000000002' };

const ASHA: AuthUser = { ...RAVI, id: 'usr_customer_1', firstName: 'Asha', role: 'customer' };

/** Noon on a fixed day, so every age on every card is a known number. */
const NOW = new Date('2026-09-30T12:00:00.000Z').getTime();

const EMPTY = { pending: [], active: [], completed: [], rejected: [] };

let user: AuthUser | null;

function service(
  scenario?: MockDashboardScenario,
  workFor?: (vendorId: string, nowMs: number) => MockVendorWork,
) {
  return new MockVendorRequestService({
    latency: NO_LATENCY,
    currentUser: async () => user,
    now: () => NOW,
    ...(scenario ? { scenarioFor: () => scenario } : {}),
    ...(workFor ? { workFor } : {}),
  });
}

async function kindOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (caught) {
    return AppError.from(caught).kind;
  }
  return 'resolved';
}

beforeEach(() => {
  user = RAVI;
});

describe('MockVendorRequestService — the states a list must draw', () => {
  it('answers a vendor with no requests with four empty lists, not an error', async () => {
    await expect(service('empty').listRequests()).resolves.toEqual(EMPTY);
  });

  it('can hold only waiting requests', async () => {
    const list = await service('pendingOnly').listRequests();

    expect(list.pending).toHaveLength(4);
    expect(list.active).toEqual([]);
    expect(list.completed).toEqual([]);
  });

  it('can hold only work under way', async () => {
    const list = await service('activeOnly').listRequests();

    expect(list.pending).toEqual([]);
    expect(list.active.map(job => job.status)).toEqual(['IN_PROGRESS', 'ACCEPTED']);
    expect(list.completed).toEqual([]);
  });

  it('can hold only finished work', async () => {
    const list = await service('completedOnly').listRequests();

    expect(list.pending).toEqual([]);
    expect(list.active).toEqual([]);
    expect(list.completed).toHaveLength(5);
    expect(list.completed.every(job => job.completedAt !== undefined)).toBe(true);
  });

  it('holds all three at once, whole rather than previewed', async () => {
    const list = await service('mixed').listRequests();

    expect(list.pending).toHaveLength(4);
    expect(list.active).toHaveLength(2);
    expect(list.completed).toHaveLength(5);
    // Nothing has been declined yet: the fixtures hold no history (2026-10-21).
    expect(list.rejected).toEqual([]);
  });
});

describe('MockVendorRequestService — the same work the dashboard counts', () => {
  it('lists exactly as many of each as the dashboard says there are', async () => {
    const dashboard = await new MockVendorDashboardService({
      latency: NO_LATENCY,
      currentUser: async () => user,
      now: () => NOW,
    }).getDashboard(3);
    const list = await service().listRequests();

    expect(list.pending).toHaveLength(dashboard.counts.pending);
    expect(list.active).toHaveLength(dashboard.counts.active);
    expect(list.completed).toHaveLength(dashboard.counts.completed);
  });

  it('starts each group with the very requests the dashboard previews', async () => {
    const dashboard = await new MockVendorDashboardService({
      latency: NO_LATENCY,
      currentUser: async () => user,
      now: () => NOW,
    }).getDashboard(3);
    const list = await service().listRequests();

    expect(list.pending.slice(0, 3)).toEqual(dashboard.pending);
    expect(list.active.slice(0, 3)).toEqual(dashboard.active);
    expect(list.completed.slice(0, 3)).toEqual(dashboard.recentlyCompleted);
  });
});

describe('MockVendorRequestService — deterministic', () => {
  it('gives the same answer every time for the same vendor and clock', async () => {
    const first = await service('mixed').listRequests();
    const second = await service('mixed').listRequests();

    expect(second).toEqual(first);
  });

  it('lists waiting requests newest first and finished work latest first', async () => {
    const list = await service('mixed').listRequests();

    const raised = list.pending.map(job => Date.parse(job.createdAt));
    expect(raised).toEqual([...raised].sort((a, b) => b - a));

    const finished = list.completed.map(job => Date.parse(job.completedAt ?? ''));
    expect(finished).toEqual([...finished].sort((a, b) => b - a));
  });

  it('hands back fresh objects, so a caller cannot edit the fixtures', async () => {
    const requests = service('mixed');
    const first = await requests.listRequests();
    first.pending[0].serviceName = 'changed';
    first.pending.length = 0;

    const second = await requests.listRequests();
    expect(second.pending).toHaveLength(4);
    expect(second.pending[0].serviceName).not.toBe('changed');
  });

  it('passes a status it has never heard of straight through, and does not fall over', async () => {
    const odd = (_vendorId: string, nowMs: number): MockVendorWork => {
      const work = buildMockVendorWork('activeOnly', nowMs);
      work.active[0].status = 'AWAITING_PARTS';
      return work;
    };

    const list = await service(undefined, odd).listRequests();
    expect(list.active[0].status).toBe('AWAITING_PARTS');

    const opened = await service(undefined, odd).getRequest(list.active[0].id);
    expect(opened.status).toBe('AWAITING_PARTS');
  });
});

describe('MockVendorRequestService — one request', () => {
  it('opens a request as its summary with a category and the customer’s description', async () => {
    const list = await service('mixed').listRequests();
    const opened = await service('mixed').getRequest('REQ-31042');
    // Waiting, so not the vendor's yet: the summary less the customer's name (21/10/2026).
    const summary = { ...list.pending[0] };
    delete summary.customerName;

    expect(opened).toMatchObject(summary);
    expect(opened.categoryName).toBe('Electrician');
    expect(opened.description).toContain('switchboard');
  });

  it('opens a request the customer wrote nothing about, without a description', async () => {
    const opened = await service('mixed').getRequest('REQ-30987');

    expect(opened.serviceName).toBe('Light fitting replacement');
    expect(opened.description).toBeUndefined();
  });

  it('forgives padding around the reference', async () => {
    await expect(service('mixed').getRequest('  REQ-31042 ')).resolves.toMatchObject({
      id: 'REQ-31042',
    });
  });

  it('says a reference that does not exist was not found', async () => {
    expect(await kindOf(() => service('mixed').getRequest('REQ-0'))).toBe('notFound');
  });

  /*
    The list is glanced at in public and cached more freely: it never carries
    where the customer lives, how to reach them or their photographs, whatever
    the vendor holds. What a request's details carry is pinned in
    MockVendorRequestPrivacy.test.ts (owner decision, 21/10/2026).
  */
  it('never carries an address, a phone number or a photograph on the list', async () => {
    const list = await service('mixed').listRequests();
    const forbidden = ['address', 'formattedAddress', 'phone', 'customerPhone', 'imageUrls', 'email'];

    for (const record of [...list.pending, ...list.active, ...list.completed, ...list.rejected]) {
      for (const key of forbidden) {
        expect(Object.keys(record)).not.toContain(key);
      }
    }
  });
});

describe('MockVendorRequestService — whose requests', () => {
  it('never shows one vendor another vendor’s requests', async () => {
    // The default table, one service instance, as the running app has it.
    const requests = service();

    const ravi = await requests.listRequests();
    expect(ravi.pending).toHaveLength(4);

    // Only what was sent to everybody (3E-4): Ravi's direct request, his work
    // under way and his finished work are his alone.
    user = MEENA;
    const meena = await requests.listRequests();
    expect(meena.pending.map(job => job.id)).toEqual(['REQ-31042', 'REQ-2026-BLR-EAST-0031021']);
    expect(meena.active).toEqual([]);
    expect(meena.completed).toEqual([]);

    user = RAVI;
    await expect(requests.listRequests()).resolves.toEqual(ravi);
  });

  it('will not open another vendor’s request, and does not admit it exists', async () => {
    const requests = service();
    // The customer chose Ravi for this one; nobody else was sent it.
    await expect(requests.getRequest('REQ-31038')).resolves.toMatchObject({ id: 'REQ-31038' });
    await expect(requests.getRequest('REQ-30954')).resolves.toMatchObject({ id: 'REQ-30954' });

    user = MEENA;
    expect(await kindOf(() => requests.getRequest('REQ-31038'))).toBe('notFound');
    expect(await kindOf(() => requests.getRequest('REQ-30954'))).toBe('notFound');
  });

  it('refuses when nobody is signed in', async () => {
    user = null;

    expect(await kindOf(() => service('mixed').listRequests())).toBe('unauthorized');
    expect(await kindOf(() => service('mixed').getRequest('REQ-31042'))).toBe('unauthorized');
  });

  it('refuses a customer', async () => {
    user = ASHA;

    expect(await kindOf(() => service('mixed').listRequests())).toBe('unauthorized');
    expect(await kindOf(() => service('mixed').getRequest('REQ-31042'))).toBe('unauthorized');
  });
});
