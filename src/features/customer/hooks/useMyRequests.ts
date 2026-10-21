/**
 * useMyRequests
 *
 * The customer's requests, a page at a time (PROJECT_BIBLE.md section 23).
 *
 *   Screen → hook → RequestService interface → implementation
 *
 * The filter is sent to the service by name and a new filter starts the list
 * again from its first page. Nothing is filtered, sorted or remembered here: the
 * order is the service's, which view means what is the service's, and the list
 * holds no state of its own beyond this screen's life — no saved filter, no
 * saved scroll position, nothing on the device.
 *
 * Items are keyed by reference, so a request that appears on two pages — which
 * offset pages do when one is raised between two reads — is listed once.
 *
 * ⚠️ Read again when Request Details changes a request (`customerRequestSync`).
 * This tab stays mounted under it, and a request cancelled there must not come
 * back to a card still saying "Searching", nor to a Cancelled view still saying
 * it has none. Whether to read again on every focus is still the owner's open
 * question (3D-5); this answers only a change the app itself made.
 */

import { useEffect, useRef } from 'react';

import { onCustomerRequestsChanged } from '@/features/customer/state/customerRequestSync';
import { getService } from '@/shared/services/ServiceRegistry';
import type { CustomerRequest, RequestHistoryFilter } from '@/shared/services/types/RequestService';
import {
  usePaginatedQuery,
  type UsePaginatedQueryResult,
} from '@/shared/hooks/usePaginatedQuery';

function keyOf(request: CustomerRequest): string {
  return request.id;
}

export function useMyRequests(filter: RequestHistoryFilter): UsePaginatedQueryResult<CustomerRequest> {
  const query = usePaginatedQuery<CustomerRequest>(
    request => getService('request').listRequests(filter, request),
    [filter],
    { getKey: keyOf },
  );

  /*
    With requests on screen, read again under them, as a pull does. With none
    on screen — the first page still out, failed, or the view empty — from the
    start with its placeholders: a refresh keeps the empty list and clears the
    loading flag, so "No cancelled requests" would be drawn over the very read
    that is about to find one.
  */
  const hasItems = useRef(false);
  hasItems.current = query.items.length > 0;

  const { refresh, retry } = query;

  useEffect(
    () =>
      onCustomerRequestsChanged(() => {
        if (hasItems.current) {
          refresh();
        } else {
          retry();
        }
      }),
    [refresh, retry],
  );

  return query;
}
