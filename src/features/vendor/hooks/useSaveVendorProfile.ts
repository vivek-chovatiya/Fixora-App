/**
 * useSaveVendorProfile
 *
 *   validated form → VendorProfileService.saveProfile → adopt the stored profile
 *
 * Adopting is what finishes setup: the navigator reads `isSetupComplete` from the
 * adopted profile and swaps setup for the vendor application on its own. A
 * failure adopts nothing, so the form keeps every value and Save is the retry.
 *
 * One save at a time. `isSubmitting` disables the button, but state lands a
 * render late and two quick presses can both get in before it does, so the ref
 * is what actually refuses the second one.
 *
 * ⚠️ The save waits its turn in the vendor's profile line (`inLine`) and is
 * adopted inside that turn, like every shop-image change. A shop image still
 * saving when the vendor left its screen may answer after this form is saved;
 * adopting out of line would put the old business back on Profile.
 */

import { useCallback, useRef } from 'react';

import { useVendorProfile } from '@/features/vendor/state/VendorProfileContext';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { getService } from '@/shared/services/ServiceRegistry';
import type {
  VendorProfile,
  VendorProfileUpdate,
} from '@/shared/services/types/VendorProfileService';
import type { AppError } from '@/shared/types/error';

export interface SaveVendorProfile {
  /** Resolves with the stored profile, or null when saving failed or was already running. */
  save: (update: VendorProfileUpdate) => Promise<VendorProfile | null>;
  isSaving: boolean;
  error: AppError | null;
}

export function useSaveVendorProfile(): SaveVendorProfile {
  const { adopt, inLine } = useVendorProfile();
  const mutation = useServiceMutation<[VendorProfileUpdate], VendorProfile>(
    useCallback(
      (update: VendorProfileUpdate) =>
        inLine(async () => {
          const saved = await getService('vendorProfile').saveProfile(update);
          adopt(saved);
          return saved;
        }),
      [adopt, inLine],
    ),
  );
  const { mutate } = mutation;

  const inFlight = useRef(false);

  const save = useCallback(
    async (update: VendorProfileUpdate) => {
      if (inFlight.current) {
        return null;
      }
      inFlight.current = true;
      try {
        // Adopted inside its turn (above); null when it failed.
        return await mutate(update);
      } finally {
        inFlight.current = false;
      }
    },
    [mutate],
  );

  return { save, isSaving: mutation.isSubmitting, error: mutation.error };
}
