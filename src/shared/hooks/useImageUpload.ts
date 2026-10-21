/**
 * useImageUpload
 *
 * One picture, from the camera or the gallery to a remote URL, and what happens
 * to that URL next is the caller's:
 *
 *   pick → validate → compress → upload → attach
 *
 * Extracted from the customer's `useProfileImage` (Phase 3D-8) when the vendor's
 * business picture needed exactly the same pipeline (Phase 3E-1). Two copies of
 * this would be two answers to "what happens when an upload fails", and the
 * answer is a product rule:
 *
 * ⚠️ `attach` runs last, and only if everything before it worked. Nobody may be
 * left believing something was saved when the upload that would have saved it
 * failed (PROJECT_BIBLE.md section 16).
 *
 * ⚠️ A failure keeps the chosen image, so Try again never asks for the
 * photograph a second time; `discard` is how the person says no. The local file
 * is never handed to `attach` — only the uploaded URL is.
 *
 * ⚠️ No picker library is imported. `ImageService` is the only route to the
 * camera, the gallery, compression and upload.
 *
 * One action at a time: while an image is being picked or uploaded, another
 * press does nothing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { getService } from '@/shared/services/ServiceRegistry';
import type { ImageAsset, ImageSource } from '@/shared/services/types/ImageService';
import { AppError } from '@/shared/types/error';

const log = createLogger('useImageUpload');

/** What the screen is doing, so it can say so. */
export type ImageUploadStatus = 'idle' | 'working' | 'failed';

export interface ImageUploadOptions {
  /** Keeps the uploaded picture — on an account, in a form. Its failure is the upload's. */
  attach: (remoteUrl: string) => Promise<void> | void;
  /** Forgets the current picture. */
  detach: () => Promise<void> | void;
}

export interface ImageUpload {
  status: ImageUploadStatus;
  /** True while picking, uploading or removing. Disables every action. */
  isBusy: boolean;
  /**
   * Whether an action is running at this instant — read from the guard the
   * hook refuses a second action with, so it is true from the tap, a render
   * before `isBusy` lands. For a caller that must not act on the picture's old
   * value in that frame: the team member form's Save, which a photo still
   * uploading would otherwise miss (2026-10-21).
   */
  isRunning: () => boolean;
  /** The picture that failed to save, kept for a retry. Local and unsaved. */
  pending: ImageAsset | null;
  /** Set when the last attempt failed. Cleared by a retry or a discard. */
  error: AppError | null;
  /** Opens the camera or the gallery, then saves what comes back. */
  choose: (source: ImageSource) => void;
  /** Saves `pending` again. Does nothing when there is none. */
  retry: () => void;
  /** Forgets a failed attempt without saving it. */
  discard: () => void;
  /** Removes the current picture. */
  remove: () => void;
}

export function useImageUpload({ attach, detach }: ImageUploadOptions): ImageUpload {
  const [status, setStatus] = useState<ImageUploadStatus>('idle');
  const [pending, setPending] = useState<ImageAsset | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  // Read at call time, so a caller need not memoise what it passes.
  const attachRef = useRef(attach);
  attachRef.current = attach;
  const detachRef = useRef(detach);
  detachRef.current = detach;

  const inFlight = useRef(false);
  /*
    What a failed action should leave behind, set by the action itself.

    `choose` only learns which image it is working on part-way through, so it
    cannot be told up front — and a mid-upload failure has to keep exactly the
    image it was uploading if Try again is to mean anything.
  */
  const keepRef = useRef<ImageAsset | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Uploads an already-chosen image and attaches it.
   *
   * Compression happens here rather than at the picker, so a retry compresses
   * the original again instead of compounding on an already-compressed file.
   */
  const save = useCallback(async (asset: ImageAsset) => {
    const images = getService('image');

    const check = images.validate(asset);
    if (!check.valid) {
      // Refused by the device's own rules, so it never becomes a request.
      throw new AppError({
        kind: 'validation',
        message: check.message ?? 'That image cannot be used.',
      });
    }

    const compressed = await images.compress(asset);
    const { remoteUrl } = await images.upload(compressed);
    await attachRef.current(remoteUrl);
  }, []);

  /**
   * Every action shares this: one at a time, and the outcome is the state.
   *
   * Starts the work and returns; it never rejects, because everything that can
   * go wrong is turned into `error` here. Callers are therefore ordinary
   * handlers rather than floating promises — the one deliberate `void` in this
   * hook is the one below.
   */
  const run = useCallback(
    (action: () => Promise<void>, keep: ImageAsset | null = null): void => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      keepRef.current = keep;
      setStatus('working');
      setError(null);

      void (async () => {
        try {
          await action();
          if (mountedRef.current) {
            setPending(null);
            setStatus('idle');
          }
        } catch (caught) {
          const appError = AppError.from(caught);
          // The kind, never the message: what a service said went wrong is a
          // developer's business, and `ErrorState` writes what the person reads.
          log.error('Picture failed', { kind: appError.kind });
          if (mountedRef.current) {
            setPending(keepRef.current);
            setError(appError);
            setStatus('failed');
          }
        } finally {
          inFlight.current = false;
        }
      })();
    },
    [],
  );

  const choose = useCallback(
    (source: ImageSource) => {
      run(async () => {
        const images = getService('image');
        const [asset] = await (source === 'camera'
          ? images.pickFromCamera({ maxCount: 1 })
          : images.pickFromGallery({ maxCount: 1 }));

        /*
          No asset means the person backed out of the picker. That is not a
          failure and must not be reported as one, so the action simply ends.
        */
        if (!asset) {
          return;
        }

        // Recorded before the upload starts, so a failure mid-upload still has
        // something to retry.
        keepRef.current = asset;
        if (mountedRef.current) {
          setPending(asset);
        }
        await save(asset);
      });
    },
    [run, save],
  );

  const retry = useCallback(() => {
    const asset = pending;
    if (!asset) {
      return;
    }
    run(() => save(asset), asset);
  }, [pending, run, save]);

  const discard = useCallback(() => {
    if (inFlight.current) {
      return;
    }
    setPending(null);
    setError(null);
    setStatus('idle');
  }, []);

  const remove = useCallback(() => {
    run(async () => {
      await detachRef.current();
    });
  }, [run]);

  const isRunning = useCallback(() => inFlight.current, []);

  return {
    status,
    isBusy: status === 'working',
    isRunning,
    pending,
    error,
    choose,
    retry,
    discard,
    remove,
  };
}
