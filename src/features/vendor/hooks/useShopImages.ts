/**
 * useShopImages
 *
 * The vendor's shop images, and every change to them (PROJECT_BIBLE.md section
 * 38, "Shop Images" and "Upload Shop Images").
 *
 *   Shop images screen → hook → ImageService (pick, validate, compress, upload)
 *                             → VendorProfileService.updateShopImages
 *
 * ⚠️ Each change is saved as it is made. A photo uploads the moment it is
 * picked and, once uploaded, is saved straight away as the stored list plus its
 * URL; removing one saves the stored list without it. There is no Save button
 * and no draft. The service answers with the whole stored profile, and that
 * answer is what is drawn — and is adopted by `VendorProfileContext`, so the
 * Profile tab shows it without a read of its own.
 *
 * ⚠️ One operation at a time — every read and every change — in the order
 * asked. The first read, a pull, a retry, each save and each removal wait their
 * turn in the vendor's one profile line (`VendorProfileContext.inLine`), so no
 * read ever overlaps a change. The line is the vendor's, not this screen's: a
 * save still in the air when the screen is left finishes before the screen
 * opened next makes its first read, so that read cannot miss it and the next
 * save cannot send a list without it. Two photos picked in quick succession
 * upload side by side, but their saves wait, each built on the list the one
 * before it stored — otherwise the second would send a list without the first
 * and take it back off. The cost is honest: a pull (or a reopened screen's
 * first read) asked for while a save is in the air keeps its spinner until that
 * save has answered, and only then reads.
 *
 * ⚠️ The hook's picture of the stored list changes only where an operation
 * ends (`settle`), in line order — and at that moment nothing else is in the
 * air, so what the service answered is the whole truth. That answer is drawn
 * and adopted by `VendorProfileContext` there and then, read or change alike,
 * so the Profile tab follows a pull as well as a save and can never be handed
 * an older list after a newer one. A read that ends after its screen has gone
 * is not adopted: it changed nothing stored, and the screen that asked is not
 * there to draw it. (Numbered reads and an effect that adopted them were tried
 * first; a change sent before a read and answered after it slipped between
 * them. A line per screen came next; a reopened screen's read slipped past the
 * last screen's save.)
 *
 * ⚠️ A failure stays on the photograph that failed (section 16's rule, as on a
 * request): an upload that failed is kept with Try again, and an uploaded photo
 * whose save failed is kept as "Not saved" with Try again — never lost, never
 * drawn as saved, and never an error page over the photos that are fine.
 *
 * ⚠️ A save whose answer was lost may have been stored (`mayBeStored`). That is
 * settled only at a line boundary, never guessed: when any operation ends, a
 * "Not saved" photo whose URL the answer holds was saved after all — taken off
 * the photos on their way and said to be saved, once — and one whose URL it
 * lacks is now known not to be stored. A retried one waiting its turn whose URL
 * the current list already holds is saved after all in its turn, without being
 * sent again (it would be refused as a duplicate). No photo is drawn or
 * counted twice, and nothing is called saved without the service having said
 * so.
 *
 * ⚠️ The work belongs to the screen. Once it is left nothing new starts: an
 * upload still running is not saved, and a save still waiting in line is not
 * sent. A save already sent cannot be recalled; its answer is still adopted, so
 * the Profile tab never shows less than is stored. That is why waiting and
 * sending are two states, not one: a photo is `waiting` while its save is in
 * line and becomes `saving` only inside its turn, the moment before the call
 * goes out. `hasUnsaved` counts everything leaving would drop — and nothing that
 * leaving cannot stop — so the screen asks exactly when something would be
 * lost, and its words can say exactly what.
 *
 * ⚠️ A removal is the exception, on purpose: it was confirmed in a dialog, so
 * it is the vendor's finished decision, not work in progress. Confirming closes
 * the dialog at once and marks the photo "Removing" (still drawn and counted)
 * while the removal waits its turn and is sent; it then finishes whether or not
 * the screen is still open — never after the vendor's session has ended — and a
 * failure is a toast and the photo back as it was. Leaving loses nothing to it,
 * so it is no reason to ask, and the leave dialog says it will finish.
 *
 * Nothing is asked for on mount. The camera permission is asked for when the
 * camera is chosen and not before; the library needs none — the request
 * photos' rule (`useRequestPhotos`). No picker library is imported here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useVendorProfile } from '@/features/vendor/state/VendorProfileContext';
import { ERROR_PRESENTATION, useToast } from '@/shared/components';
import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { useStaleState } from '@/shared/hooks/useStaleState';
import { getService } from '@/shared/services/ServiceRegistry';
import type {
  ImageAsset,
  ImageSource,
  ImageUploadState,
} from '@/shared/services/types/ImageService';
import type { VendorProfile } from '@/shared/services/types/VendorProfileService';
import { AppError } from '@/shared/types/error';

const COPY = VENDOR_COPY.shopImages;

const log = createLogger('useShopImages');

/** The app's ceiling (section 38 sets none); the service checks it again. */
const MAX_SHOP_IMAGES = AppConfig.image.maxShopImagesPerVendor;

/**
 * Where one photograph has got to. Only `saved` is on the profile; every other
 * state is this screen's, and goes when the screen does.
 *
 * `waiting` is uploaded with its save in line behind another; `saving` is that
 * save actually sent. Leaving drops the first and cannot stop the second.
 * `removing` is a saved photo whose confirmed removal is in line or sent; it is
 * still stored, and counted, until the service answers.
 */
export type ShopImageState =
  | 'saved'
  | 'removing'
  | 'uploading'
  | 'uploadFailed'
  | 'waiting'
  | 'saving'
  | 'saveFailed';

export interface ShopImage {
  /** The URL of a saved photo; the picked file's id for one still on its way. */
  key: string;
  /** What the tile draws: the picked file until the photo is saved, then the stored URL. */
  previewUri: string;
  state: ShopImageState;
  /** 0-1, as the image service reports it while uploading. */
  progress: number;
}

/** A photo on its way, with everything Try again needs. */
interface PendingImage extends ShopImage {
  asset: ImageAsset;
  /** Set once uploaded. This, and only this, is what gets saved. */
  remoteUrl?: string;
  /**
   * Its last save failed in a way that leaves the outcome unknown — sent, then
   * no answer — so the URL may be stored after all. False after a refusal.
   */
  mayBeStored?: boolean;
}

/**
 * Stored already, by an earlier attempt of its own whose answer was lost: the
 * outcome was unknown, and the stored list now holds its URL. Never true of a
 * save in the air (`saving`) — its own answer will say.
 */
function isAlreadyStored(image: PendingImage, stored: readonly string[]): boolean {
  return (
    image.mayBeStored === true &&
    image.state !== 'saving' &&
    image.remoteUrl !== undefined &&
    stored.includes(image.remoteUrl)
  );
}

/** Left the screen before its turn: the operation is not run, and nobody is listening. */
function leftBeforeItsTurn(): AppError {
  return new AppError({ kind: 'cancelled', message: 'Shop images: the screen was left' });
}

export interface ShopImagesState {
  /** Saved photos in the stored order, then those on their way. Undefined until the first read. */
  images: readonly ShopImage[] | undefined;
  /** True for the first read and for a retry after it failed. */
  isLoading: boolean;
  /** The first read failed and there is nothing to show. */
  error: AppError | null;
  /** Reads again, showing the loading state. For the error's Try again. */
  retry: () => void;

  /** Pull-to-refresh: the photos stay on screen. */
  refresh: () => void;
  isRefreshing: boolean;
  /** The last refresh failed; what is on screen is from before it. */
  isStale: boolean;
  /** Why the refresh failed, for the notice. Null unless `isStale`. */
  staleError: AppError | null;

  /** The ceiling, for the counter. */
  max: number;
  /** How many more fit, counting photos still on their way. */
  remaining: number;
  /** The last thing the vendor needs telling about adding: a refused camera, a refused file, the ceiling. */
  notice: string | null;
  /**
   * Something on screen would be lost by leaving now: uploading, waiting to
   * save, or failed. A save already sent is not counted — leaving cannot stop it.
   */
  hasUnsaved: boolean;
  /** A save has been sent and not answered yet; it finishes whether or not the screen stays. */
  isSending: boolean;
  /**
   * A photo marked "Not saved" (or waiting to try again) may have been stored
   * after all — its last save went out and no answer came back. Until an
   * operation's answer settles it, "will not be added" would not be true of it.
   */
  mayBeSaved: boolean;
  /** A confirmed removal is in line or sent; it finishes whether or not the screen stays. */
  isRemoving: boolean;

  /** Opens the camera or the library, then uploads and saves what comes back. */
  add: (source: ImageSource) => void;
  /** Tries a failed upload, or a failed save, again. */
  retryImage: (key: string) => void;
  /** Takes off a photo that was never saved. Nothing stored changes. */
  discardImage: (key: string) => void;
  /**
   * Takes a saved photo off the profile — already confirmed. Returns at once:
   * the photo is marked `removing` until the service answers.
   */
  removeImage: (url: string) => void;
}

export function useShopImages(): ShopImagesState {
  const { showToast } = useToast();
  const { adopt, inLine } = useVendorProfile();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /*
    The stored list as the last operation to end left it — `undefined` until
    the first read has — in state for drawing, and in a ref for the next
    operation in line, which runs sooner than any render. Both change only in
    `settle`, at the end of an operation.
  */
  const [saved, setSaved] = useState<readonly string[] | undefined>(undefined);
  const savedRef = useRef<readonly string[]>([]);
  /** The whole profile that answer came with, for adopting again without a call. */
  const lastProfile = useRef<VendorProfile | null>(null);

  /* Photos on their way --------------------------------------------------- */

  /*
    Held in a ref as well as in state: a second add, a retry or the line of
    saves must see a change the instant it is made, not a render later.
  */
  const pendingRef = useRef<readonly PendingImage[]>([]);
  const [pending, setPending] = useState<readonly PendingImage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const updatePending = useCallback(
    (change: (images: readonly PendingImage[]) => readonly PendingImage[]) => {
      pendingRef.current = change(pendingRef.current);
      if (mountedRef.current) {
        setPending(pendingRef.current);
      }
    },
    [],
  );

  /** Applies a change to one photo, leaving the rest and the order alone. */
  const patch = useCallback(
    (key: string, change: Partial<PendingImage>) =>
      updatePending(images =>
        images.map(image => (image.key === key ? { ...image, ...change } : image)),
      ),
    [updatePending],
  );

  const say = useCallback((message: string) => {
    if (mountedRef.current) {
      setNotice(message);
    }
  }, []);

  /** Photos on screen or on their way, against the ceiling — each counted once. */
  const taken = useCallback(
    () =>
      savedRef.current.length +
      pendingRef.current.filter(image => !isAlreadyStored(image, savedRef.current)).length,
    [],
  );

  /*
    The line is the vendor's (`inLine`, from `VendorProfileContext`). Each
    operation below decides for itself what to do if this screen has been left
    by its turn (see the header): a save is not sent and a read is not made; a
    confirmed removal still goes. The context refuses every one once the
    vendor's session has ended.
  */

  /**
   * The end of an operation: what the service answered becomes the stored
   * list — here, for the next operation, and on the Profile tab.
   *
   * Nothing else is in the air at this moment (that is what the line is for),
   * so the answer settles every photo whose earlier save left its outcome
   * unknown: "Not saved" with its URL in the list was saved after all; with
   * its URL missing, it is now known not to be stored. A retried one still
   * waiting its turn keeps the question for its turn (`saveImage`).
   *
   * Adopted even after the screen has gone: Profile must never show less than
   * is stored, and nothing newer can follow from here.
   */
  const settle = useCallback(
    (profile: VendorProfile) => {
      const urls = profile.shopImageUrls;
      savedRef.current = urls;
      lastProfile.current = profile;

      if (mountedRef.current) {
        const savedAfterAll = new Set(
          pendingRef.current
            .filter(image => image.state === 'saveFailed' && isAlreadyStored(image, urls))
            .map(image => image.key),
        );
        updatePending(images =>
          images
            .filter(image => !savedAfterAll.has(image.key))
            // Not in the whole answer, with nothing else in the air: not stored.
            .map(image =>
              image.mayBeStored &&
              image.state !== 'saving' &&
              image.remoteUrl !== undefined &&
              !urls.includes(image.remoteUrl)
                ? { ...image, mayBeStored: false }
                : image,
            ),
        );
        setSaved(urls);
        if (savedAfterAll.size > 0) {
          showToast({ message: COPY.added, tone: 'success', icon: 'success' });
        }
      }

      adopt(profile);
    },
    [adopt, showToast, updatePending],
  );

  /* Reading ----------------------------------------------------------------- */

  /*
    Every read goes through the line, so it never overlaps a change. The
    single-flight guard is held while it waits as well as while it runs, so a
    pull or Try again pressed meanwhile is still one read, not two.
  */
  const query = useSingleFlightQuery<VendorProfile>(
    useCallback(
      () =>
        inLine(async () => {
          if (!mountedRef.current) {
            throw leftBeforeItsTurn();
          }
          const profile = await getService('vendorProfile').getProfile();
          /*
            Ended after the screen had gone: nobody to draw it, and a read
            changed nothing stored — so it is not adopted either. (Adopting it
            could put an older list on Profile after a newer answer.)
          */
          if (mountedRef.current) {
            settle(profile);
          }
          return profile;
        }),
      [inLine, settle],
    ),
    [],
  );

  const failed = useCallback(
    (prefix: string, caught: unknown) => {
      const error = AppError.from(caught);
      // The kind, never the message or a URL: what went wrong is a developer's business.
      log.warn('Shop images not changed', { kind: error.kind });
      const { tone, icon } = ERROR_PRESENTATION[error.kind];
      showToast({ message: `${prefix} ${error.userMessage}`, tone, icon });
    },
    [showToast],
  );

  /** Saves an uploaded photo: the stored list, plus its URL, at the end. */
  const saveImage = useCallback(
    (key: string, remoteUrl: string): Promise<void> => {
      patch(key, { state: 'waiting', progress: 1, remoteUrl });

      return inLine(async () => {
        // Left before its turn: never sent (see the header).
        if (!mountedRef.current) {
          return;
        }
        try {
          const own = pendingRef.current.find(image => image.key === key);
          /*
            Stored already by its own earlier attempt — that answer was lost,
            and an answer since has shown the URL. Saved after all, in its turn
            and without sending it again: it would be refused as a duplicate.
            Only for a photo whose outcome was unknown (`isAlreadyStored`): on a
            first save, or after a refusal, a URL already in the list is not
            this photo's doing, so it is sent and refused as the duplicate it is.
          */
          if (own && isAlreadyStored(own, savedRef.current)) {
            updatePending(images => images.filter(image => image.key !== key));
            // The list holding it was adopted when it settled; again, so "saved" and Profile never part.
            if (lastProfile.current) {
              adopt(lastProfile.current);
            }
            showToast({ message: COPY.added, tone: 'success', icon: 'success' });
            return;
          }

          // Sent from here on: leaving the screen can no longer stop it.
          patch(key, { state: 'saving' });
          settle(
            await getService('vendorProfile').updateShopImages([...savedRef.current, remoteUrl]),
          );
          updatePending(images => images.filter(image => image.key !== key));
          showToast({ message: COPY.added, tone: 'success', icon: 'success' });
        } catch (caught) {
          // A dropped connection or a server fault may have stored it anyway; a refusal did not.
          patch(key, { state: 'saveFailed', mayBeStored: AppError.from(caught).isRetryable });
          failed(COPY.saveFailed, caught);
        }
        // Refused unrun only when the vendor's session has ended: nothing left to tell.
      }).catch(() => undefined);
    },
    [adopt, failed, inLine, patch, settle, showToast, updatePending],
  );

  /**
   * Uploads one picked photo, then saves it.
   *
   * Compressed per attempt, so Try again compresses the original rather than
   * compounding on a copy that was already compressed (`useImageUpload`'s rule).
   * Never rejects: a failure is the photo's state.
   */
  const uploadImage = useCallback(
    async (asset: ImageAsset, isRetry: boolean): Promise<void> => {
      const key = asset.id;
      patch(key, { state: 'uploading', progress: 0 });

      let remoteUrl: string;
      try {
        const images = getService('image');
        const onProgress = (state: ImageUploadState) => patch(key, { progress: state.progress });
        const compressed = await images.compress(asset);
        const result = await (isRetry
          ? images.retryUpload(compressed, onProgress)
          : images.upload(compressed, onProgress));
        remoteUrl = result.remoteUrl;
      } catch (caught) {
        // Marked on the photo, which carries its own Try again. Logged by kind only.
        log.warn('Shop photo not uploaded', { kind: AppError.from(caught).kind });
        patch(key, { state: 'uploadFailed', progress: 0 });
        return;
      }

      // Taken off while it uploaded, or the screen was left: not wanted.
      if (!mountedRef.current || !pendingRef.current.some(image => image.key === key)) {
        return;
      }
      await saveImage(key, remoteUrl);
    },
    [patch, saveImage],
  );

  const addFrom = useCallback(
    async (source: ImageSource): Promise<void> => {
      if (taken() >= MAX_SHOP_IMAGES) {
        say(COPY.limitReached(MAX_SHOP_IMAGES));
        return;
      }

      if (source === 'camera') {
        /*
          Asked for here, when the camera is wanted — and "denied" and "blocked"
          are not told apart, because the next step is the same either way: the
          library is right there (the request photos' reasoning).
        */
        const status = await getService('permission').request('camera');
        if (status !== 'granted') {
          say(COPY.cameraUnavailable);
          return;
        }
      }

      const images = getService('image');
      let picked: ImageAsset[];
      try {
        picked =
          source === 'camera'
            ? await images.pickFromCamera({ maxCount: 1 })
            : await images.pickFromGallery({ maxCount: 1 });
      } catch {
        // Includes changing one's mind in the picker, which is not a failure worth a message.
        return;
      }

      if (!mountedRef.current) {
        return;
      }

      // Counted again: another photo may have taken the last place while this one was picked.
      const room = MAX_SHOP_IMAGES - taken();
      if (room <= 0) {
        say(COPY.limitReached(MAX_SHOP_IMAGES));
        return;
      }

      /*
        Checked before it is shown, not after it is uploaded: a file the image
        rules refuse never becomes a tile that is going to fail, and the reason
        is the service's, because the service knows which rule it broke.
      */
      const accepted: ImageAsset[] = [];
      let rejection: string | null = null;
      for (const asset of picked.slice(0, room)) {
        const check = images.validate(asset);
        if (check.valid) {
          accepted.push(asset);
        } else {
          rejection = rejection ?? check.message ?? COPY.unusable;
        }
      }
      if (rejection) {
        say(rejection);
      }
      if (accepted.length === 0) {
        return;
      }

      updatePending(current => [
        ...current,
        ...accepted.map(asset => ({
          key: asset.id,
          previewUri: asset.uri,
          state: 'uploading' as const,
          progress: 0,
          asset,
        })),
      ]);
      await Promise.all(accepted.map(asset => uploadImage(asset, false)));
    },
    [say, taken, updatePending, uploadImage],
  );

  const add = useCallback(
    (source: ImageSource) => {
      setNotice(null);
      addFrom(source).catch((caught: unknown) => {
        // Nothing was added and nothing half-added; why is a developer's question.
        log.error('Shop photo could not be added', { kind: AppError.from(caught).kind });
      });
    },
    [addFrom],
  );

  const retryImage = useCallback(
    (key: string) => {
      const target = pendingRef.current.find(image => image.key === key);
      if (!target) {
        return;
      }
      setNotice(null);

      // Each moves the photo out of its failed state at once, so a second press finds nothing to retry.
      if (target.state === 'uploadFailed') {
        uploadImage(target.asset, true).catch(() => undefined);
      } else if (target.state === 'saveFailed' && target.remoteUrl) {
        saveImage(key, target.remoteUrl).catch(() => undefined);
      }
    },
    [saveImage, uploadImage],
  );

  const discardImage = useCallback(
    (key: string) => {
      const target = pendingRef.current.find(image => image.key === key);
      // Not once its save is in line or sent: that save would put it back.
      if (!target || target.state === 'waiting' || target.state === 'saving') {
        return;
      }
      setNotice(null);
      updatePending(images => images.filter(image => image.key !== key));

      /*
        Withdrawn from the image service too, as on a request. If that fails the
        upload is orphaned there — the backend's housekeeping, and never a reason
        to keep a photo the vendor took off.

        ⚠️ Never after a failed save. That save may have been stored with only
        its answer lost, and deleting the file would leave the profile pointing
        at nothing. The backend tidies an upload no profile refers to.
      */
      if (target.state !== 'saveFailed') {
        getService('image')
          .remove(target.asset.id)
          .catch(() => undefined);
      }
    },
    [updatePending],
  );

  /* Removing a saved photo ------------------------------------------------ */

  /*
    Saved photos whose confirmed removal is in line or sent: in a ref for the
    instant check (one removal per photo, however often it is confirmed), in
    state for drawing them "Removing".
  */
  const removingRef = useRef<ReadonlySet<string>>(new Set());
  const [removing, setRemoving] = useState<ReadonlySet<string>>(() => new Set());

  const markRemoving = useCallback((url: string, isRemoving: boolean) => {
    const next = new Set(removingRef.current);
    if (isRemoving) {
      next.add(url);
    } else {
      next.delete(url);
    }
    removingRef.current = next;
    if (mountedRef.current) {
      setRemoving(next);
    }
  }, []);

  const removeImage = useCallback(
    (url: string) => {
      if (removingRef.current.has(url)) {
        return;
      }
      setNotice(null);
      markRemoving(url, true);

      inLine(async () => {
        /*
          Not checked against the screen: a confirmed removal is the vendor's
          finished decision and goes even if they have left by its turn (see
          the header). The context refuses it once their session has ended.
        */
        try {
          settle(
            await getService('vendorProfile').updateShopImages(
              savedRef.current.filter(stored => stored !== url),
            ),
          );
          showToast({ message: COPY.removed, tone: 'success', icon: 'success' });
        } catch (caught) {
          // Still stored: drawn as saved again, with the reason said.
          failed(COPY.removeFailed, caught);
        } finally {
          markRemoving(url, false);
        }
        // Refused unrun only when the vendor's session has ended: nothing left to tell.
      }).catch(() => undefined);
    },
    [failed, inLine, markRemoving, settle, showToast],
  );

  /* What the screen draws ------------------------------------------------- */

  /*
    Photos on their way, less a retried one waiting its turn whose URL the
    stored list already holds: it is drawn once, as the saved photo it is, and
    is not "unsaved" to the leave dialog. (A "Not saved" one in that position
    never survives `settle`.)
  */
  const onTheirWay = useMemo(
    () => (saved ? pending.filter(image => !isAlreadyStored(image, saved)) : pending),
    [pending, saved],
  );

  const images = useMemo<readonly ShopImage[] | undefined>(
    () =>
      saved === undefined
        ? undefined
        : [
            ...saved.map(url => ({
              key: url,
              previewUri: url,
              state: removing.has(url) ? ('removing' as const) : ('saved' as const),
              progress: 1,
            })),
            ...onTheirWay.map(({ key, previewUri, state, progress }) => ({
              key,
              previewUri,
              state,
              progress,
            })),
          ],
    [onTheirWay, removing, saved],
  );

  // With photos on screen a failure is a stale gallery, not an error page.
  const stale = useStaleState({
    hasData: query.data !== undefined,
    error: query.error,
    isRefreshing: query.isRefreshing,
  });

  return {
    images,
    isLoading: query.isLoading,
    error: stale.error,
    retry: query.retry,
    refresh: query.refresh,
    isRefreshing: query.isRefreshing,
    isStale: stale.isStale,
    staleError: stale.staleError,
    max: MAX_SHOP_IMAGES,
    remaining: Math.max(0, MAX_SHOP_IMAGES - (saved?.length ?? 0) - onTheirWay.length),
    notice,
    hasUnsaved: onTheirWay.some(image => image.state !== 'saving'),
    isSending: onTheirWay.some(image => image.state === 'saving'),
    mayBeSaved: onTheirWay.some(image => image.mayBeStored === true && image.state !== 'saving'),
    isRemoving: removing.size > 0,
    add,
    retryImage,
    discardImage,
    removeImage,
  };
}
