/**
 * Payment presentation
 *
 * The payment choices a vendor is offered when completing a job, and the words
 * a recorded payment is shown in (PROJECT_BIBLE.md sections 36 and 37).
 *
 * ⚠️ The words are shared, not the vendor's own. "Paid · UPI" is the same
 * phrase to the professional who recorded it and the customer who reads it
 * back, so `presentPaymentStatus` and `describePayment` live in
 * `shared/presentation/payment` and are re-exported here, as the customer
 * module re-exports the shared priorities.
 *
 * ⚠️ A list to offer, not a truth to match. The two statuses below are what
 * this app sends; what it reads back still goes through a table that falls back
 * to "Payment status unavailable" for anything else. The payment methods are not
 * here at all — they come from the service (section 37: "must follow backend
 * configuration").
 */

import {
  describePayment,
  isPaidStatus,
  PAYMENT_COPY,
  presentPaymentStatus,
} from '@/shared/presentation/payment';
import {
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_UNPAID,
} from '@/shared/services/types/VendorRequestService';

export { describePayment, isPaidStatus, PAYMENT_COPY, presentPaymentStatus };

/**
 * The payment statuses a vendor chooses between, in the order offered: paid
 * first, because it is the usual end of a job — but neither is preselected, so
 * nobody records "paid" by not looking.
 */
export const SELECTABLE_PAYMENT_STATUSES: readonly string[] = Object.freeze([
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_UNPAID,
]);
