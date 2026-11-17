/**
 * useProfileImage
 *
 * The profile picture (PROJECT_BIBLE.md section 25, "Change Profile Image";
 * owner decisions of 2026-09-29).
 *
 *   pick → validate → compress → upload → attach to the account → session
 *
 * The pipeline, its one-at-a-time rule and its failure handling are
 * `useImageUpload`'s, shared with the vendor's business picture (Phase 3E-1).
 * What is the customer's is the last step: the uploaded URL goes on the account
 * through `ProfileService`, and the session adopts what the service returns.
 *
 * ⚠️ The account is changed last, and only if everything before it worked — so
 * the avatar on Profile shows the stored picture until a new one is genuinely
 * stored, never the local file that is still on its way.
 */

import { useCallback } from 'react';

import { useAppDispatch } from '@/app/hooks';
import { updateSessionUser } from '@/features/auth/state/authThunks';
import {
  useImageUpload,
  type ImageUpload,
  type ImageUploadStatus,
} from '@/shared/hooks/useImageUpload';
import { getService } from '@/shared/services/ServiceRegistry';

/** What the screen is doing, so it can say so. */
export type ProfileImageStatus = ImageUploadStatus;

export type ProfileImage = ImageUpload;

export function useProfileImage(): ProfileImage {
  const dispatch = useAppDispatch();

  const attach = useCallback(
    async (remoteUrl: string) => {
      const updated = await getService('profile').setProfileImage(remoteUrl);
      await updateSessionUser(dispatch, updated);
    },
    [dispatch],
  );

  const detach = useCallback(async () => {
    const updated = await getService('profile').removeProfileImage();
    await updateSessionUser(dispatch, updated);
  }, [dispatch]);

  return useImageUpload({ attach, detach });
}
