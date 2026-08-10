/**
 * ImageService
 *
 * The only route to image capture, processing and upload.
 *
 * No screen, hook or component may import a picker library directly. This
 * interface is what allows the underlying library to be replaced without
 * touching business logic.
 */

import type { AppErrorKind } from '@/shared/types/error';

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

  /** Applies AppConfig.image compression settings. Returns a new asset. */
  compress(asset: ImageAsset): Promise<ImageAsset>;
  /** Display-ready URI for thumbnails. */
  generatePreview(asset: ImageAsset): Promise<string>;
  /** Checks both file size and MIME type against AppConfig.image. */
  validate(asset: ImageAsset): ImageValidationResult;

  upload(asset: ImageAsset, onProgress?: UploadProgressListener): Promise<ImageUploadResult>;
  retryUpload(asset: ImageAsset, onProgress?: UploadProgressListener): Promise<ImageUploadResult>;
  remove(assetId: string): Promise<void>;
}
