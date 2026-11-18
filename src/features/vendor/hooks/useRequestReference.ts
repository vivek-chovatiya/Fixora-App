/**
 * useRequestReference
 *
 * The reference people quote for the request a form was opened on — the
 * backend's `REQ-…` (`VendorJobSummary.reference`; request contract,
 * 17/11/2026) — or undefined, and the form draws no reference line: the id is
 * a database id nobody can quote (code review, 17/11/2026).
 *
 *   CompleteWork / RecordPayment → useRequestReference → VendorRequestService.getRequest
 *
 * The route carries the id and nothing else — ids travel, display data does
 * not — and the vendor app keeps no shared copy of the records it has read
 * (`VendorWorkSync` is deliberately a signal, not a store). So the form reads
 * the request once, through the same service call the details screen makes,
 * and shows the line once that read answers with a reference.
 *
 * ⚠️ Decoration, never a gate. A failed read leaves the line off and the form
 * works exactly as before; nothing waits on it and nothing retries it.
 * The failure is not hidden — the query logs it, as it logs every failed read.
 * It sends no `request_viewed` event — `useVendorRequestDetails` does, for the
 * details screen, and a form opened over it is not a second viewing.
 */

import { useCallback } from 'react';

import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { VendorRequestDetails } from '@/shared/services/types/VendorRequestService';

export function useRequestReference(requestId: string): string | undefined {
  const { data } = useSingleFlightQuery<VendorRequestDetails>(
    useCallback(() => getService('vendorRequests').getRequest(requestId), [requestId]),
    [requestId],
  );

  return data?.id === requestId && data.reference ? data.reference : undefined;
}
