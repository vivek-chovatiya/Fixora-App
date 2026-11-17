/**
 * useUpdateProfile
 *
 * Saves the Edit Profile form (PROJECT_BIBLE.md section 25, Phase 3D-8).
 *
 *   validated values → ProfileService → session written → session announced
 *
 * ⚠️ The session is updated from what the service returned, never from what was
 * typed. The backend normalises — it trims, it lower-cases an address, one day
 * it may reject a character — and adopting its answer is what keeps the screen
 * showing what is actually stored. Writing the form's own values into the
 * session would make the profile correct until the next launch.
 *
 * ⚠️ Nothing is written anywhere until the service succeeds. A failure leaves
 * the stored profile exactly as it was, which is what lets the form keep the
 * values the customer entered and offer Save again.
 */

import { useCallback } from 'react';

import { updateSessionUser } from '@/features/auth/state/authThunks';
import { useAppDispatch } from '@/app/hooks';
import type { ProfileFormValues } from '@/features/customer/validation/profileSchemas';
import { getService } from '@/shared/services/ServiceRegistry';
import type { CustomerProfileUpdate } from '@/shared/services/types/ProfileService';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';

/**
 * The form's shape is not the contract's.
 *
 * `optionalEmailSchema` resolves a blank box to `''` rather than to undefined,
 * deliberately, so that the form has one value type. Turning that empty string
 * into an absent field is this conversion's job — and absent is what tells the
 * backend the address was removed.
 */
export function buildProfileUpdate(values: ProfileFormValues): CustomerProfileUpdate {
  const email = values.email.trim();

  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    ...(email ? { email } : {}),
  };
}

export function useUpdateProfile() {
  const dispatch = useAppDispatch();

  const submit = useCallback(
    async (values: ProfileFormValues): Promise<void> => {
      const updated = await getService('profile').updateProfile(buildProfileUpdate(values));
      await updateSessionUser(dispatch, updated);
    },
    [dispatch],
  );

  return useServiceMutation<[ProfileFormValues], void>(submit);
}
