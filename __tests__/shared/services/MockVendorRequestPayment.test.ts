/**
 * Recording a payment after the job, on the mock backend (owner decision,
 * 21/10/2026; PROJECT_BIBLE.md section 37, the offline payment record).
 *
 * It stands in for a backend, so what is pinned here is what a backend must
 * enforce whatever the form already checked:
 *
 * - a finished job recorded "Not paid yet" becomes "Paid" with the method and
 *   the service's label for it; the amount, the currency and the notes stay
 *   exactly as recorded, and the job keeps its place in the completed list
 * - it is kept: every read after says paid
 * - only that way, once: a record already paid answers as it is — not an
 *   error, and not changed by a second method
 * - nothing else can be recorded on: waiting, accepted, in progress, declined,
 *   or finished without a record — `invalidTransition`, nothing changed
 * - the body is checked before the request: a status other than paid, a
 *   method the service does not offer, or no body at all is `validation`, and
 *   nothing is recorded
 * - somebody else's request is `notFound`; no vendor session is `unauthorized`
 * - a recording that could not be kept is a failure and changed nothing
 */

import type { AuthUser } from '@/features/auth/types';
import { MockVendorRequestBook } from '@/shared/services/mock/MockVendorRequestBook';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import type { MockDashboardScenario } from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type {
  VendorPaymentInput,
  VendorPaymentResult,
  VendorRequestDetails,
} from '@/shared/services/types/VendorRequestService';
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

/** In the fixtures: finished and not paid yet (₹650, no notes); paid by UPI; finished with no record. */
const NOT_PAID_YET = 'REQ-30833';
const PAID_BY_UPI = 'REQ-30912';
const NO_RECORD = 'REQ-30876';
const IN_PROGRESS = 'REQ-30954';
const ACCEPTED = 'REQ-30961';
const WAITING = 'REQ-31038';

const NOW = new Date('2026-10-21T10:00:00.000Z').getTime();

const BY_CASH: VendorPaymentInput = { paymentStatus: 'PAID', paymentMethodId: 'cash' };

let book: MockVendorRequestBook;

function as(vendor: AuthUser | null) {
  const scenarios: Record<string, MockDashboardScenario> = {
    [RAVI.id]: 'mixed',
    [MEENA.id]: 'openOnly',
  };
  return new MockVendorRequestService({
    latency: NO_LATENCY,
    currentUser: async () => vendor,
    scenarioFor: vendorId => scenarios[vendorId] ?? 'empty',
    // Pinned, so a record read twice is the same record — the fixtures' dates come from the clock.
    now: () => NOW,
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

function recorded(result: VendorPaymentResult): VendorRequestDetails {
  if (result.outcome !== 'recorded') {
    throw new Error(`expected it recorded, got ${result.outcome}`);
  }
  return result.request;
}

beforeEach(() => {
  book = new MockVendorRequestBook();
});

describe('A payment recorded later', () => {
  it('turns "Not paid yet" into paid with the method — and changes nothing else in the record', async () => {
    const ravi = as(RAVI);
    const before = await ravi.getRequest(NOT_PAID_YET);

    const request = recorded(await ravi.recordPayment(NOT_PAID_YET, BY_CASH));

    expect(request.completion).toStrictEqual({
      finalAmountMinor: 65_000,
      currency: 'INR',
      paymentStatus: 'PAID',
      paymentMethodId: 'cash',
      paymentMethodLabel: 'Cash',
    });
    // The request around it is as it was: same status, same completion date.
    expect(request.status).toBe(before.status);
    expect(request.completedAt).toBe(before.completedAt);
  });

  it('is kept: every read after says paid', async () => {
    const ravi = as(RAVI);
    await ravi.recordPayment(NOT_PAID_YET, { paymentStatus: 'PAID', paymentMethodId: 'upi' });

    const opened = await ravi.getRequest(NOT_PAID_YET);
    expect(opened.completion?.paymentStatus).toBe('PAID');
    expect(opened.completion?.paymentMethodLabel).toBe('UPI');
  });

  it('keeps the job where it was in the completed list', async () => {
    const ravi = as(RAVI);
    const before = (await ravi.listRequests()).completed.map(job => job.id);

    await ravi.recordPayment(NOT_PAID_YET, BY_CASH);

    expect((await ravi.listRequests()).completed.map(job => job.id)).toEqual(before);
  });

  it('keeps the vendor’s own notes on a job they completed here, not paid yet', async () => {
    const ravi = as(RAVI);
    await ravi.completeRequest(IN_PROGRESS, {
      finalAmountMinor: 125_050,
      currency: 'INR',
      paymentStatus: 'UNPAID',
      notes: 'Customer will pay on Friday.',
    });

    const request = recorded(
      await ravi.recordPayment(IN_PROGRESS, { paymentStatus: 'PAID', paymentMethodId: 'bank_transfer' }),
    );

    expect(request.completion).toStrictEqual({
      finalAmountMinor: 125_050,
      currency: 'INR',
      paymentStatus: 'PAID',
      notes: 'Customer will pay on Friday.',
      paymentMethodId: 'bank_transfer',
      paymentMethodLabel: 'Bank transfer',
    });
  });

  it('answers a record already paid as it is — a retry is not an error, and the first method stands', async () => {
    const ravi = as(RAVI);
    await ravi.recordPayment(NOT_PAID_YET, BY_CASH);

    const again = recorded(
      await ravi.recordPayment(NOT_PAID_YET, { paymentStatus: 'PAID', paymentMethodId: 'card' }),
    );
    expect(again.completion?.paymentMethodId).toBe('cash');
    expect(again.completion?.paymentMethodLabel).toBe('Cash');

    // A fixture paid by UPI the same way.
    const fixture = recorded(await ravi.recordPayment(PAID_BY_UPI, BY_CASH));
    expect(fixture.completion?.paymentMethodLabel).toBe('UPI');
    expect(fixture.completion?.notes).toContain('geyser');
  });
});

describe('Nothing else can be recorded on', () => {
  it.each([
    ['finished with no record', NO_RECORD],
    ['in progress', IN_PROGRESS],
    ['accepted', ACCEPTED],
    ['waiting for an answer', WAITING],
  ])('refuses a job %s, and changes nothing', async (_state, reference) => {
    const ravi = as(RAVI);
    const before = await ravi.getRequest(reference);

    await expect(ravi.recordPayment(reference, BY_CASH)).resolves.toEqual({
      outcome: 'refused',
      reason: 'invalidTransition',
    });
    expect(await ravi.getRequest(reference)).toEqual(before);
  });

  it('refuses a request the vendor declined', async () => {
    const ravi = as(RAVI);
    await ravi.rejectRequest(WAITING);

    await expect(ravi.recordPayment(WAITING, BY_CASH)).resolves.toEqual({
      outcome: 'refused',
      reason: 'invalidTransition',
    });
  });

  it('says somebody else’s request does not exist', async () => {
    expect(await kindOf(() => as(MEENA).recordPayment(NOT_PAID_YET, BY_CASH))).toBe('notFound');
    expect(await kindOf(() => as(RAVI).recordPayment('REQ-0', BY_CASH))).toBe('notFound');
  });

  it('refuses without a vendor session', async () => {
    expect(await kindOf(() => as(null).recordPayment(NOT_PAID_YET, BY_CASH))).toBe('unauthorized');
    expect(await kindOf(() => as(ASHA).recordPayment(NOT_PAID_YET, BY_CASH))).toBe('unauthorized');
  });
});

describe('The body, checked first', () => {
  it.each([
    ['a status other than paid', { paymentStatus: 'UNPAID', paymentMethodId: 'cash' }],
    ['a status in the wrong case', { paymentStatus: 'paid', paymentMethodId: 'cash' }],
    ['a method the service does not offer', { paymentStatus: 'PAID', paymentMethodId: 'gold' }],
    ['no method', { paymentStatus: 'PAID' }],
    ['a method that is not text', { paymentStatus: 'PAID', paymentMethodId: 3 }],
    ['no body at all', null],
  ])('refuses %s as validation, and records nothing', async (_name, body) => {
    const ravi = as(RAVI);

    expect(
      await kindOf(() => ravi.recordPayment(NOT_PAID_YET, body as unknown as VendorPaymentInput)),
    ).toBe('validation');
    expect((await ravi.getRequest(NOT_PAID_YET)).completion?.paymentStatus).toBe('UNPAID');
  });

  it('checks the body before the request — a bad body on somebody else’s is still validation', async () => {
    const body = { paymentStatus: 'UNPAID', paymentMethodId: 'cash' };

    expect(await kindOf(() => as(RAVI).recordPayment('REQ-0', body))).toBe('validation');
  });
});

describe('A recording that could not be kept', () => {
  it('is a failure, and the record is still not paid', async () => {
    const ravi = as(RAVI);
    jest.spyOn(book, 'recordPayment').mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    expect(await kindOf(() => ravi.recordPayment(NOT_PAID_YET, BY_CASH))).toBe('unknown');
    expect((await ravi.getRequest(NOT_PAID_YET)).completion?.paymentStatus).toBe('UNPAID');
  });

  it('is the book’s alone: a new book — an app restart — forgets it', async () => {
    await as(RAVI).recordPayment(NOT_PAID_YET, BY_CASH);
    book = new MockVendorRequestBook();

    expect((await as(RAVI).getRequest(NOT_PAID_YET)).completion?.paymentStatus).toBe('UNPAID');
  });
});
