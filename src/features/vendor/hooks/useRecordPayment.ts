/**
 * useRecordPayment
 *
 * What the record-payment form needs (owner decision, 21/10/2026: a finished
 * job recorded "Not paid yet" may later be recorded "Paid"; PROJECT_BIBLE.md
 * section 37, the offline payment record): the payment methods the service
 * offers, and the recording itself.
 *
 *   usePaymentMethods → VendorRequestService.listPaymentMethods
 *   validated form → useVendorRequestDecision.recordPayment → VendorRequestService.recordPayment
 *
 * ⚠️ The completion form's twin, on purpose (`useCompleteWork`): the same
 * methods, read the same way, and the same one-at-a-time guard, toasts and
 * work-changed signal, because recording goes through
 * `useVendorRequestDecision` rather than a call of its own. Five presses send
 * one recording; the list and the dashboard hear of it.
 *
 * Recorded, never processed: nothing here takes or confirms money.
 */

import { useCallback } from 'react';

import { usePaymentMethods, type PaymentMethodsState } from '@/features/vendor/hooks/usePaymentMethods';
import {
  useVendorRequestDecision,
  type VendorDecisionOutcome,
} from '@/features/vendor/hooks/useVendorRequestDecision';
import type { VendorPaymentInput } from '@/shared/services/types/VendorRequestService';

export interface RecordPaymentState extends PaymentMethodsState {
  /** Sends the payment; resolves with what it came to (never rejects). */
  record: (payment: VendorPaymentInput) => Promise<VendorDecisionOutcome>;
  /** The payment is in the air. */
  isRecording: boolean;
}

export function useRecordPayment(requestId: string): RecordPaymentState {
  const methods = usePaymentMethods();

  const { recordPayment, isAnswering } = useVendorRequestDecision();

  const record = useCallback(
    (payment: VendorPaymentInput) => recordPayment(requestId, payment),
    [recordPayment, requestId],
  );

  return {
    ...methods,
    record,
    isRecording: isAnswering,
  };
}
