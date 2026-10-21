/**
 * useCheckedVendorChoice
 *
 * The eligible professionals for a service, with the draft's own professional
 * checked against them (PROJECT_BIBLE.md section 18A; Phase 3D-12).
 *
 *   Screen → this hook → useEligibleVendors → VendorService interface
 *
 * ⚠️ The rule it keeps: a request is never sent with a preferred professional
 * who is not in the latest eligible list for its service. A resumed or
 * restored draft can name one who stopped being eligible after it was saved.
 * So when the list has loaded and does not have them, they are taken off the
 * draft (`withdrawVendor`), the vendor question is open again, and Preferred
 * Vendor says so in one sentence. While the list is being read, or its read
 * failed, nothing can be known: nothing is cleared — and `isChoiceConfirmed`
 * stays false, so Request Confirmation sends no professional it has not seen
 * in a loaded list.
 *
 * Shared by the two screens that hold a choice and read the list. Each reads
 * it for itself — the confirmation's read is the latest one when Submit is
 * pressed — and whichever settles first takes an unavailable professional off.
 * There is one draft, so the other then finds the question open, and the flag
 * on the draft context (`isVendorWithdrawn`) is how Preferred Vendor knows to
 * say why even when it was the confirmation that found them gone.
 *
 * It filters nothing and orders nothing: the list reaches the screen exactly as
 * the backend sent it (18A.2). It only asks whether the one identifier the
 * draft holds is in it.
 */

import { useEffect } from 'react';

import { useEligibleVendors } from '@/features/customer/hooks/useEligibleVendors';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import {
  NO_VENDOR_CHOICE,
  vendorChoiceStanding,
  type VendorChoiceStanding,
} from '@/features/customer/state/requestDraft';
import type { UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import type { EligibleVendor } from '@/shared/services/types/VendorService';

export interface CheckedVendorChoice {
  /** The list, untouched, for the screen to draw. */
  vendors: UseServiceQueryResult<EligibleVendor[]>;
  /** Where the draft's professional stands against the list as it is now. */
  standing: VendorChoiceStanding;
  /**
   * Whether the draft's answer may be sent as it stands: no professional named,
   * or one the latest loaded list has.
   */
  isChoiceConfirmed: boolean;
  /**
   * The draft's professional was taken off because the latest list no longer
   * has them, and the question has not been answered since.
   */
  wasWithdrawn: boolean;
}

export function useCheckedVendorChoice(
  categoryId: string,
  subCategoryId: string,
): CheckedVendorChoice {
  const vendors = useEligibleVendors(categoryId, subCategoryId);
  const { draft, withdrawVendor, isVendorWithdrawn } = useRequestDraft();
  const choice = draft?.vendor ?? NO_VENDOR_CHOICE;

  // The list only once it has settled. A read in the air, or one that failed,
  // says nothing about who is eligible now — even with an older list still held.
  const settled =
    vendors.isLoading || vendors.isRefreshing || vendors.error !== null
      ? undefined
      : vendors.data;
  const standing = vendorChoiceStanding(choice, settled);

  const unavailableId =
    standing === 'unavailable' && choice.kind === 'vendor' ? choice.vendorId : null;

  useEffect(() => {
    if (unavailableId !== null) {
      withdrawVendor(unavailableId);
    }
  }, [unavailableId, withdrawVendor]);

  return {
    vendors,
    standing,
    isChoiceConfirmed: standing === 'unnamed' || standing === 'available',
    // Cleared by the context the moment the question is answered again.
    wasWithdrawn: isVendorWithdrawn,
  };
}
