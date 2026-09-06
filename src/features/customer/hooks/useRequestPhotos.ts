/**
 * useRequestPhotos
 *
 * The photographs attached to a request (PROJECT_BIBLE.md section 16).
 *
 *   Screen → hook → ImageService / PermissionService → implementation
 *
 * ⚠️ Uploading happens as each photo is added, not at submit. Section 16 is
 * blunt about why: a customer must never believe a request went in with images
 * that failed to upload. Doing it here means a failure is visible on the
 * thumbnail that caused it, with retry beside it, while the customer is still
 * looking at the form — rather than arriving as one opaque failure after they
 * have pressed Submit, with nothing to say which photo it was.
 *
 * The screen therefore submits URLs, never files, and refuses to submit at all
 * while anything is still uploading or has failed. That refusal is the contract
 * this hook exists to make possible.
 *
 * Nothing is asked for on mount. A camera permission dialog that appears because
 * a screen opened teaches people to dismiss dialogs; it is requested when
 * somebody asks for the camera and not before.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { AppConfig } from '@/core/config/AppConfig';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { getService } from '@/shared/services/ServiceRegistry';
import type {
  ImageAsset,
  ImageSource,
  UploadStatus,
} from '@/shared/services/types/ImageService';

const COPY = CUSTOMER_COPY.createRequest;

/** One attached photograph and how far its upload has got. */
export interface RequestPhoto {
  asset: ImageAsset;
  status: UploadStatus;
  /** 0-1, as reported by the image service. */
  progress: number;
  /** Set once the upload succeeds. This, and only this, reaches the payload. */
  remoteUrl?: string;
}

export interface RequestPhotos {
  photos: readonly RequestPhoto[];
  /** The URLs of every photo that finished uploading, in the order added. */
  uploadedUrls: string[];
  /** True while any upload is in flight. */
  isUploading: boolean;
  /** True when a photo failed and has been neither retried nor removed. */
  hasFailures: boolean;
  /** False once the per-request ceiling is reached. */
  canAddMore: boolean;
  /**
   * The most recent thing the customer needs telling: a refused camera, a file
   * too large, a ceiling reached. Cleared as soon as they act again.
   */
  notice: string | null;
  add: (source: ImageSource) => void;
  remove: (assetId: string) => void;
  retry: (assetId: string) => void;
}

const MAX_PHOTOS = AppConfig.image.maxUploadsPerRequest;

function fill(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

export function useRequestPhotos(): RequestPhotos {
  const [photos, setPhotos] = useState<readonly RequestPhoto[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Applies a change to one photo, leaving the rest and the order alone. */
  const patch = useCallback((assetId: string, change: Partial<RequestPhoto>) => {
    if (!mountedRef.current) {
      return;
    }
    setPhotos(current =>
      current.map(photo => (photo.asset.id === assetId ? { ...photo, ...change } : photo)),
    );
  }, []);

  const upload = useCallback(
    async (asset: ImageAsset, isRetry: boolean) => {
      const service = getService('image');
      patch(asset.id, { status: 'uploading', progress: 0 });

      try {
        const result = await (isRetry
          ? service.retryUpload(asset, state => patch(asset.id, { progress: state.progress }))
          : service.upload(asset, state => patch(asset.id, { progress: state.progress })));

        patch(asset.id, { status: 'success', progress: 1, remoteUrl: result.remoteUrl });
      } catch {
        /*
          Marked on the thumbnail, not raised as a screen error.

          The failure belongs to one photograph and has one remedy the customer
          can apply themselves — retry it, or take it off the request. An
          ErrorState across the form would say the whole request had failed,
          which it has not, and would bury the fact that the rest of what they
          typed is still there.

          Nothing from the caught value is shown or kept. The thumbnail says the
          upload failed; why it failed is a developer's question.
        */
        patch(asset.id, { status: 'failed', progress: 0 });
      }
    },
    [patch],
  );

  const add = useCallback(
    (source: ImageSource) => {
      setNotice(null);

      void (async () => {
        const remaining = MAX_PHOTOS - photos.length;
        if (remaining <= 0) {
          setNotice(fill(COPY.photosLimitReached, MAX_PHOTOS));
          return;
        }

        if (source === 'camera') {
          /*
            Asked for here, at the moment the camera is wanted.

            `blocked` and `denied` are told apart by the service and deliberately
            not told apart by the customer: one means they said no and one means
            the system will no longer ask, and in both cases the useful next
            sentence is the same — the gallery is right there. Sending someone to
            Settings to grant a permission for an optional photograph is a
            longer detour than the photograph is worth.
          */
          const status = await getService('permission').request('camera');
          if (status !== 'granted') {
            if (mountedRef.current) {
              setNotice(COPY.cameraUnavailable);
            }
            return;
          }
        }

        const service = getService('image');

        let picked: ImageAsset[];
        try {
          picked =
            source === 'camera'
              ? await service.pickFromCamera({ maxCount: remaining })
              : await service.pickFromGallery({ maxCount: remaining });
        } catch {
          // Includes the ordinary case of someone opening the picker and
          // changing their mind, which is not a failure worth a message.
          return;
        }

        if (!mountedRef.current || picked.length === 0) {
          return;
        }

        /*
          Validated before it is shown, not after it is uploaded.

          `ImageService.validate` enforces the size and type rules in AppConfig
          and returns the reason. A file that fails is never added, so the
          customer is not left looking at a thumbnail that is going to fail —
          and the message is the service's, because it is the service that knows
          which rule was broken.
        */
        const accepted: ImageAsset[] = [];
        let rejection: string | null = null;

        for (const asset of picked.slice(0, remaining)) {
          const result = service.validate(asset);
          if (result.valid) {
            accepted.push(asset);
          } else if (!rejection) {
            rejection = result.message ?? null;
          }
        }

        if (rejection) {
          setNotice(rejection);
        }

        if (accepted.length === 0) {
          return;
        }

        setPhotos(current => [
          ...current,
          ...accepted.map(asset => ({ asset, status: 'idle' as UploadStatus, progress: 0 })),
        ]);

        await Promise.all(accepted.map(asset => upload(asset, false)));
      })();
    },
    [photos.length, upload],
  );

  const remove = useCallback((assetId: string) => {
    setNotice(null);

    /*
      Taken off the form first, and off the server after.

      Removing is the customer's decision and it has already been made; making
      them watch a spinner while the server catches up would be the app asking
      permission for something it was told to do. If the server call fails the
      photograph is orphaned there, which is a housekeeping problem for the
      backend and not a reason to put a photo back on a form someone just took
      it off.
    */
    setPhotos(current => current.filter(photo => photo.asset.id !== assetId));

    void getService('image')
      .remove(assetId)
      .catch(() => undefined);
  }, []);

  const retry = useCallback(
    (assetId: string) => {
      setNotice(null);

      const target = photos.find(photo => photo.asset.id === assetId);
      if (target) {
        void upload(target.asset, true);
      }
    },
    [photos, upload],
  );

  return {
    photos,
    uploadedUrls: photos
      .map(photo => photo.remoteUrl)
      .filter((url): url is string => url !== undefined),
    isUploading: photos.some(photo => photo.status === 'uploading'),
    hasFailures: photos.some(photo => photo.status === 'failed'),
    canAddMore: photos.length < MAX_PHOTOS,
    notice,
    add,
    remove,
    retry,
  };
}
