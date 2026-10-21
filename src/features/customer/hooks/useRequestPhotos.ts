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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  /** Stable across compression, upload retries and a restored draft. */
  id: string;
  /**
   * What the thumbnail draws: the local file while it is being uploaded, the
   * remote URL once a draft has been resumed and the local file is long gone.
   */
  previewUri: string;
  status: UploadStatus;
  /** 0-1, as reported by the image service. */
  progress: number;
  /** Set once the upload succeeds. This, and only this, reaches the payload. */
  remoteUrl?: string;
  /**
   * The picked file.
   *
   * Absent for a photograph restored from a saved draft: the device file it came
   * from may not exist any more, and it does not need to — the upload finished
   * before the draft was written, so there is nothing left to do with it but
   * draw it and possibly remove it.
   */
  asset?: ImageAsset;
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
  remove: (id: string) => void;
  retry: (id: string) => void;
}

const MAX_PHOTOS = AppConfig.image.maxUploadsPerRequest;

function fill(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

/**
 * Rebuilds the photographs a saved draft finished uploading.
 *
 * A URL is enough to draw one and enough to send one, which is all a restored
 * photograph is ever asked to do. Its id is the URL for want of anything more
 * stable, which is fine because it is unique by construction.
 */
function restore(urls: readonly string[]): RequestPhoto[] {
  return urls.map(url => ({
    id: url,
    previewUri: url,
    status: 'success' as UploadStatus,
    progress: 1,
    remoteUrl: url,
  }));
}

export function useRequestPhotos(initialUrls: readonly string[] = []): RequestPhotos {
  // Seeded once. Later changes to the draft come from this hook, so re-reading
  // it would fight whatever the customer is doing right now.
  const [photos, setPhotos] = useState<readonly RequestPhoto[]>(() => restore(initialUrls));
  const [notice, setNotice] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Applies a change to one photo, leaving the rest and the order alone. */
  const patch = useCallback((id: string, change: Partial<RequestPhoto>) => {
    if (!mountedRef.current) {
      return;
    }
    setPhotos(current => current.map(photo => (photo.id === id ? { ...photo, ...change } : photo)));
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
          ...accepted.map(asset => ({
            id: asset.id,
            previewUri: asset.uri,
            status: 'idle' as UploadStatus,
            progress: 0,
            asset,
          })),
        ]);

        await Promise.all(accepted.map(asset => upload(asset, false)));
      })();
    },
    [photos.length, upload],
  );

  const remove = useCallback((id: string) => {
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
    setPhotos(current => {
      const target = current.find(photo => photo.id === id);

      /*
        Only a photograph this session picked can be withdrawn from the service,
        because only that one has an asset id the service would recognise. One
        restored from a saved draft leaves its uploaded copy behind — the same
        housekeeping the backend already has to do for a failed removal.
      */
      if (target?.asset) {
        void getService('image')
          .remove(target.asset.id)
          .catch(() => undefined);
      }

      return current.filter(photo => photo.id !== id);
    });
  }, []);

  const retry = useCallback(
    (id: string) => {
      setNotice(null);

      // A restored photograph has no asset and cannot have failed — it was
      // uploaded before the draft was written — so there is nothing to retry.
      const target = photos.find(photo => photo.id === id);
      if (target?.asset) {
        void upload(target.asset, true);
      }
    },
    [photos, upload],
  );

  /*
    Derived once per change, not once per render.

    `uploadedUrls` is a new array every time it is built, so a caller with an
    effect watching it would re-run on every render — and if that effect writes
    anything back, it re-renders and runs again. That is not hypothetical: it is
    what an autosave on this value did before this memo existed.
  */
  const derived = useMemo(
    () => ({
      uploadedUrls: photos
        .map(photo => photo.remoteUrl)
        .filter((url): url is string => url !== undefined),
      isUploading: photos.some(photo => photo.status === 'uploading'),
      hasFailures: photos.some(photo => photo.status === 'failed'),
      canAddMore: photos.length < MAX_PHOTOS,
    }),
    [photos],
  );

  return {
    photos,
    ...derived,
    notice,
    add,
    remove,
    retry,
  };
}
