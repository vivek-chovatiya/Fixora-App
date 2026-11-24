/**
 * Image validation
 *
 * One definition of which pictures the app will try to upload, shared by every
 * ImageService implementation: the mock the screens were built against and the
 * real one (`ApiImageService`, Phase 4B). Moved here from `MockImageService` on
 * 24/11/2026 so the two cannot drift — a photo the mock accepted and the real
 * service refused would be a state no screen was ever checked in.
 *
 * Size and type, against `AppConfig.image`, the same limits the backend holds
 * (5 MB; JPEG, PNG or WebP). Synchronous by design, so a form validates without
 * a loading state.
 *
 * ⚠️ A first check, not the judge. The type here is what the picker reported;
 * the backend decides by decoding the bytes (`FILE_TYPE_NOT_ALLOWED`) and
 * measures the file it received (`FILE_TOO_LARGE`). This only stops a file that
 * is certain to be refused from costing an upload.
 */

import { AppConfig } from '@/core/config/AppConfig';
import type { ImageAsset, ImageValidationResult } from '@/shared/services/types/ImageService';

export function validateImageAsset(
  asset: Pick<ImageAsset, 'mimeType' | 'sizeBytes'>,
): ImageValidationResult {
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
