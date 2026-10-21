/**
 * useSaveWorkingHours
 *
 *   the screen's week → VendorProfileService.updateWorkingHours → adopt the stored profile
 *
 * (PROJECT_BIBLE.md section 38, "Working Hours".) The service answers with the
 * whole stored profile, and adopting it is what the Profile tab's summary
 * shows when the vendor comes back — no read of its own.
 *
 * ⚠️ The save waits its turn in the vendor's profile line (`inLine`) and is
 * adopted inside that turn, like every other read and change of the profile
 * (Phase 3E-10): a shop-image save or an availability change still in the air
 * cannot answer after it with a profile holding the old week.
 *
 * ⚠️ One save at a time. `isSaving` locks the button, but state lands a render
 * late and two quick presses can both get in before it does, so the ref is
 * what refuses the second one — released in a `finally`, so a failure never
 * leaves Save dead. A failure adopts nothing and keeps the screen's week; Save
 * is the retry. Success is said here, once, as a toast; leaving is the screen's.
 */

import { useCallback, useRef } from 'react';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useVendorProfile } from '@/features/vendor/state/VendorProfileContext';
import { useToast } from '@/shared/components';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { getService } from '@/shared/services/ServiceRegistry';
import type {
  VendorProfile,
  VendorWorkingDay,
} from '@/shared/services/types/VendorProfileService';
import type { AppError } from '@/shared/types/error';

const COPY = VENDOR_COPY.workingHours;

export interface SaveWorkingHours {
  /** Resolves with the stored profile, or null when saving failed or was already running. */
  save: (days: VendorWorkingDay[]) => Promise<VendorProfile | null>;
  isSaving: boolean;
  error: AppError | null;
  /**
   * Whether a save is running at this moment. Read from the ref, so it is true
   * from the instant a save starts — before `isSaving` has landed — for the
   * screen's leave guard.
   */
  isBusy: () => boolean;
}

export function useSaveWorkingHours(): SaveWorkingHours {
  const { adopt, inLine } = useVendorProfile();
  const { showToast } = useToast();

  const mutation = useServiceMutation<[VendorWorkingDay[]], VendorProfile>(
    useCallback(
      (days: VendorWorkingDay[]) =>
        inLine(async () => {
          const saved = await getService('vendorProfile').updateWorkingHours(days);
          adopt(saved);
          return saved;
        }),
      [adopt, inLine],
    ),
  );
  const { mutate } = mutation;

  const inFlight = useRef(false);

  const save = useCallback(
    async (days: VendorWorkingDay[]) => {
      if (inFlight.current) {
        return null;
      }
      inFlight.current = true;
      try {
        // Adopted inside its turn (above); null when it failed.
        const saved = await mutate(days);
        if (saved) {
          showToast({ message: COPY.saved, tone: 'success', icon: 'success' });
        }
        return saved;
      } finally {
        inFlight.current = false;
      }
    },
    [mutate, showToast],
  );

  const isBusy = useCallback(() => inFlight.current, []);

  return { save, isSaving: mutation.isSubmitting, error: mutation.error, isBusy };
}
