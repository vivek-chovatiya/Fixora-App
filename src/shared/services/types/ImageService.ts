/**
 * ImageService
 *
 * The only route to image capture, processing and upload.
 *
 * No screen, hook or component may import a picker library directly. This
 * interface is what allows the underlying library to be replaced without
 * touching business logic.
 *
 * Every upload names what it is for (Phase 4B, 24/11/2026): the backend keeps
 * a request's photos, an account's picture, a shop's images and a team
 * member's photo apart, and attaches an upload only to the field of its own
 * kind (contract §2) — a photo uploaded for a request cannot become somebody's
 * profile picture.
 *
 * ⚠️ The purpose is the caller's to say, never the service's to guess: the same
 * picture pipeline (`useImageUpload`) serves the customer's photo, the vendor's
 * picture and a team member's photo, and only the caller knows which it is.
 */

import type { AppErrorKind } from '@/shared/types/error';

/**
 * What an upload is for — the backend's upload `type`, word for word:
 * `request` (PROJECT_BIBLE.md section 16), `profile` (the account's own
 * picture: section 25, and the vendor's in section 38), `shop` (section 38)
 * and `team` (section 39).
 */
export type ImageUploadPurpose = 'request' | 'profile' | 'shop' | 'team';

export interface ImageAsset {
  /** Client-side identifier, stable across compression and upload retries. */
  id: string;
  /** Local file URI. */
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export type ImageSource = 'camera' | 'gallery';

export interface ImagePickOptions {
  /** Defaults to 1. Capped by AppConfig.image.maxUploadsPerRequest. */
  maxCount?: number;
}

export interface ImageValidationResult {
  valid: boolean;
  /** Populated when `valid` is false. Covers both size and type checks. */
  reason?: 'size' | 'type';
  message?: string;
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'failed';

export interface ImageUploadResult {
  assetId: string;
  /** Remote URL to persist against the parent record. */
  remoteUrl: string;
}

export interface ImageUploadState {
  assetId: string;
  status: UploadStatus;
  /** 0-1. */
  progress: number;
  errorKind?: AppErrorKind;
}

export type UploadProgressListener = (state: ImageUploadState) => void;

export interface ImageService {
  pickFromCamera(options?: ImagePickOptions): Promise<ImageAsset[]>;
  pickFromGallery(options?: ImagePickOptions): Promise<ImageAsset[]>;

  /**
   * Applies AppConfig.image compression settings. Returns a new asset — or the
   * same one when the picker already applied them (`ApiImageService`).
   */
  compress(asset: ImageAsset): Promise<ImageAsset>;
  /** Display-ready URI for thumbnails. */
  generatePreview(asset: ImageAsset): Promise<string>;
  /** Checks both file size and MIME type against AppConfig.image. */
  validate(asset: ImageAsset): ImageValidationResult;

  upload(
    asset: ImageAsset,
    purpose: ImageUploadPurpose,
    onProgress?: UploadProgressListener,
  ): Promise<ImageUploadResult>;
  retryUpload(
    asset: ImageAsset,
    purpose: ImageUploadPurpose,
    onProgress?: UploadProgressListener,
  ): Promise<ImageUploadResult>;
  remove(assetId: string): Promise<void>;
}
