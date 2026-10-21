/**
 * Completing work with the offline payment record, on the mock backend
 * (PROJECT_BIBLE.md sections 36 and 37).
 *
 * It stands in for a backend, so what is pinned here is what a backend must
 * enforce whatever the form already checked:
 *
 * - the payment methods are the service's — section 37's five, in its order,
 *   for a vendor session only, handed out as copies
 * - a completion is recorded on the request as it was sent, with the method's
 *   label named by the service; notes exactly as written; a blank note is none
 * - an amount that is not a whole number of paise above 0 and within the
 *   ceiling, a currency or status the service does not know, a paid job with no
 *   method or an unknown one, an unpaid job with one, or notes over the ceiling
 *   is `validation`, and nothing is recorded — the job is still in progress
 * - the input is checked before the request is looked at
 * - a refused or failed completion records nothing
 * - finished fixtures: one paid by UPI with a note, one not paid yet, the rest
 *   with no record; work in progress has none
 * - one vendor's record is theirs alone, and a record cannot be edited by
 *   editing an answer
 */

import type { AuthUser } from '@/features/auth/types';
import { MockVendorRequestBook } from '@/shared/services/mock/MockVendorRequestBook';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import type { MockDashboardScenario } from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import {
  COMPLETION_NOTES_MAX_LENGTH,
  FINAL_AMOUNT_MAX_MINOR,
  type VendorCompletionInput,
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

/** In the fixtures: in progress, accepted, and three finished. */
const IN_PROGRESS = 'REQ-30954';
const ACCEPTED = 'REQ-30961';
const PAID_BY_UPI = 'REQ-30912';
const NOT_PAID_YET = 'REQ-30833';
const NO_RECORD = 'REQ-30876';

const PAID: VendorCompletionInput = {
  finalAmountMinor: 125_050,
  currency: 'INR',
  paymentStatus: 'PAID',
  paymentMethodId: 'bank_transfer',
  notes: 'Fitted a new inverter and rewired two rooms.',
};
const UNPAID: VendorCompletionInput = {
  finalAmountMinor: 45_000,
  currency: 'INR',
  paymentStatus: 'UNPAID',
};

let book: MockVendorRequestBook;
let scenarios: Record<string, MockDashboardScenario>;

function as(vendor: AuthUser | null) {
  return new MockVendorRequestService({
    latency: NO_LATENCY,
    currentUser: async () => vendor,
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

beforeEach(() => {
  book = new MockVendorRequestBook();
  scenarios = { [RAVI.id]: 'mixed', [MEENA.id]: 'openOnly' };
});

describe('The payment methods', () => {
  it('are section 37’s five, in its order, ids and labels from the service', async () => {
    await expect(as(RAVI).listPaymentMethods()).resolves.toEqual([
      { id: 'cash', label: 'Cash' },
      { id: 'upi', label: 'UPI' },
      { id: 'bank_transfer', label: 'Bank transfer' },
      { id: 'card', label: 'Card' },
      { id: 'other', label: 'Other' },
    ]);
  });

  it('are refused without a session, and to a customer', async () => {
    expect(await kindOf(() => as(null).listPaymentMethods())).toBe('unauthorized');
    expect(await kindOf(() => as(ASHA).listPaymentMethods())).toBe('unauthorized');
  });

  it('are handed out as copies, so the configuration cannot be edited through an answer', async () => {
    const ravi = as(RAVI);
    const first = await ravi.listPaymentMethods();
    first[0].label = 'Gold coins';
    first.pop();

    const second = await ravi.listPaymentMethods();
    expect(second).toHaveLength(5);
    expect(second[0].label).toBe('Cash');
  });
});

describe('A completion the service accepts', () => {
  it('records a paid job on the request, with the method named by the service', async () => {
    const result = await as(RAVI).completeRequest(IN_PROGRESS, PAID);

    expect(result).toMatchObject({ outcome: 'completed', request: { status: 'COMPLETED' } });
    const expected = {
      finalAmountMinor: 125_050,
      currency: 'INR',
      paymentStatus: 'PAID',
      paymentMethodId: 'bank_transfer',
      paymentMethodLabel: 'Bank transfer',
      notes: PAID.notes,
    };
    expect(result.outcome === 'completed' && result.request.completion).toEqual(expected);
    await expect(as(RAVI).getRequest(IN_PROGRESS)).resolves.toMatchObject({ completion: expected });
  });

  it('records a job not paid yet with no method and no notes — absent keys, not empty ones', async () => {
    await as(RAVI).completeRequest(IN_PROGRESS, UNPAID);

    const { completion } = await as(RAVI).getRequest(IN_PROGRESS);
    expect(completion).toEqual({ finalAmountMinor: 45_000, currency: 'INR', paymentStatus: 'UNPAID' });
    expect(Object.keys(completion ?? {}).sort()).toEqual(['currency', 'finalAmountMinor', 'paymentStatus']);
  });

  it('keeps the notes exactly as written, and treats a blank note as none', async () => {
    const typed = '  Two sockets replaced.\nCustomer asked for a call next week.  ';
    await as(RAVI).completeRequest(IN_PROGRESS, { ...UNPAID, notes: typed });
    expect((await as(RAVI).getRequest(IN_PROGRESS)).completion?.notes).toBe(typed);

    await as(RAVI).startRequest(ACCEPTED);
    await as(RAVI).completeRequest(ACCEPTED, { ...UNPAID, notes: '   ' });
    expect((await as(RAVI).getRequest(ACCEPTED)).completion).not.toHaveProperty('notes');
  });

  it('accepts the ceiling itself, and one paisa', async () => {
    await expect(
      as(RAVI).completeRequest(IN_PROGRESS, { ...UNPAID, finalAmountMinor: FINAL_AMOUNT_MAX_MINOR }),
    ).resolves.toMatchObject({ outcome: 'completed' });

    await as(RAVI).startRequest(ACCEPTED);
    await expect(as(RAVI).completeRequest(ACCEPTED, { ...UNPAID, finalAmountMinor: 1 })).resolves.toMatchObject({
      outcome: 'completed',
    });
  });

  it('keeps the record to itself: editing an answer changes nothing stored', async () => {
    const result = await as(RAVI).completeRequest(IN_PROGRESS, PAID);
    if (result.outcome === 'completed' && result.request.completion) {
      result.request.completion.finalAmountMinor = 1;
    }
    const read = await as(RAVI).getRequest(IN_PROGRESS);
    if (read.completion) {
      read.completion.paymentStatus = 'UNPAID';
    }

    expect((await as(RAVI).getRequest(IN_PROGRESS)).completion).toMatchObject({
      finalAmountMinor: 125_050,
      paymentStatus: 'PAID',
    });
  });
});

describe('A completion the service refuses', () => {
  it.each<[string, Partial<Record<keyof VendorCompletionInput, unknown>>]>([
    ['an amount of 0', { finalAmountMinor: 0 }],
    ['a negative amount', { finalAmountMinor: -100 }],
    ['a fraction of a paisa', { finalAmountMinor: 1250.5 }],
    ['an amount over the ceiling', { finalAmountMinor: FINAL_AMOUNT_MAX_MINOR + 1 }],
    ['an amount that is not a number', { finalAmountMinor: '125000' }],
    ['another currency', { currency: 'USD' }],
    ['a symbol for a currency', { currency: '₹' }],
    ['a status it does not know', { paymentStatus: 'PARTLY_PAID' }],
    ['a status in the wrong case', { paymentStatus: 'paid' }],
    ['a paid job with no method', { paymentStatus: 'PAID', paymentMethodId: undefined }],
    ['a paid job with a method it does not offer', { paymentStatus: 'PAID', paymentMethodId: 'crypto' }],
    ['a job not paid yet with a method', { paymentStatus: 'UNPAID', paymentMethodId: 'cash' }],
    ['notes over the ceiling', { notes: 'x'.repeat(COMPLETION_NOTES_MAX_LENGTH + 1) }],
    ['notes that are not text', { notes: 42 }],
  ])('refuses %s with validation, and records nothing', async (_name, change) => {
    const ravi = as(RAVI);
    const completion = { ...PAID, ...change } as VendorCompletionInput;

    expect(await kindOf(() => ravi.completeRequest(IN_PROGRESS, completion))).toBe('validation');

    const after = await ravi.getRequest(IN_PROGRESS);
    expect(after.status).toBe('IN_PROGRESS');
    expect(after).not.toHaveProperty('completion');
  });

  it('refuses a completion that is not an object at all', async () => {
    expect(
      await kindOf(() => as(RAVI).completeRequest(IN_PROGRESS, null as unknown as VendorCompletionInput)),
    ).toBe('validation');
  });

  it('accepts notes of exactly the ceiling', async () => {
    await expect(
      as(RAVI).completeRequest(IN_PROGRESS, { ...UNPAID, notes: 'x'.repeat(COMPLETION_NOTES_MAX_LENGTH) }),
    ).resolves.toMatchObject({ outcome: 'completed' });
  });

  it('checks the input before it looks at the request', async () => {
    // A job that is not in progress, and an amount of 0: the body is what is wrong first.
    expect(await kindOf(() => as(RAVI).completeRequest(ACCEPTED, { ...UNPAID, finalAmountMinor: 0 }))).toBe(
      'validation',
    );
    expect(await kindOf(() => as(RAVI).completeRequest('REQ-00000', { ...UNPAID, finalAmountMinor: 0 }))).toBe(
      'validation',
    );
  });

  it('records nothing when the step itself is refused', async () => {
    await expect(as(RAVI).completeRequest(ACCEPTED, PAID)).resolves.toEqual({
      outcome: 'refused',
      reason: 'invalidTransition',
    });
    expect(await as(RAVI).getRequest(ACCEPTED)).not.toHaveProperty('completion');
  });

  it('records nothing when the completion could not be stored', async () => {
    jest.spyOn(book, 'recordCompletion').mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    expect(await kindOf(() => as(RAVI).completeRequest(IN_PROGRESS, PAID))).toBe('unknown');
    const after = await as(RAVI).getRequest(IN_PROGRESS);
    expect(after.status).toBe('IN_PROGRESS');
    expect(after).not.toHaveProperty('completion');
  });
});

describe('What finished work already carries', () => {
  it('has one job paid by UPI with a note, one not paid yet without, and older ones with no record', async () => {
    const ravi = as(RAVI);

    expect((await ravi.getRequest(PAID_BY_UPI)).completion).toMatchObject({
      paymentStatus: 'PAID',
      paymentMethodId: 'upi',
      paymentMethodLabel: 'UPI',
      currency: 'INR',
    });
    expect((await ravi.getRequest(PAID_BY_UPI)).completion?.notes).toBeTruthy();

    const unpaid = (await ravi.getRequest(NOT_PAID_YET)).completion;
    expect(unpaid).toMatchObject({ paymentStatus: 'UNPAID', currency: 'INR' });
    expect(unpaid).not.toHaveProperty('paymentMethodId');
    expect(unpaid).not.toHaveProperty('notes');

    expect(await ravi.getRequest(NO_RECORD)).not.toHaveProperty('completion');
  });

  it('carries no record on work that is not finished', async () => {
    expect(await as(RAVI).getRequest(IN_PROGRESS)).not.toHaveProperty('completion');
    expect(await as(RAVI).getRequest(ACCEPTED)).not.toHaveProperty('completion');
  });

  it('keeps a record off the list: the list is the card’s fields only', async () => {
    await as(RAVI).completeRequest(IN_PROGRESS, PAID);

    const list = await as(RAVI).listRequests();
    expect(JSON.stringify(list)).not.toContain('completion');
    expect(JSON.stringify(list)).not.toContain('Bank transfer');
  });
});

describe('Whose record', () => {
  it('keeps one vendor’s record to themselves, even on the same reference', async () => {
    // Both given the same fixtures: the references collide, the records must not.
    scenarios = { [RAVI.id]: 'mixed', [MEENA.id]: 'mixed' };

    await as(RAVI).completeRequest(IN_PROGRESS, PAID);

    const hers = await as(MEENA).getRequest(IN_PROGRESS);
    expect(hers.status).toBe('IN_PROGRESS');
    expect(hers).not.toHaveProperty('completion');
  });

  it('will not let another vendor complete it, and does not admit it exists', async () => {
    expect(await kindOf(() => as(MEENA).completeRequest(IN_PROGRESS, PAID))).toBe('notFound');
  });
});
