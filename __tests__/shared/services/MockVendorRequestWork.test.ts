/**
 * Starting and completing accepted work, on the mock backend
 * (PROJECT_BIBLE.md sections 34 to 36, Phase 3E-5).
 *
 * It stands in for a backend, so what is pinned here is what a backend must
 * enforce whatever the screen shows:
 *
 * - ACCEPTED → IN_PROGRESS → COMPLETED, one step at a time, each answered with
 *   the record as it now stands
 * - every other step is refused `invalidTransition` and changes nothing:
 *   waiting, rejected, already started, already finished, accepted but never
 *   started
 * - somebody else's work, or work somebody else took, does not exist; no
 *   session, or a customer's, is refused
 * - a step that could not be recorded is a failure and changed nothing
 * - the list orders work furthest along first and finished work latest first,
 *   and the dashboard counts what the list shows
 * - one vendor's progress is theirs alone, and the same steps give the same
 *   answers every time
 */

import type { AuthUser } from '@/features/auth/types';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorRequestBook } from '@/shared/services/mock/MockVendorRequestBook';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import type { MockDashboardScenario } from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type { VendorCompletionInput } from '@/shared/services/types/VendorRequestService';
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

const NOW = new Date('2026-10-05T12:00:00.000Z').getTime();

const OPEN = 'REQ-31042';
const DIRECTED = 'REQ-31038';
const PLAIN = 'REQ-30987';
/** In the fixtures: in progress, then accepted. */
const IN_PROGRESS = 'REQ-30954';
const ACCEPTED = 'REQ-30961';
const FINISHED = 'REQ-30912';

const refused = { outcome: 'refused', reason: 'invalidTransition' };

/**
 * A valid completion (sections 36 and 37). What it records is pinned in
 * `MockVendorRequestCompletion.test.ts`; here it only has to pass.
 */
const PAID: VendorCompletionInput = {
  finalAmountMinor: 125_000,
  currency: 'INR',
  paymentStatus: 'PAID',
  paymentMethodId: 'cash',
};

let book: MockVendorRequestBook;
let scenarios: Record<string, MockDashboardScenario>;

function as(vendor: AuthUser | null) {
  return new MockVendorRequestService({
    latency: NO_LATENCY,
    currentUser: async () => vendor,
    now: () => NOW,
    scenarioFor: vendorId => scenarios[vendorId] ?? 'empty',
    book,
  });
}

function dashboardFor(vendor: AuthUser) {
  return new MockVendorDashboardService({
    latency: NO_LATENCY,
    currentUser: async () => vendor,
    now: () => NOW,
    scenarioFor: vendorId => scenarios[vendorId] ?? 'empty',
    book,
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

const idsOf = (jobs: Array<{ id: string }>) => jobs.map(job => job.id);
const statusesOf = (jobs: Array<{ id: string; status: string }>) =>
  jobs.map(job => `${job.id}:${job.status}`);

beforeEach(() => {
  book = new MockVendorRequestBook();
  scenarios = { [RAVI.id]: 'mixed', [MEENA.id]: 'openOnly' };
});

describe('Starting accepted work', () => {
  it('moves it to in progress and answers with the record as it now stands', async () => {
    const result = await as(RAVI).startRequest(ACCEPTED);

    expect(result).toEqual({
      outcome: 'started',
      request: expect.objectContaining({
        id: ACCEPTED,
        serviceName: 'MCB replacement',
        status: 'IN_PROGRESS',
        categoryName: 'Electrician',
      }),
    });
    await expect(as(RAVI).getRequest(ACCEPTED)).resolves.toMatchObject({ status: 'IN_PROGRESS' });
  });

  it('keeps it under active, furthest along first', async () => {
    const ravi = as(RAVI);
    await ravi.acceptRequest(DIRECTED);
    await ravi.startRequest(DIRECTED);

    const { active } = await ravi.listRequests();
    expect(statusesOf(active)).toEqual([
      `${IN_PROGRESS}:IN_PROGRESS`,
      `${DIRECTED}:IN_PROGRESS`,
      `${ACCEPTED}:ACCEPTED`,
    ]);
  });

  it('forgives padding around the reference', async () => {
    await expect(as(RAVI).startRequest(`  ${ACCEPTED} `)).resolves.toMatchObject({ outcome: 'started' });
  });
});

describe('Completing work in progress', () => {
  it('moves it to completed, dated now, and answers with the record', async () => {
    const result = await as(RAVI).completeRequest(IN_PROGRESS, PAID);

    expect(result).toEqual({
      outcome: 'completed',
      request: expect.objectContaining({
        id: IN_PROGRESS,
        status: 'COMPLETED',
        completedAt: new Date(NOW).toISOString(),
      }),
    });
  });

  it('takes it out of active and lists it first among finished work', async () => {
    const ravi = as(RAVI);
    await ravi.completeRequest(IN_PROGRESS, PAID);

    const list = await ravi.listRequests();
    expect(idsOf(list.active)).toEqual([ACCEPTED]);
    expect(list.completed).toHaveLength(6);
    expect(list.completed[0]).toMatchObject({ id: IN_PROGRESS, status: 'COMPLETED' });
  });

  it('lists the latest finished first when several are finished', async () => {
    const ravi = as(RAVI);
    await ravi.completeRequest(IN_PROGRESS, PAID);
    await ravi.startRequest(ACCEPTED);
    await ravi.completeRequest(ACCEPTED, PAID);

    expect(idsOf((await ravi.listRequests()).completed).slice(0, 3)).toEqual([
      ACCEPTED,
      IN_PROGRESS,
      FINISHED,
    ]);
  });

  it('takes a request all the way: waiting → accepted → in progress → completed', async () => {
    const ravi = as(RAVI);

    await expect(ravi.acceptRequest(DIRECTED)).resolves.toMatchObject({ outcome: 'accepted' });
    await expect(ravi.startRequest(DIRECTED)).resolves.toMatchObject({ outcome: 'started' });
    await expect(ravi.completeRequest(DIRECTED, PAID)).resolves.toMatchObject({ outcome: 'completed' });

    await expect(ravi.getRequest(DIRECTED)).resolves.toMatchObject({
      status: 'COMPLETED',
      completedAt: new Date(NOW).toISOString(),
    });
    const list = await ravi.listRequests();
    expect(idsOf(list.pending)).not.toContain(DIRECTED);
    expect(idsOf(list.active)).not.toContain(DIRECTED);
    expect(idsOf(list.completed)[0]).toBe(DIRECTED);
  });
});

describe('Only the next step is allowed', () => {
  it.each([
    ['start a waiting request', 'startRequest', DIRECTED],
    ['complete a waiting request', 'completeRequest', DIRECTED],
    ['complete accepted work that was never started', 'completeRequest', ACCEPTED],
    ['start work already in progress', 'startRequest', IN_PROGRESS],
    ['start finished work', 'startRequest', FINISHED],
    ['complete finished work', 'completeRequest', FINISHED],
  ] as const)('refuses to %s, and changes nothing', async (_name, step, reference) => {
    const ravi = as(RAVI);
    const before = await ravi.listRequests();
    // Completing carries a (valid) record; the refusal is about the status alone.
    const take = () =>
      step === 'completeRequest' ? ravi.completeRequest(reference, PAID) : ravi.startRequest(reference);

    await expect(take()).resolves.toEqual(refused);
    await expect(ravi.listRequests()).resolves.toEqual(before);
  });

  it('refuses a step twice — either way', async () => {
    const ravi = as(RAVI);
    await ravi.startRequest(ACCEPTED);
    await expect(ravi.startRequest(ACCEPTED)).resolves.toEqual(refused);

    await ravi.completeRequest(ACCEPTED, PAID);
    await expect(ravi.completeRequest(ACCEPTED, PAID)).resolves.toEqual(refused);
    await expect(ravi.startRequest(ACCEPTED)).resolves.toEqual(refused);
  });

  it('refuses to start a request this vendor rejected', async () => {
    const ravi = as(RAVI);
    await ravi.rejectRequest(PLAIN);

    await expect(ravi.startRequest(PLAIN)).resolves.toEqual(refused);
    await expect(ravi.completeRequest(PLAIN, PAID)).resolves.toEqual(refused);
  });

  it('leaves Accept and Reject as they were on work under way', async () => {
    await expect(as(RAVI).acceptRequest(ACCEPTED)).resolves.toEqual({
      outcome: 'refused',
      reason: 'notPending',
    });
    await expect(as(RAVI).rejectRequest(IN_PROGRESS)).resolves.toEqual({
      outcome: 'refused',
      reason: 'notPending',
    });
  });
});

describe('Whose work', () => {
  it('will not let another vendor start or complete it, and does not admit it exists', async () => {
    expect(await kindOf(() => as(MEENA).startRequest(ACCEPTED))).toBe('notFound');
    expect(await kindOf(() => as(MEENA).completeRequest(IN_PROGRESS, PAID))).toBe('notFound');

    await expect(as(RAVI).getRequest(ACCEPTED)).resolves.toMatchObject({ status: 'ACCEPTED' });
  });

  it('will not let a vendor work a request somebody else took', async () => {
    await as(MEENA).acceptRequest(OPEN);

    expect(await kindOf(() => as(RAVI).startRequest(OPEN))).toBe('notFound');
    await expect(as(MEENA).startRequest(OPEN)).resolves.toMatchObject({ outcome: 'started' });
  });

  it('says a reference nobody has was not found', async () => {
    expect(await kindOf(() => as(RAVI).startRequest('REQ-00000'))).toBe('notFound');
    expect(await kindOf(() => as(RAVI).completeRequest('REQ-00000', PAID))).toBe('notFound');
  });

  it('refuses without a session, and refuses a customer', async () => {
    for (const who of [null, ASHA]) {
      expect(await kindOf(() => as(who).startRequest(ACCEPTED))).toBe('unauthorized');
      expect(await kindOf(() => as(who).completeRequest(IN_PROGRESS, PAID))).toBe('unauthorized');
    }
    await expect(as(RAVI).getRequest(ACCEPTED)).resolves.toMatchObject({ status: 'ACCEPTED' });
  });

  it('keeps one vendor’s progress to themselves, even on the same reference', async () => {
    // Both given the same fixtures: the references collide, the progress must not.
    scenarios = { [RAVI.id]: 'mixed', [MEENA.id]: 'mixed' };

    await as(RAVI).startRequest(ACCEPTED);
    await as(RAVI).completeRequest(IN_PROGRESS, PAID);

    const meena = await as(MEENA).listRequests();
    expect(statusesOf(meena.active)).toEqual([`${IN_PROGRESS}:IN_PROGRESS`, `${ACCEPTED}:ACCEPTED`]);
    expect(meena.completed).toHaveLength(5);
    await expect(as(MEENA).startRequest(ACCEPTED)).resolves.toMatchObject({ outcome: 'started' });
  });
});

describe('A step that could not be recorded', () => {
  it('fails and changes nothing — start, and can be tried again', async () => {
    jest.spyOn(book, 'recordStart').mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const ravi = as(RAVI);
    const before = await ravi.listRequests();

    expect(await kindOf(() => ravi.startRequest(ACCEPTED))).toBe('unknown');
    await expect(ravi.listRequests()).resolves.toEqual(before);
    await expect(ravi.startRequest(ACCEPTED)).resolves.toMatchObject({ outcome: 'started' });
  });

  it('fails and changes nothing — complete', async () => {
    jest.spyOn(book, 'recordCompletion').mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const ravi = as(RAVI);

    expect(await kindOf(() => ravi.completeRequest(IN_PROGRESS, PAID))).toBe('unknown');
    await expect(ravi.getRequest(IN_PROGRESS)).resolves.toMatchObject({ status: 'IN_PROGRESS' });
  });
});

describe('The dashboard counts what the list shows', () => {
  it('shows started work as in progress, then counts it completed', async () => {
    const dashboard = dashboardFor(RAVI);

    await as(RAVI).startRequest(ACCEPTED);
    const started = await dashboard.getDashboard(3);
    expect(started.counts).toEqual({ pending: 4, active: 2, completed: 5 });
    expect(statusesOf(started.active)).toEqual([`${IN_PROGRESS}:IN_PROGRESS`, `${ACCEPTED}:IN_PROGRESS`]);

    await as(RAVI).completeRequest(ACCEPTED, PAID);
    const completed = await dashboard.getDashboard(3);
    expect(completed.counts).toEqual({ pending: 4, active: 1, completed: 6 });
    expect(completed.recentlyCompleted[0]).toMatchObject({ id: ACCEPTED, status: 'COMPLETED' });
  });

  it('agrees with the list after a whole job', async () => {
    const ravi = as(RAVI);
    await ravi.acceptRequest(DIRECTED);
    await ravi.startRequest(DIRECTED);
    await ravi.completeRequest(DIRECTED, PAID);

    const list = await ravi.listRequests();
    const { counts } = await dashboardFor(RAVI).getDashboard(3);
    expect(counts).toEqual({
      pending: list.pending.length,
      active: list.active.length,
      completed: list.completed.length,
    });
    expect(counts).toEqual({ pending: 3, active: 2, completed: 6 });
  });
});

describe('Deterministic', () => {
  it('gives the same answers to the same steps, every time', async () => {
    const play = async () => {
      book = new MockVendorRequestBook();
      const ravi = as(RAVI);
      return [
        await ravi.acceptRequest(DIRECTED),
        await ravi.startRequest(DIRECTED),
        await ravi.completeRequest(IN_PROGRESS, PAID),
        await ravi.completeRequest(ACCEPTED, PAID),
        await ravi.listRequests(),
      ];
    };

    expect(await play()).toEqual(await play());
  });
});
