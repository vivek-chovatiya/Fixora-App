/**
 * useCompleteWork
 *
 * What the completion form needs (PROJECT_BIBLE.md sections 36 and 37): the
 * payment methods the service offers, and the completion itself.
 *
 *   usePaymentMethods → VendorRequestService.listPaymentMethods
 *   validated form → useVendorRequestDecision.complete → VendorRequestService.completeRequest
 *
 * ⚠️ The methods are the service's, never the app's (section 37: "must follow
 * backend configuration"). They are read once when the form opens
 * (`usePaymentMethods`, shared with recording a payment later), so Try again
 * cannot stack reads and its guard cannot stick. A failure belongs to the
 * method field alone: the rest of the form keeps working and keeps what was
 * typed, and a job not paid yet needs no method at all.
 *
 * ⚠️ Completing goes through `useVendorRequestDecision`, not a call of its own.
 * That is what makes it say done, changed or failed in exactly the words every
 * other action uses, tell the list and the dashboard the work changed, and wait
 * behind the same one-at-a-time guard — five confirms send one completion.
 */

import { useCallback } from 'react';

import { usePaymentMethods, type PaymentMethodsState } from '@/features/vendor/hooks/usePaymentMethods';
import {
  useVendorRequestDecision,
  type VendorDecisionOutcome,
} from '@/features/vendor/hooks/useVendorRequestDecision';
import type { VendorCompletionInput } from '@/shared/services/types/VendorRequestService';

export interface CompleteWorkState extends PaymentMethodsState {
  /** Sends the completion; resolves with what it came to (never rejects). */
  complete: (completion: VendorCompletionInput) => Promise<VendorDecisionOutcome>;
  /** The completion is in the air. */
  isCompleting: boolean;
}

export function useCompleteWork(requestId: string): CompleteWorkState {
  const methods = usePaymentMethods();

  const { complete: completeRequest, isAnswering } = useVendorRequestDecision();

  const complete = useCallback(
    (completion: VendorCompletionInput) => completeRequest(requestId, completion),
    [completeRequest, requestId],
  );

  return {
    ...methods,
    complete,
    isCompleting: isAnswering,
  };
}
