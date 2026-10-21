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
 * it has none. That answers a change the app itself made.
 *
 * ⚠️ Read again, quietly, whenever the tab is shown again (Phase 3E-15 — the
 * owner's answer to 3D-5's open question, 21/10/2026): a status changed on the
 * server while the tab stayed mounted used to wait for a pull. Not on arrival,
 * which the mount has just read. Quiet: no placeholders and no spinner, the
 * filter and the list left as they are until the answer, every page on screen
 * read again in one request so a list scrolled into its second page is not cut
 * back to its first, and nothing sent while a load is out
 * (`usePaginatedQuery.refreshQuietly`). A failed quiet read keeps the list and
 * says so under it, as a failed pull does.
 */

import { useEffect, useRef } from 'react';

import { onCustomerRequestsChanged } from '@/features/customer/state/customerRequestSync';
import { useNavigationEvent } from '@/shared/hooks/useNavigationEvent';
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

  // The tab shown again: read under what is on screen. Not on arrival — that read is the load.
  useNavigationEvent('focus', query.refreshQuietly, { onlyOnReturn: true });

  return query;
}
