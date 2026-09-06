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
 */

import { useServiceQuery, type UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { ServiceCategory } from '@/shared/services/types/CategoryService';

export function useCategories(): UseServiceQueryResult<ServiceCategory[]> {
  return useServiceQuery<ServiceCategory[]>(
    () => getService('category').listServiceCategories(),
    [],
  );
}
