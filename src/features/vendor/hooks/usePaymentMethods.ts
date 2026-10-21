/**
 * usePaymentMethods
 *
 * The ways a customer can have paid, as the service offers them
 * (PROJECT_BIBLE.md section 37: "The exact supported methods must follow
 * backend configuration").
 *
 *   VendorRequestService.listPaymentMethods
 *
 * Moved out of `useCompleteWork` on 21/10/2026, when recording a payment after
 * the job (`useRecordPayment`) became its second reader: two forms asking for
 * the same field must read its options the same way.
 *
 * ⚠️ Read once when the form opens, through `useSingleFlightQuery`, so Try
 * again cannot stack reads and its guard cannot stick. A failure belongs to the
 * method field alone — the error is null once the methods have been read, so
 * a later failed retry never hides options the vendor can already see.
 */

import { useCallback } from 'react';

import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { PaymentMethodOption } from '@/shared/services/types/VendorRequestService';
import type { AppError } from '@/shared/types/error';

export interface PaymentMethodsState {
  /** The ways a customer can have paid, once read. */
  methods: PaymentMethodOption[] | undefined;
  isLoadingMethods: boolean;
  /** The methods could not be read. Null once they have been. */
  methodsError: AppError | null;
  retryMethods: () => void;
}

export function usePaymentMethods(): PaymentMethodsState {
  const methods = useSingleFlightQuery<PaymentMethodOption[]>(
    useCallback(() => getService('vendorRequests').listPaymentMethods(), []),
    [],
  );

  return {
    methods: methods.data,
    isLoadingMethods: methods.isLoading,
    methodsError: methods.data === undefined ? methods.error : null,
    retryMethods: methods.retry,
  };
}
