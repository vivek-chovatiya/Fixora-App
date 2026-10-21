/**
 * Complete work form schema (PROJECT_BIBLE.md sections 36 and 37).
 *
 * The rules a vendor's completion is held to before it is sent: the final
 * amount, whether the customer has paid, how — only when they have — and
 * optional notes. They are the service's rules said to a person (the mock
 * checks the same ones), with each message beside its own field (section 49).
 *
 * ⚠️ Money is read as text and never through floating point. "1250.50" is
 * split at the point and its digits joined — 125050 paise — so no amount is
 * ever `parseFloat(text) * 100`, which turns 1.15 into 114.99999999999999.
 *
 * ⚠️ Strict about what an amount looks like, on purpose: digits, and at most
 * one point with one or two digits after it. "1,000" is refused rather than
 * read, because a comma is a thousands separator to one person and a decimal
 * point to another, and guessing wrong records a hundredfold mistake. Spaces
 * around the figure are forgiven — they are not part of a number.
 *
 * ⚠️ Notes are bounded, never altered (the customer notes rule): sent exactly
 * as typed, and left out when there is nothing but space in them.
 */

import { z } from 'zod';

import { AppConfig } from '@/core/config/AppConfig';
import { SELECTABLE_PAYMENT_STATUSES } from '@/features/vendor/constants/paymentPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { formatMoney } from '@/shared/presentation/money';
import {
  COMPLETION_NOTES_MAX_LENGTH,
  FINAL_AMOUNT_MAX_MINOR,
  PAYMENT_STATUS_PAID,
  type VendorCompletionInput,
} from '@/shared/services/types/VendorRequestService';

const COPY = VENDOR_COPY.validation;

/** Minor units per major unit, as digits: two, paise per rupee (`money.ts`). */
const MINOR_DIGITS = 2;

/** Digits, then optionally a point and one or two more digits. Nothing else. */
const AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/** The most whole-unit digits an amount within the ceiling can have: 7, for 10,00,000. */
const MAX_WHOLE_DIGITS = String(FINAL_AMOUNT_MAX_MINOR).length - MINOR_DIGITS;

/** What was typed, read: an amount in minor units, or why it is not one. */
export type AmountReading =
  | { ok: true; amountMinor: number }
  | { ok: false; problem: 'empty' | 'format' | 'tooSmall' | 'tooLarge' };

/**
 * Reads a typed amount into whole minor units, by splitting the text.
 *
 * "1250" → 125000, "1250.5" → 125050, "1250.50" → 125050, "  12 " → 1200.
 * Refused: "" (empty), "1.234" / "abc" / "1,000" / "-5" / ".5" (format),
 * "0" and "0.00" (too small), anything over `FINAL_AMOUNT_MAX_MINOR` (too large).
 */
export function readAmount(typed: string): AmountReading {
  const text = typeof typed === 'string' ? typed.trim() : '';
  if (!text) {
    return { ok: false, problem: 'empty' };
  }

  const match = AMOUNT_PATTERN.exec(text);
  if (!match) {
    return { ok: false, problem: 'format' };
  }

  const whole = match[1].replace(/^0+(?=\d)/, '');
  // Too many digits to be within the ceiling whatever they are: refused while
  // still text, before they become a number too large to hold exactly.
  if (whole.length > MAX_WHOLE_DIGITS) {
    return { ok: false, problem: 'tooLarge' };
  }

  const amountMinor = Number(`${whole}${(match[2] ?? '').padEnd(MINOR_DIGITS, '0')}`);
  if (amountMinor <= 0) {
    return { ok: false, problem: 'tooSmall' };
  }
  if (amountMinor > FINAL_AMOUNT_MAX_MINOR) {
    return { ok: false, problem: 'tooLarge' };
  }

  return { ok: true, amountMinor };
}

/** A typed amount in whole minor units, or null when it is not a valid one. */
export function parseAmountToMinor(typed: string): number | null {
  const reading = readAmount(typed);
  return reading.ok ? reading.amountMinor : null;
}

/** Built when asked for, so the ceiling is written in the configured currency. */
const AMOUNT_MESSAGES: Readonly<Record<Exclude<AmountReading, { ok: true }>['problem'], () => string>> = {
  empty: () => COPY.amountRequired,
  format: () => COPY.amountFormat,
  tooSmall: () => COPY.amountTooSmall,
  tooLarge: () => COPY.amountTooLarge(formatMoney(FINAL_AMOUNT_MAX_MINOR, AppConfig.money.currency)),
};

export const completeWorkSchema = z
  .object({
    amount: z.string().superRefine((value, context) => {
      const reading = readAmount(value);
      if (!reading.ok) {
        context.addIssue({ code: 'custom', message: AMOUNT_MESSAGES[reading.problem]() });
      }
    }),

    /**
     * Required, with no default: whether somebody has been paid is the one
     * answer on this form that must never be given by not looking.
     */
    paymentStatus: z
      .string()
      .refine(value => SELECTABLE_PAYMENT_STATUSES.includes(value), COPY.paymentStatusRequired),

    /** Checked against the status below: required when paid, ignored otherwise. */
    paymentMethodId: z.string(),

    notes: z
      .string()
      .max(COMPLETION_NOTES_MAX_LENGTH, COPY.completionNotesTooLong(COMPLETION_NOTES_MAX_LENGTH)),
  })
  /*
    Beside the method field, not the status: it is the method that is missing.
    Zod runs this even when another field has failed, so every message shows on
    the first press rather than one at a time.
  */
  .superRefine((values, context) => {
    if (values.paymentStatus === PAYMENT_STATUS_PAID && !values.paymentMethodId) {
      context.addIssue({
        code: 'custom',
        path: ['paymentMethodId'],
        message: COPY.paymentMethodRequired,
      });
    }
  });

export type CompleteWorkForm = z.infer<typeof completeWorkSchema>;

/** What the form opens with: nothing chosen, nothing typed. A fresh object each time. */
export function completeWorkFormValues(): CompleteWorkForm {
  return { amount: '', paymentStatus: '', paymentMethodId: '', notes: '' };
}

/**
 * The form's values as the service's input — or null if the amount cannot be
 * read, which a form that has passed the schema never sends.
 *
 * ⚠️ Exact keys. `paymentMethodId` is absent unless the customer paid — a
 * method chosen and then "Not paid yet" picked is dropped, not sent — and
 * `notes` is absent unless something was written. Neither is ever null or "".
 */
export function buildCompletionInput(
  values: CompleteWorkForm,
  currency: string = AppConfig.money.currency,
): VendorCompletionInput | null {
  const amountMinor = parseAmountToMinor(values.amount);
  if (amountMinor === null) {
    return null;
  }

  const paid = values.paymentStatus === PAYMENT_STATUS_PAID;

  return {
    finalAmountMinor: amountMinor,
    currency,
    paymentStatus: values.paymentStatus,
    ...(paid && values.paymentMethodId ? { paymentMethodId: values.paymentMethodId } : {}),
    ...(values.notes.trim().length > 0 ? { notes: values.notes } : {}),
  };
}
