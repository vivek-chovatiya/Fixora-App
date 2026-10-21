/**
 * Payment words
 *
 * How a recorded payment status is said — to whoever is looking (PROJECT_BIBLE.md
 * sections 36 and 37). The vendor records it when they complete a job and the
 * customer reads it back on the same request, so the words are written once:
 * "Paid · UPI" to the professional must be "Paid · UPI" to the customer, for
 * the reason the priorities and the ratings are shared (`requestTokens`,
 * `rating`).
 *
 * ⚠️ Recorded, never processed (section 37). Nothing here says a payment was
 * taken, confirmed or settled by Fixora; each phrase is what somebody told the
 * app. "Paid" means the professional said the customer paid them.
 *
 * ⚠️ It maps, it never decides. A status the table does not know reads
 * "Payment status unavailable" — the vendor side's rule for a request status it
 * has never seen (`jobPresentation`) — rather than a tidied backend constant
 * passed off as a Fixora word, and with no method beside it, because "how they
 * paid" means nothing under a status nobody worded.
 */

import {
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_UNPAID,
} from '@/shared/services/types/VendorRequestService';

export const PAYMENT_COPY = Object.freeze({
  paid: 'Paid',
  /** "Yet": the record is a moment in the job, and paying later is normal. */
  unpaid: 'Not paid yet',
  unavailable: 'Payment status unavailable',
  /** Between the status and how it was paid: "Paid · UPI". */
  methodSeparator: ' · ',
});

const STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  [PAYMENT_STATUS_PAID]: PAYMENT_COPY.paid,
  [PAYMENT_STATUS_UNPAID]: PAYMENT_COPY.unpaid,
});

function normalise(status: string): string {
  return typeof status === 'string' ? status.trim().toUpperCase() : '';
}

/** Whether a recorded status says the customer has paid. Case and padding forgiven. */
export function isPaidStatus(status: string): boolean {
  return normalise(status) === PAYMENT_STATUS_PAID;
}

/**
 * Whether a recorded status says the customer has not paid yet — the one
 * record a vendor may later change to paid (owner decision, 21/10/2026).
 *
 * ⚠️ Not `!isPaidStatus`: a status the table does not know is neither, and
 * offering to change a record nobody can read would be a guess about it.
 */
export function isUnpaidStatus(status: string): boolean {
  return normalise(status) === PAYMENT_STATUS_UNPAID;
}

/** A payment status in words: "Paid", "Not paid yet", or that it cannot be shown. */
export function presentPaymentStatus(status: string): string {
  return STATUS_LABELS[normalise(status)] ?? PAYMENT_COPY.unavailable;
}

/**
 * The status, and how it was paid when it was: "Paid · UPI", "Not paid yet".
 *
 * The method is said only beside "Paid" — a method recorded against an unpaid
 * job is a contradiction, and the status is the part to trust — and only when
 * the record names one.
 */
export function describePayment(status: string, methodLabel?: string): string {
  const label = presentPaymentStatus(status);
  const method = methodLabel?.trim();

  return isPaidStatus(status) && method ? `${label}${PAYMENT_COPY.methodSeparator}${method}` : label;
}
