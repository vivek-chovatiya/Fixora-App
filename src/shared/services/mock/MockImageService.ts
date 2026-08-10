/**
 * MockImageService
 *
 * ImageService implementation for the UI-first phase.
 *
 * Validation is real — it enforces the AppConfig.image rules exactly as the
 * production implementation will. Capture, compression and upload are
 * simulated, so image flows can be built and reviewed before the picker library
 * or upload endpoint exist.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import type {
  ImageAsset,
  ImagePickOptions,
  ImageService,
  ImageUploadResult,
  ImageValidationResult,
  UploadProgressListener,
} from '@/shared/services/types/ImageService';
import { delay, mockId, simulateNetwork } from '@/shared/services/mock/mockUtils';
import { AppError } from '@/shared/types/error';

const log = createLogger('MockImageService');

const UPLOAD_STEPS = 5;

/** Placeholder imagery. Requires connectivity; mock-phase only. */
function placeholderUri(id: string): string {
  return `https://picsum.photos/seed/${id}/800/600`;
}

function createAsset(): ImageAsset {
  const id = mockId('img');
  return {
    id,
    uri: placeholderUri(id),
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 1_200_000,
    width: 800,
    height: 600,
  };
}

export class MockImageService implements ImageService {
  private resolveCount(options?: ImagePickOptions): number {
    const requested = options?.maxCount ?? 1;
    return Math.max(1, Math.min(requested, AppConfig.image.maxUploadsPerRequest));
  }

  async pickFromCamera(options?: ImagePickOptions): Promise<ImageAsset[]> {
    return simulateNetwork(() =>
      Array.from({ length: this.resolveCount(options) }, createAsset),
    );
  }

  async pickFromGallery(options?: ImagePickOptions): Promise<ImageAsset[]> {
    return simulateNetwork(() =>
      Array.from({ length: this.resolveCount(options) }, createAsset),
    );
  }

  async compress(asset: ImageAsset): Promise<ImageAsset> {
    return simulateNetwork(() => ({
      ...asset,
      sizeBytes: Math.round(asset.sizeBytes * AppConfig.image.compressionQuality),
    }));
  }

  async generatePreview(asset: ImageAsset): Promise<string> {
    return asset.uri;
  }

  /**
   * Real validation logic — size and MIME type both checked against AppConfig.
   * Synchronous by design so forms can validate without a loading state.
   */
  validate(asset: ImageAsset): ImageValidationResult {
    const allowed = AppConfig.image.allowedMimeTypes as readonly string[];

    if (!allowed.includes(asset.mimeType)) {
      return {
        valid: false,
        reason: 'type',
        message: 'Only JPG, PNG and WebP images are supported.',
      };
    }

    if (asset.sizeBytes > AppConfig.image.maxSizeBytes) {
      const maxMb = Math.round(AppConfig.image.maxSizeBytes / (1024 * 1024));
      return {
        valid: false,
        reason: 'size',
        message: `Images must be smaller than ${maxMb} MB.`,
      };
    }

    return { valid: true };
  }

  async upload(
    asset: ImageAsset,
    onProgress?: UploadProgressListener,
  ): Promise<ImageUploadResult> {
    const validation = this.validate(asset);
    if (!validation.valid) {
      throw new AppError({
        kind: 'validation',
        message: validation.message,
        userMessage: validation.message,
      });
    }

    for (let step = 1; step <= UPLOAD_STEPS; step += 1) {
      await delay(120);
      onProgress?.({
        assetId: asset.id,
        status: 'uploading',
        progress: step / UPLOAD_STEPS,
      });
    }

    return simulateNetwork(() => {
      onProgress?.({ assetId: asset.id, status: 'success', progress: 1 });
      return { assetId: asset.id, remoteUrl: asset.uri };
    });
  }

  async retryUpload(
    asset: ImageAsset,
    onProgress?: UploadProgressListener,
  ): Promise<ImageUploadResult> {
    log.debug('retrying upload', { assetId: asset.id });
    return this.upload(asset, onProgress);
  }

  async remove(assetId: string): Promise<void> {
    return simulateNetwork(() => {
      log.debug('removed asset', { assetId });
    });
  }
}
