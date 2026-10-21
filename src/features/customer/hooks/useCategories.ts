/**
 * useCategories
 *
 * The service catalogue, and the seam screens are allowed to touch.
 *
 *   Screen → hook → CategoryService interface → implementation
 *
 * One hook rather than one per screen. Home shows a preview and the categories
 * screen shows the lot, but both are asking the same question of the same
 * service — and two call sites reaching for `getService` themselves is how a
 * second screen ends up quietly fetching differently from the first.
 *
 * ⚠️ Nothing here filters, sorts, ranks or renames. The backend decides which
 * categories exist and what order they come in (PROJECT_BIBLE.md section 11), so
 * a "popular first" or an alphabetical sort applied here would be the app
 * inventing a business rule nobody asked it for.
 *
 * ⚠️ A failed pull says so, as the vendor's lists do (3E-3). The shared query
 * keeps the categories when a refresh fails, which is right — a customer
 * mid-scroll should not be handed a blank screen — but on its own it keeps them
 * silently, and both screens drawing this used to show nothing at all (the
 * catalogue) or swap a working grid for an error (Home). `error` is now only a
 * failure that left nothing to show; a failure with categories on screen is
 * `isStale`, for a notice above them — the shared `useStaleState` rule. The
 * shared query is unchanged.
 */

import { useServiceQuery, type UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import { useStaleState } from '@/shared/hooks/useStaleState';
import { getService } from '@/shared/services/ServiceRegistry';
import type { ServiceCategory } from '@/shared/services/types/CategoryService';
import type { AppError } from '@/shared/types/error';

export interface Catalogue extends UseServiceQueryResult<ServiceCategory[]> {
  /** The last refresh failed; the categories on screen are from before it. */
  isStale: boolean;
  /** Why the refresh failed, for the notice. Null unless `isStale`. */
  staleError: AppError | null;
}

export function useCategories(): Catalogue {
  const query = useServiceQuery<ServiceCategory[]>(
    () => getService('category').listServiceCategories(),
    [],
  );

  // With categories on screen a failure is a stale list, not an error page.
  const stale = useStaleState({
    hasData: query.data !== undefined,
    error: query.error,
    isRefreshing: query.isRefreshing,
  });

  return {
    ...query,
    error: stale.error,
    isError: stale.error !== null,
    isStale: stale.isStale,
    staleError: stale.staleError,
  };
}
