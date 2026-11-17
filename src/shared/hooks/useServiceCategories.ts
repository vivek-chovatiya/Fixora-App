/**
 * useServiceCategories
 *
 * The service catalogue, for `ServiceCategoryField` — the vendor's "services
 * offered" choice on registration and on profile setup.
 *
 *   ServiceCategoryField → this hook → CategoryService interface → implementation
 *
 * It exists so the field never reaches the service registry itself (CLAUDE.md
 * section 4: UI calls a hook). The field is shared by two features, auth and
 * vendor, so the hook is shared too; a copy in each would be two places to
 * change when the backend lands.
 *
 * ⚠️ Not the customer's `useCategories`, and not to be merged into it. That one
 * turns a failed refresh into a stale notice for the screens that draw the
 * whole catalogue; the field has no refresh and shows its own loading, error and
 * Try again. This returns the plain query, exactly as the field read it before
 * the move — same fetch, same states, no filtering, sorting or renaming
 * (PROJECT_BIBLE.md section 11: the backend decides which categories exist).
 */

import { useServiceQuery, type UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { ServiceCategory } from '@/shared/services/types/CategoryService';

export function useServiceCategories(): UseServiceQueryResult<ServiceCategory[]> {
  return useServiceQuery<ServiceCategory[]>(
    () => getService('category').listServiceCategories(),
    [],
  );
}
