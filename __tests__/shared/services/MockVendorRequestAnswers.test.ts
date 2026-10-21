/**
 * Accepting and rejecting a waiting request, on the mock backend
 * (PROJECT_BIBLE.md section 33, Phase 3E-4).
 *
 * It stands in for a backend, so what is pinned here is what a backend must
 * enforce whatever the screen shows:
 *
 * - a waiting request can be accepted (it becomes active) or rejected (it
 *   leaves waiting for the vendor's rejected list, and is still answered for by
 *   reference)
 * - what a vendor declined is their own history (owner decision, 2026-10-21):
 *   most recently declined first, dated, never another vendor's, kept after
 *   somebody else takes the request, and never counted on the dashboard
 * - nothing that is not waiting can be answered, and an answer cannot be given
 *   twice — refused, with nothing changed
 * - an open request goes to whoever accepts first; everybody after is refused
 *   `taken`, including two answers in flight at once
 * - a request the customer sent to one vendor cannot be answered by another,
 *   who is told it does not exist
 * - no session, or a customer's, is refused outright
 * - an answer that could not be recorded is a failure and changed nothing
 * - the dashboard counts what the list changed, because they share one record
 * - all of it is deterministic, and one vendor's rejection is theirs alone
 */

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser } from '@/features/auth/types';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import {
  applyVendorAnswers,
  MockVendorRequestBook,
} from '@/shared/services/mock/MockVendorRequestBook';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import {
  buildMockVendorWork,
  type MockDashboardScenario,
} from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { PAYMENT_STATUS_UNPAID } from '@/shared/services/types/VendorRequestService';
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

const NOW = new Date('2026-09-30T12:00:00.000Z').getTime();

/** Sent to everybody: Ravi and Meena both see it. */
const OPEN = 'REQ-31042';
/** Also sent to everybody, and long in every field. */
const OPEN_LONG = 'REQ-2026-BLR-EAST-0031021';
/** The customer chose Ravi for this one. */
const DIRECTED = 'REQ-31038';
/** Ravi's, with no word on how it reached him. */
const PLAIN = 'REQ-30987';
const IN_PROGRESS = 'REQ-30954';
const ALREADY_ACCEPTED = 'REQ-30961';
const FINISHED = 'REQ-30912';

const SCENARIOS: Record<string, MockDashboardScenario> = {
  [RAVI.id]: 'mixed',
  [MEENA.id]: 'openOnly',
};

let user: AuthUser | null;
let book: MockVendorRequestBook;

/** A service acting for one vendor, sharing the book with every other made by this test. */
function as(vendor: AuthUser | null) {
  return new MockVendorRequestService({
    latency: NO_LATENCY,
    currentUser: async () => vendor,
    now: () => NOW,
    scenarioFor: vendorId => SCENARIOS[vendorId] ?? 'empty',
    book,
  });
}

/** The service the running app has: one instance, whoever is signed in. */
function shared() {
  return new MockVendorRequestService({
    latency: NO_LATENCY,
    currentUser: async () => user,
    now: () => NOW,
    scenarioFor: vendorId => SCENARIOS[vendorId] ?? 'empty',
    book,
  });
}

function dashboardFor(vendor: AuthUser) {
  return new MockVendorDashboardService({
    latency: NO_LATENCY,
    currentUser: async () => vendor,
    now: () => NOW,
    scenarioFor: vendorId => SCENARIOS[vendorId] ?? 'empty',
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

beforeEach(() => {
  user = RAVI;
  book = new MockVendorRequestBook();
});

describe('Accepting a waiting request', () => {
  it('accepts it, and answers with the record as it now stands', async () => {
    const result = await as(RAVI).acceptRequest(DIRECTED);

    expect(result).toEqual({
      outcome: 'accepted',
      request: expect.objectContaining({
        id: DIRECTED,
        serviceName: 'Ceiling fan installation',
        status: 'ACCEPTED',
        categoryName: 'Electrician',
      }),
    });
    // Routing describes a request that is waiting; accepted work has none.
    expect(result.outcome === 'accepted' && 'dispatch' in result.request).toBe(false);
  });

  it('moves it out of waiting and into active, after the work already under way', async () => {
    const ravi = as(RAVI);
    await ravi.acceptRequest(DIRECTED);

    const list = await ravi.listRequests();
    expect(idsOf(list.pending)).toEqual([OPEN, OPEN_LONG, PLAIN]);
    expect(idsOf(list.active)).toEqual([IN_PROGRESS, ALREADY_ACCEPTED, DIRECTED]);
    expect(list.active[2].status).toBe('ACCEPTED');
    expect(list.completed).toHaveLength(5);
    await expect(ravi.getRequest(DIRECTED)).resolves.toMatchObject({ status: 'ACCEPTED' });
  });

  it('forgives padding around the reference', async () => {
    await expect(as(RAVI).acceptRequest(`  ${DIRECTED} `)).resolves.toMatchObject({
      outcome: 'accepted',
    });
  });

  it('carries no address, phone number or photograph on the record it returns', async () => {
    const result = await as(RAVI).acceptRequest(OPEN);
    const keys = result.outcome === 'accepted' ? Object.keys(result.request) : [];

    expect(keys).not.toEqual(expect.arrayContaining(['address']));
    expect(keys.join(' ')).not.toMatch(/address|phone|photo|image/i);
  });
});

describe('Rejecting a waiting request', () => {
  it('rejects it, and answers with the record as it now stands', async () => {
    const result = await as(RAVI).rejectRequest(DIRECTED);

    expect(result).toEqual({
      outcome: 'rejected',
      request: expect.objectContaining({ id: DIRECTED, status: 'REJECTED' }),
    });
  });

  it('takes it out of the work — not waiting, not active, not finished — and lists it as rejected', async () => {
    const ravi = as(RAVI);
    await ravi.rejectRequest(DIRECTED);

    const list = await ravi.listRequests();
    expect(idsOf(list.pending)).toEqual([OPEN, OPEN_LONG, PLAIN]);
    expect(idsOf(list.active)).toEqual([IN_PROGRESS, ALREADY_ACCEPTED]);
    expect(idsOf(list.completed)).not.toContain(DIRECTED);
    expect(idsOf(list.rejected)).toEqual([DIRECTED]);
  });

  it('still answers for it by reference, as rejected, so an open screen can say what happened', async () => {
    const ravi = as(RAVI);
    await ravi.rejectRequest(DIRECTED);

    await expect(ravi.getRequest(DIRECTED)).resolves.toMatchObject({
      id: DIRECTED,
      status: 'REJECTED',
      categoryName: 'Electrician',
    });
  });
});

describe('What a vendor declined — their own history (owner decision, 2026-10-21)', () => {
  let clock: number;

  /** A service acting for one vendor on a clock the test moves, sharing the book. */
  function at(vendor: AuthUser) {
    return new MockVendorRequestService({
      latency: NO_LATENCY,
      currentUser: async () => vendor,
      now: () => clock,
      scenarioFor: vendorId => SCENARIOS[vendorId] ?? 'empty',
      book,
    });
  }

  beforeEach(() => {
    clock = NOW;
  });

  it('lists a rejected request as rejected, dated when it was declined — and says so in its answer', async () => {
    const declinedAt = new Date(NOW).toISOString();

    await expect(at(RAVI).rejectRequest(DIRECTED)).resolves.toEqual({
      outcome: 'rejected',
      request: expect.objectContaining({ id: DIRECTED, status: 'REJECTED', rejectedAt: declinedAt }),
    });

    const { rejected } = await at(RAVI).listRequests();
    expect(rejected).toEqual([
      expect.objectContaining({
        id: DIRECTED,
        serviceName: 'Ceiling fan installation',
        status: 'REJECTED',
        rejectedAt: declinedAt,
      }),
    ]);
    // Routing describes a request that is waiting; a declined one has none.
    expect('dispatch' in rejected[0]).toBe(false);
  });

  it('lists the most recently declined first', async () => {
    await at(RAVI).rejectRequest(PLAIN);
    clock += 60_000;
    await at(RAVI).rejectRequest(DIRECTED);
    clock += 60_000;
    await at(RAVI).rejectRequest(OPEN);

    expect(idsOf((await at(RAVI).listRequests()).rejected)).toEqual([OPEN, DIRECTED, PLAIN]);
  });

  it('keeps the order they were declined in when the clock stands still or goes back', async () => {
    await at(RAVI).rejectRequest(PLAIN);
    await at(RAVI).rejectRequest(OPEN_LONG);
    clock -= 3_600_000;
    await at(RAVI).rejectRequest(DIRECTED);

    expect(idsOf((await at(RAVI).listRequests()).rejected)).toEqual([DIRECTED, OPEN_LONG, PLAIN]);
  });

  it('opens a declined request by reference exactly as the list has it', async () => {
    await at(RAVI).rejectRequest(DIRECTED);
    const { rejected } = await at(RAVI).listRequests();

    await expect(at(RAVI).getRequest(DIRECTED)).resolves.toMatchObject(rejected[0]);
  });

  it('never shows one vendor what another declined', async () => {
    await at(MEENA).rejectRequest(OPEN);
    clock += 1_000;
    await at(MEENA).rejectRequest(OPEN_LONG);

    const ravi = await at(RAVI).listRequests();
    expect(ravi.rejected).toEqual([]);
    // Still waiting for him: her rejection was hers.
    expect(idsOf(ravi.pending)).toEqual([OPEN, DIRECTED, OPEN_LONG, PLAIN]);
    expect(idsOf((await at(MEENA).listRequests()).rejected)).toEqual([OPEN_LONG, OPEN]);
  });

  it('keeps each vendor’s own rejection of one open request, with their own date', async () => {
    await at(RAVI).rejectRequest(OPEN);
    clock += 5_000;
    await at(MEENA).rejectRequest(OPEN);

    expect((await at(RAVI).listRequests()).rejected).toEqual([
      expect.objectContaining({ id: OPEN, rejectedAt: new Date(NOW).toISOString() }),
    ]);
    expect((await at(MEENA).listRequests()).rejected).toEqual([
      expect.objectContaining({ id: OPEN, rejectedAt: new Date(NOW + 5_000).toISOString() }),
    ]);
  });

  it('keeps a declined request in the history after somebody else accepts it', async () => {
    await at(RAVI).rejectRequest(OPEN);
    await expect(at(MEENA).acceptRequest(OPEN)).resolves.toMatchObject({ outcome: 'accepted' });

    const ravi = await at(RAVI).listRequests();
    expect(idsOf(ravi.rejected)).toEqual([OPEN]);
    expect(ravi.rejected[0].status).toBe('REJECTED');
    expect(idsOf([...ravi.pending, ...ravi.active, ...ravi.completed])).not.toContain(OPEN);
    // Still his to open, as he left it — never "not found", never her "Accepted".
    await expect(at(RAVI).getRequest(OPEN)).resolves.toMatchObject({ id: OPEN, status: 'REJECTED' });
    expect(idsOf((await at(MEENA).listRequests()).active)).toContain(OPEN);
  });

  it('cannot be answered or worked: every action on it is refused, and nothing moves', async () => {
    const ravi = at(RAVI);
    await ravi.rejectRequest(DIRECTED);
    const before = await ravi.listRequests();

    const notPending = { outcome: 'refused', reason: 'notPending' };
    const invalid = { outcome: 'refused', reason: 'invalidTransition' };
    await expect(ravi.acceptRequest(DIRECTED)).resolves.toEqual(notPending);
    await expect(ravi.rejectRequest(DIRECTED)).resolves.toEqual(notPending);
    await expect(ravi.startRequest(DIRECTED)).resolves.toEqual(invalid);
    await expect(
      ravi.completeRequest(DIRECTED, {
        finalAmountMinor: 50_000,
        currency: AppConfig.money.currency,
        paymentStatus: PAYMENT_STATUS_UNPAID,
      }),
    ).resolves.toEqual(invalid);

    await expect(ravi.listRequests()).resolves.toEqual(before);
  });

  it('is not counted on the dashboard, and never shown there', async () => {
    await at(RAVI).rejectRequest(DIRECTED);
    await at(RAVI).rejectRequest(PLAIN);

    const dashboard = await dashboardFor(RAVI).getDashboard(10);
    expect(dashboard.counts).toEqual({ pending: 2, active: 2, completed: 5 });
    const drawn = JSON.stringify(dashboard);
    expect(drawn).not.toContain(DIRECTED);
    expect(drawn).not.toContain(PLAIN);
    expect(drawn).not.toContain('REJECTED');
    expect(drawn).not.toContain('rejectedAt');
  });

  it('records nothing in the history when the rejection could not be recorded', async () => {
    jest.spyOn(book, 'recordRejection').mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    expect(await kindOf(() => at(RAVI).rejectRequest(DIRECTED))).toBe('unknown');
    expect((await at(RAVI).listRequests()).rejected).toEqual([]);
  });

  it('hands back fresh records, so a caller cannot edit the history', async () => {
    await at(RAVI).rejectRequest(DIRECTED);
    const first = await at(RAVI).listRequests();
    first.rejected[0].status = 'PENDING_VENDOR';
    first.rejected.length = 0;

    const second = await at(RAVI).listRequests();
    expect(idsOf(second.rejected)).toEqual([DIRECTED]);
    expect(second.rejected[0].status).toBe('REJECTED');
  });

  it('carries no address, phone number or photograph', async () => {
    await at(RAVI).rejectRequest(OPEN);
    const [declined] = (await at(RAVI).listRequests()).rejected;

    expect(Object.keys(declined).join(' ')).not.toMatch(/address|phone|photo|image|email/i);
  });

  it('starts again empty when the book is new — as on an app restart', async () => {
    await at(RAVI).rejectRequest(DIRECTED);
    book = new MockVendorRequestBook();

    const list = await at(RAVI).listRequests();
    expect(list.rejected).toEqual([]);
    expect(idsOf(list.pending)).toContain(DIRECTED);
  });
});

describe('Only a request that is waiting can be answered', () => {
  it.each([
    ['in progress', IN_PROGRESS],
    ['already accepted', ALREADY_ACCEPTED],
    ['finished', FINISHED],
  ])('refuses to accept or reject work that is %s, and changes nothing', async (_name, reference) => {
    const ravi = as(RAVI);
    const before = await ravi.listRequests();

    await expect(ravi.acceptRequest(reference)).resolves.toEqual({
      outcome: 'refused',
      reason: 'notPending',
    });
    await expect(ravi.rejectRequest(reference)).resolves.toEqual({
      outcome: 'refused',
      reason: 'notPending',
    });
    await expect(ravi.listRequests()).resolves.toEqual(before);
  });

  it('refuses a second answer once one has been given — either way round', async () => {
    const ravi = as(RAVI);
    await ravi.acceptRequest(DIRECTED);
    await ravi.rejectRequest(PLAIN);

    const refused = { outcome: 'refused', reason: 'notPending' };
    await expect(ravi.acceptRequest(DIRECTED)).resolves.toEqual(refused);
    await expect(ravi.rejectRequest(DIRECTED)).resolves.toEqual(refused);
    await expect(ravi.acceptRequest(PLAIN)).resolves.toEqual(refused);
    await expect(ravi.rejectRequest(PLAIN)).resolves.toEqual(refused);

    // The first answers stand.
    await expect(ravi.getRequest(DIRECTED)).resolves.toMatchObject({ status: 'ACCEPTED' });
    await expect(ravi.getRequest(PLAIN)).resolves.toMatchObject({ status: 'REJECTED' });
  });

  it('says a reference nobody has was not found', async () => {
    expect(await kindOf(() => as(RAVI).acceptRequest('REQ-00000'))).toBe('notFound');
    expect(await kindOf(() => as(RAVI).rejectRequest('REQ-00000'))).toBe('notFound');
  });
});

describe('An open request goes to the first vendor to accept it', () => {
  it('lets the first accept and tells the second it is taken', async () => {
    await expect(as(RAVI).acceptRequest(OPEN)).resolves.toMatchObject({ outcome: 'accepted' });

    await expect(as(MEENA).acceptRequest(OPEN)).resolves.toEqual({
      outcome: 'refused',
      reason: 'taken',
    });
    await expect(as(MEENA).rejectRequest(OPEN)).resolves.toEqual({
      outcome: 'refused',
      reason: 'taken',
    });
  });

  it('leaves the winner holding it and takes it off everybody else’s list', async () => {
    await as(MEENA).acceptRequest(OPEN);

    const meena = await as(MEENA).listRequests();
    expect(idsOf(meena.pending)).toEqual([OPEN_LONG]);
    expect(idsOf(meena.active)).toEqual([OPEN]);

    const ravi = await as(RAVI).listRequests();
    expect(idsOf(ravi.pending)).toEqual([DIRECTED, OPEN_LONG, PLAIN]);
    expect(idsOf(ravi.active)).not.toContain(OPEN);
    // Not his any more — and he is not told whose it is.
    expect(await kindOf(() => as(RAVI).getRequest(OPEN))).toBe('notFound');
  });

  it('lets exactly one of two answers in flight at once win', async () => {
    const [ravi, meena] = await Promise.all([as(RAVI).acceptRequest(OPEN), as(MEENA).acceptRequest(OPEN)]);

    expect(ravi.outcome).toBe('accepted');
    expect(meena).toEqual({ outcome: 'refused', reason: 'taken' });
    expect(book.acceptedBy(OPEN)).toBe(RAVI.id);
  });

  it('keeps one vendor’s rejection to themselves: the request stays open to everybody else', async () => {
    await expect(as(MEENA).rejectRequest(OPEN)).resolves.toMatchObject({ outcome: 'rejected' });

    expect(idsOf((await as(MEENA).listRequests()).pending)).toEqual([OPEN_LONG]);
    expect(idsOf((await as(RAVI).listRequests()).pending)).toContain(OPEN);
    await expect(as(RAVI).acceptRequest(OPEN)).resolves.toMatchObject({ outcome: 'accepted' });
  });

  it('works the same on the one service the app runs, whoever is signed in', async () => {
    const requests = shared();
    user = RAVI;
    const seen = await requests.listRequests();
    expect(idsOf(seen.pending)).toContain(OPEN);

    user = MEENA;
    await requests.acceptRequest(OPEN);

    // Ravi's list from before is now stale: the answer, not the screen, decides.
    user = RAVI;
    await expect(requests.acceptRequest(OPEN)).resolves.toEqual({ outcome: 'refused', reason: 'taken' });
    expect(idsOf((await requests.listRequests()).pending)).not.toContain(OPEN);
  });
});

describe('A request sent to one vendor is theirs alone', () => {
  it('will not let another vendor accept or reject it, and does not admit it exists', async () => {
    expect(await kindOf(() => as(MEENA).acceptRequest(DIRECTED))).toBe('notFound');
    expect(await kindOf(() => as(MEENA).rejectRequest(DIRECTED))).toBe('notFound');
    expect(await kindOf(() => as(MEENA).acceptRequest(IN_PROGRESS))).toBe('notFound');

    // Untouched for the vendor it was sent to.
    expect(idsOf((await as(RAVI).listRequests()).pending)).toContain(DIRECTED);
    await expect(as(RAVI).acceptRequest(DIRECTED)).resolves.toMatchObject({ outcome: 'accepted' });
  });

  it('refuses without a session, and refuses a customer', async () => {
    expect(await kindOf(() => as(null).acceptRequest(DIRECTED))).toBe('unauthorized');
    expect(await kindOf(() => as(null).rejectRequest(DIRECTED))).toBe('unauthorized');
    expect(await kindOf(() => as(ASHA).acceptRequest(DIRECTED))).toBe('unauthorized');
    expect(await kindOf(() => as(ASHA).rejectRequest(DIRECTED))).toBe('unauthorized');

    expect(book.acceptedBy(DIRECTED)).toBeUndefined();
  });
});

describe('An answer that could not be recorded', () => {
  it('fails, says nothing about the request, and changes nothing — accept', async () => {
    jest.spyOn(book, 'recordAcceptance').mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const ravi = as(RAVI);
    const before = await ravi.listRequests();

    const failure = await ravi.acceptRequest(DIRECTED).catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).kind).toBe('unknown');
    await expect(ravi.listRequests()).resolves.toEqual(before);
    // And it can be tried again.
    await expect(ravi.acceptRequest(DIRECTED)).resolves.toMatchObject({ outcome: 'accepted' });
  });

  it('fails, and changes nothing — reject', async () => {
    jest.spyOn(book, 'recordRejection').mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const ravi = as(RAVI);

    expect(await kindOf(() => ravi.rejectRequest(DIRECTED))).toBe('unknown');
    expect(idsOf((await ravi.listRequests()).pending)).toContain(DIRECTED);
  });
});

describe('The dashboard counts what the list changed', () => {
  it('moves an accepted request from waiting to active, and drops a rejected one', async () => {
    const dashboard = dashboardFor(RAVI);
    expect((await dashboard.getDashboard(3)).counts).toEqual({ pending: 4, active: 2, completed: 5 });

    await as(RAVI).acceptRequest(DIRECTED);
    expect((await dashboard.getDashboard(3)).counts).toEqual({ pending: 3, active: 3, completed: 5 });

    await as(RAVI).rejectRequest(PLAIN);
    const after = await dashboard.getDashboard(3);
    expect(after.counts).toEqual({ pending: 2, active: 3, completed: 5 });
    expect(idsOf(after.pending)).toEqual([OPEN, OPEN_LONG]);
    expect(idsOf(after.active)).toEqual([IN_PROGRESS, ALREADY_ACCEPTED, DIRECTED]);
  });

  it('agrees with the list for both vendors after a race', async () => {
    await as(RAVI).acceptRequest(OPEN);

    for (const vendor of [RAVI, MEENA]) {
      const list = await as(vendor).listRequests();
      const { counts } = await dashboardFor(vendor).getDashboard(3);
      expect(counts).toEqual({
        pending: list.pending.length,
        active: list.active.length,
        completed: list.completed.length,
      });
    }
    expect((await dashboardFor(MEENA).getDashboard(3)).counts.pending).toBe(1);
  });
});

describe('Deterministic, and held only while the app runs', () => {
  it('gives the same answers to the same sequence, every time', async () => {
    const play = async () => {
      book = new MockVendorRequestBook();
      return [
        await as(RAVI).acceptRequest(OPEN),
        await as(MEENA).acceptRequest(OPEN),
        await as(MEENA).rejectRequest(OPEN_LONG),
        await as(RAVI).rejectRequest(OPEN_LONG),
        await as(RAVI).listRequests(),
        await as(MEENA).listRequests(),
      ];
    };

    expect(await play()).toEqual(await play());
  });

  it('starts again with everything waiting when the book is new — as on an app restart', async () => {
    await as(RAVI).acceptRequest(DIRECTED);
    book = new MockVendorRequestBook();

    expect(idsOf((await as(RAVI).listRequests()).pending)).toEqual([OPEN, DIRECTED, OPEN_LONG, PLAIN]);
  });

  it('applies answers without changing the work it was handed', () => {
    const work = buildMockVendorWork('mixed', NOW);
    const copy = JSON.parse(JSON.stringify(work));
    book.recordAcceptance(RAVI.id, DIRECTED);
    book.recordRejection(RAVI.id, PLAIN, new Date(NOW).toISOString());

    const seen = applyVendorAnswers(RAVI.id, work, book);

    expect(work).toEqual(copy);
    expect(idsOf(seen.pending)).toEqual([OPEN, OPEN_LONG]);
  });

  it('never records two winners for one request', () => {
    book.recordAcceptance(RAVI.id, OPEN);

    expect(() => book.recordAcceptance(MEENA.id, OPEN)).toThrow();
    expect(book.acceptedBy(OPEN)).toBe(RAVI.id);
  });
});
