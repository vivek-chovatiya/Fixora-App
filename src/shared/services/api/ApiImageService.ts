/**
 * ApiImageService
 *
 * ImageService on the device and the real backend (Phase 4B, 24/11/2026;
 * PROJECT_BIBLE.md sections 16, 25, 38 and 39). Replaces `MockImageService`'s
 * placeholder pictures with the phone's own camera and photo library, and its
 * simulated upload with the backend's `POST /uploads`.
 *
 * Decisions:
 * - **The picker does the compressing.** `react-native-image-picker` resizes to
 *   `AppConfig.image.maxDimension` on the longest edge and re-encodes at
 *   `compressionQuality` as it hands the photo over, so `compress` returns the
 *   asset as it is: there is no second library to compress with, and encoding
 *   an encoded file again would only lose more of it. The backend re-encodes
 *   every upload anyway (contract §1).
 * - **Nothing extra is read from the photo.** `includeExtra: false` keeps the
 *   picker from reading the photo's own record. A picture of a problem can
 *   carry the exact position of the customer's home; the backend strips it
 *   (contract §1), and the app never reads it in the first place.
 * - **The camera is asked for here,** through the PermissionService, each time
 *   it is opened. Android refuses the camera to an app that declares the
 *   permission and has not been granted it, and not every caller asks first
 *   (`useImageUpload` does not); a caller that already asked gets no second
 *   dialog. The photo library needs no permission: Android's photo picker and
 *   iOS's hand the app only the photos the person chose.
 * - **One photo per call:** a `type` part (the purpose) and one `files` part.
 *   The backend takes up to five, but one per call is what gives each
 *   thumbnail its own progress, failure and retry (section 16).
 * - **The file name sent is neutral** (`photo.jpg`). A device's file names can
 *   say more than they should, and the backend never keeps one anyway.
 * - **The answer is a path,** `/uploads/<type>/<name>.<ext>`, read through
 *   `toImageUrl` into an address this phone can load. That URL is what callers
 *   attach; the backend takes the full URL back as its path (contract §2).
 * - **Removing does nothing on the server.** There is no endpoint to delete an
 *   upload; one never attached stays there (contract §9, an open item).
 *
 * ⚠️ The picker library is imported here and nowhere else
 * (`importBoundaries.test.ts`). A refusal of the file itself — `FILE_TOO_LARGE`,
 * `FILE_TYPE_NOT_ALLOWED`, `TOO_MANY_FILES` — is a validation failure with its
 * own copy, never a retryable one: the same file sent again is refused again.
 */

import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
  type OptionsCommon,
  type PhotoQuality,
} from 'react-native-image-picker';

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import { malformedResponse, requireRecord, requireString } from '@/shared/services/api/apiResponse';
import { toImageUrl } from '@/shared/services/api/uploadUrls';
import type {
  ImageAsset,
  ImagePickOptions,
  ImageService,
  ImageUploadPurpose,
  ImageUploadResult,
  ImageValidationResult,
  UploadProgressListener,
} from '@/shared/services/types/ImageService';
import type { PermissionService } from '@/shared/services/types/PermissionService';
import { AppError } from '@/shared/types/error';
import { validateImageAsset } from '@/shared/validation/image';

const log = createLogger('ApiImageService');

/** The upload `type`s the backend takes (contract §1). */
const PURPOSES: ReadonlySet<string> = new Set<ImageUploadPurpose>(['request', 'profile', 'shop', 'team']);

/** The backend's refusals of the file itself: the same file again is refused again. */
const FILE_REFUSALS: ReadonlySet<string> = new Set([
  'FILE_TOO_LARGE',
  'FILE_TYPE_NOT_ALLOWED',
  'TOO_MANY_FILES',
]);

/** The neutral name's extension for each type the app sends. */
const EXTENSION: Readonly<Record<string, string>> = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});

/** `compressionQuality` in the picker's own steps (tenths), held to 0–1. */
function toPhotoQuality(value: number): PhotoQuality {
  const tenths = Math.round(Math.min(1, Math.max(0, value)) * 10);
  return (tenths / 10) as PhotoQuality;
}

/** How every photo is taken or chosen: a photo, at the app's size and quality, nothing else. */
const PICK_AS: Readonly<OptionsCommon> = Object.freeze({
  mediaType: 'photo',
  maxWidth: AppConfig.image.maxDimension,
  maxHeight: AppConfig.image.maxDimension,
  quality: toPhotoQuality(AppConfig.image.compressionQuality),
  includeBase64: false,
  includeExtra: false,
});

/** How many photos one pick may return: at least one, at most a request's ceiling. */
function countOf(options?: ImagePickOptions): number {
  const requested = options?.maxCount ?? 1;
  const whole = Number.isFinite(requested) ? Math.trunc(requested) : 1;
  return Math.max(1, Math.min(whole, AppConfig.image.maxUploadsPerRequest));
}

/**
 * The picker's type in the words `AppConfig.image.allowedMimeTypes` uses.
 * Some Android galleries report `image/jpg` or upper case for an ordinary JPEG.
 */
function mimeTypeOf(type: string | undefined): string {
  const lower = typeof type === 'string' ? type.trim().toLowerCase() : '';
  return lower === 'image/jpg' ? 'image/jpeg' : lower;
}

function sizeOf(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * A backend refusal of the file as a validation failure, its code (and so its
 * copy) kept. `FILE_TOO_LARGE` arrives as a 413, which reads as a retryable
 * failure of unknown kind; any other failure passes through untouched.
 */
function asFileRefusal(error: unknown): unknown {
  if (!(error instanceof AppError) || !error.code || !FILE_REFUSALS.has(error.code)) {
    return error;
  }
  return new AppError({
    kind: 'validation',
    code: error.code,
    statusCode: error.statusCode,
    fieldErrors: error.fieldErrors,
    message: error.message,
    cause: error.cause,
  });
}

/** The one file the backend stored, as an address this phone can load. */
function readUploaded(data: unknown): string {
  const record = requireRecord(data, 'upload');
  const files = record.files;
  if (!Array.isArray(files) || files.length !== 1) {
    throw malformedResponse('upload.files');
  }
  const file = requireRecord(files[0], 'upload.files.0');
  const remoteUrl = toImageUrl(requireString(file, 'path', 'upload.files.0'));
  if (!remoteUrl) {
    throw malformedResponse('upload.files.0.path');
  }
  return remoteUrl;
}

export interface ApiImageServiceOptions {
  /** The device's permissions, read when the camera is wanted. */
  permissions: () => PermissionService;
}

export class ApiImageService extends BaseApiService implements ImageService {
  private readonly permissions: () => PermissionService;
  /** Ids unique to this launch, as the picker gives none without `includeExtra`. */
  private readonly launch = Date.now().toString(36);
  private picked = 0;

  constructor(options: ApiImageServiceOptions) {
    super('/uploads');
    this.permissions = options.permissions;
  }

  /** One photo: a camera takes one at a time, whatever was asked for. */
  async pickFromCamera(_options?: ImagePickOptions): Promise<ImageAsset[]> {
    const status = await this.permissions().request('camera');
    if (status !== 'granted') {
      throw new AppError({ kind: 'permission', message: `Camera permission ${status}` });
    }

    return this.readPicked(await launchCamera({ ...PICK_AS, saveToPhotos: false }), 1);
  }

  async pickFromGallery(options?: ImagePickOptions): Promise<ImageAsset[]> {
    const limit = countOf(options);
    return this.readPicked(await launchImageLibrary({ ...PICK_AS, selectionLimit: limit }), limit);
  }

  /** Already compressed by the picker (see the header): returned as it is. */
  async compress(asset: ImageAsset): Promise<ImageAsset> {
    return asset;
  }

  async generatePreview(asset: ImageAsset): Promise<string> {
    return asset.uri;
  }

  validate(asset: ImageAsset): ImageValidationResult {
    return validateImageAsset(asset);
  }

  async upload(
    asset: ImageAsset,
    purpose: ImageUploadPurpose,
    onProgress?: UploadProgressListener,
  ): Promise<ImageUploadResult> {
    const check = this.validate(asset);
    if (!check.valid) {
      throw new AppError({ kind: 'validation', message: check.message, userMessage: check.message });
    }
    if (!PURPOSES.has(purpose)) {
      throw new AppError({ kind: 'validation', message: 'Image upload refused before sending: no such purpose' });
    }

    const form = new FormData();
    form.append('type', purpose);
    // React Native's FormData takes a file as `{ uri, name, type }` and reads it
    // from disk as it sends; the DOM's type for `append` knows only a Blob.
    form.append('files', {
      uri: asset.uri,
      name: `photo.${EXTENSION[asset.mimeType] ?? 'jpg'}`,
      type: asset.mimeType,
    } as unknown as Blob);

    let data: unknown;
    try {
      data = await this.postForm<unknown>('', form, {
        onProgress: fraction =>
          onProgress?.({ assetId: asset.id, status: 'uploading', progress: fraction }),
      });
    } catch (error) {
      throw asFileRefusal(error);
    }

    const remoteUrl = readUploaded(data);
    onProgress?.({ assetId: asset.id, status: 'success', progress: 1 });
    // The purpose, never the path: a request photo's path leads to a home.
    log.info('Image uploaded', { purpose });
    return { assetId: asset.id, remoteUrl };
  }

  async retryUpload(
    asset: ImageAsset,
    purpose: ImageUploadPurpose,
    onProgress?: UploadProgressListener,
  ): Promise<ImageUploadResult> {
    log.debug('Retrying upload', { purpose });
    return this.upload(asset, purpose, onProgress);
  }

  /** Nothing to remove on the server: the backend has no way to delete an upload (contract §9). */
  async remove(_assetId: string): Promise<void> {
    log.debug('Upload left on the server: there is no endpoint to remove one');
  }

  /**
   * What the picker handed back, as the app's assets. Backing out is no photo,
   * not a failure; a picker error rejects by its code alone — the library's
   * message names files and devices.
   */
  private readPicked(response: ImagePickerResponse, limit: number): ImageAsset[] {
    if (response.didCancel) {
      return [];
    }
    if (response.errorCode) {
      throw new AppError({
        kind: response.errorCode === 'permission' ? 'permission' : 'unknown',
        message: `Image picker failed: ${response.errorCode}`,
      });
    }

    const assets = (response.assets ?? []).slice(0, limit);
    const read = assets.flatMap(asset => {
      const image = this.toAsset(asset);
      return image ? [image] : [];
    });
    if (read.length < assets.length) {
      log.warn('Picked photos with no file were left out', { skipped: assets.length - read.length });
    }
    return read;
  }

  /**
   * One picked photo. A size the picker did not report reads as 0, so the
   * device's size check passes it and the backend, which measures the file it
   * receives, is the judge.
   */
  private toAsset(asset: Asset): ImageAsset | undefined {
    if (typeof asset.uri !== 'string' || asset.uri.trim() === '') {
      return undefined;
    }
    this.picked += 1;

    return {
      id: `img_${this.launch}_${this.picked}`,
      uri: asset.uri,
      fileName: asset.fileName ?? '',
      mimeType: mimeTypeOf(asset.type),
      sizeBytes: sizeOf(asset.fileSize),
      width: sizeOf(asset.width),
      height: sizeOf(asset.height),
    };
  }
}
