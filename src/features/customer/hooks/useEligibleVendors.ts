/**
 * useEligibleVendors
 *
 * The vendors the backend will offer for this service.
 *
 *   Screen → hook → VendorService interface → implementation
 *
 * ⚠️ It reads and hands over. PROJECT_BIBLE.md section 18A.1 gives eligibility,
 * ranking, availability and assignment to the backend, and 18A.2 leaves the app
 * presenting the list in the order it arrives — so there is no sort here, no
 * filter, and no derived field. The thinnest hook in the module, on purpose:
 * anything it added would be something section 18A forbids.
 *
 * Failure is not fatal and emptiness is not failure. Section 18A.4 requires both
 * to leave submission open, so the screen renders either one beside a "no
 * preference" option that is always available — which is why this exposes the
 * query rather than deciding anything about it.
 */

import { useServiceQuery, type UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { EligibleVendor } from '@/shared/services/types/VendorService';

export function useEligibleVendors(
  categoryId: string,
  subCategoryId: string,
): UseServiceQueryResult<EligibleVendor[]> {
  return useServiceQuery<EligibleVendor[]>(
    () => getService('vendor').listEligibleVendors(categoryId, subCategoryId),
    [categoryId, subCategoryId],
  );
}
