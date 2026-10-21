/**
 * The completion form's rules and what it sends (PROJECT_BIBLE.md sections 36
 * and 37). Pinned here:
 *
 * - a typed amount is read into whole paise by splitting the text — never
 *   through floating point (1.15 is 115, not 114.99…)
 * - accepted: "1250", "1250.5", "1250.50", "  12 ", "007", the ceiling itself
 * - refused, each with its own message: empty, "1.234", "abc", "1,000",
 *   "-5", ".5", "5.", "1 000", "0", "0.00", one paisa over the ceiling, and
 *   digits enough to overflow
 * - a status is required and must be one the form offers; a method is required
 *   only when paid; notes are bounded at 500
 * - every message shows on the first press, not one at a time
 * - the payload's exact keys: a method only when paid (a method chosen and then
 *   "Not paid yet" is dropped), notes only when something was written and then
 *   exactly as typed, the currency from configuration
 */

import { AppConfig } from '@/core/config/AppConfig';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  buildCompletionInput,
  completeWorkFormValues,
  completeWorkSchema,
  parseAmountToMinor,
  readAmount,
  type CompleteWorkForm,
} from '@/features/vendor/validation/completeWorkSchema';
import {
  COMPLETION_NOTES_MAX_LENGTH,
  FINAL_AMOUNT_MAX_MINOR,
} from '@/shared/services/types/VendorRequestService';

const COPY = VENDOR_COPY.validation;

const VALID: CompleteWorkForm = {
  amount: '1250.50',
  paymentStatus: 'PAID',
  paymentMethodId: 'upi',
  notes: '',
};

/** The messages the schema gives, by field. */
function messagesFor(values: Partial<CompleteWorkForm>): Record<string, string[]> {
  const result = completeWorkSchema.safeParse({ ...VALID, ...values });
  const byField: Record<string, string[]> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = String(issue.path[0]);
      byField[field] = [...(byField[field] ?? []), issue.message];
    }
  }
  return byField;
}

describe('Reading a typed amount', () => {
  it.each([
    ['1250', 125_000],
    ['1250.5', 125_050],
    ['1250.50', 125_050],
    ['  12 ', 1_200],
    ['007', 700],
    ['0.01', 1],
    ['1.15', 115],
    ['1000000', FINAL_AMOUNT_MAX_MINOR],
    ['1000000.00', FINAL_AMOUNT_MAX_MINOR],
  ])('reads "%s" as %i paise', (typed, amountMinor) => {
    expect(readAmount(typed)).toEqual({ ok: true, amountMinor });
    expect(parseAmountToMinor(typed)).toBe(amountMinor);
  });

  it('never goes through floating point', () => {
    // parseFloat('1.15') * 100 is 114.99999999999999.
    expect(parseAmountToMinor('1.15')).toBe(115);
    expect(parseAmountToMinor('4.35')).toBe(435);
    expect(Number.isInteger(parseAmountToMinor('999999.99'))).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['1.234', 'format'],
    ['abc', 'format'],
    ['1,000', 'format'],
    ['1,000.50', 'format'],
    ['-5', 'format'],
    ['+5', 'format'],
    ['.5', 'format'],
    ['5.', 'format'],
    ['1 000', 'format'],
    ['1e3', 'format'],
    ['0', 'tooSmall'],
    ['0.00', 'tooSmall'],
    ['000', 'tooSmall'],
    ['1000000.01', 'tooLarge'],
    ['10000000', 'tooLarge'],
    ['99999999999999999999999', 'tooLarge'],
  ] as const)('refuses "%s" (%s)', (typed, problem) => {
    expect(readAmount(typed)).toEqual({ ok: false, problem });
    expect(parseAmountToMinor(typed)).toBeNull();
  });
});

describe('The completion form schema', () => {
  it('passes a paid job with a method, and an unpaid one without', () => {
    expect(completeWorkSchema.safeParse(VALID).success).toBe(true);
    expect(
      completeWorkSchema.safeParse({ ...VALID, paymentStatus: 'UNPAID', paymentMethodId: '' }).success,
    ).toBe(true);
  });

  it('says what is wrong with the amount, beside the amount', () => {
    expect(messagesFor({ amount: '' }).amount).toEqual([COPY.amountRequired]);
    expect(messagesFor({ amount: '1,000' }).amount).toEqual([COPY.amountFormat]);
    expect(messagesFor({ amount: '0' }).amount).toEqual([COPY.amountTooSmall]);
    expect(messagesFor({ amount: '2000000' }).amount).toEqual([COPY.amountTooLarge('₹10,00,000')]);
  });

  it('requires a status the form offers, with nothing chosen for the vendor', () => {
    expect(completeWorkFormValues().paymentStatus).toBe('');
    expect(messagesFor({ paymentStatus: '' }).paymentStatus).toEqual([COPY.paymentStatusRequired]);
    expect(messagesFor({ paymentStatus: 'paid' }).paymentStatus).toEqual([COPY.paymentStatusRequired]);
  });

  it('requires a method only when the customer paid', () => {
    expect(messagesFor({ paymentMethodId: '' }).paymentMethodId).toEqual([COPY.paymentMethodRequired]);
    expect(messagesFor({ paymentStatus: 'UNPAID', paymentMethodId: '' })).toEqual({});
  });

  it('bounds the notes at 500 characters, and nothing else about them', () => {
    expect(messagesFor({ notes: 'x'.repeat(COMPLETION_NOTES_MAX_LENGTH) })).toEqual({});
    expect(messagesFor({ notes: 'x'.repeat(COMPLETION_NOTES_MAX_LENGTH + 1) }).notes).toEqual([
      COPY.completionNotesTooLong(COMPLETION_NOTES_MAX_LENGTH),
    ]);
  });

  it('says everything wrong at once, on the first press', () => {
    const byField = messagesFor({ ...completeWorkFormValues(), paymentStatus: 'PAID' });

    expect(Object.keys(byField).sort()).toEqual(['amount', 'paymentMethodId']);
    expect(Object.keys(messagesFor(completeWorkFormValues())).sort()).toEqual(['amount', 'paymentStatus']);
  });
});

describe('What the form sends', () => {
  it('sends a paid job with exactly these keys, in paise, in the configured currency', () => {
    const sent = buildCompletionInput(VALID);

    expect(sent).toEqual({
      finalAmountMinor: 125_050,
      currency: AppConfig.money.currency,
      paymentStatus: 'PAID',
      paymentMethodId: 'upi',
    });
    expect(Object.keys(sent ?? {}).sort()).toEqual([
      'currency',
      'finalAmountMinor',
      'paymentMethodId',
      'paymentStatus',
    ]);
    expect(AppConfig.money.currency).toBe('INR');
  });

  it('drops the method from a job not paid yet — absent, not null and not empty', () => {
    const sent = buildCompletionInput({ ...VALID, paymentStatus: 'UNPAID', paymentMethodId: 'upi' });

    expect(Object.keys(sent ?? {}).sort()).toEqual(['currency', 'finalAmountMinor', 'paymentStatus']);
    expect(sent).not.toHaveProperty('paymentMethodId');
    expect(JSON.stringify(sent)).not.toContain('upi');
  });

  it('sends the notes exactly as typed, and none when there are only spaces', () => {
    const typed = '  Replaced the MCB.\nCustomer to pay by UPI.  ';

    expect(buildCompletionInput({ ...VALID, notes: typed })?.notes).toBe(typed);
    expect(buildCompletionInput({ ...VALID, notes: '   \n ' })).not.toHaveProperty('notes');
    expect(buildCompletionInput({ ...VALID, notes: '' })).not.toHaveProperty('notes');
  });

  it('sends nothing for an amount it cannot read', () => {
    expect(buildCompletionInput({ ...VALID, amount: '1,250' })).toBeNull();
  });

  it('never carries a currency symbol or a display amount', () => {
    const wire = JSON.stringify(buildCompletionInput(VALID));

    expect(wire).not.toContain('₹');
    expect(wire).not.toContain('1,250');
    expect(wire).not.toContain('1250.50');
  });
});
