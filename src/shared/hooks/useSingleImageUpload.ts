/**
 * Pick one image and upload it. Used for profile photos.
 * Resolves with the server path, or null when cancelled/failed (error exposed).
 */

import { useCallback, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';

import { AppConfig } from '@/core/config/AppConfig';
import { uploadApi, type UploadType } from '@/shared/services/api';
import { AppError } from '@/shared/types/error';

export function useSingleImageUpload(type: UploadType) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const pickAndUpload = useCallback(async (): Promise<string | null> => {
    setError(null);
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: AppConfig.image.compressionQuality as 0.7,
      maxWidth: AppConfig.image.maxDimension,
      maxHeight: AppConfig.image.maxDimension,
    });
    const asset = result.assets?.[0];
    if (result.didCancel || !asset?.uri) {
      return null;
    }
    setIsUploading(true);
    try {
      const [uploaded] = await uploadApi.upload([{ uri: asset.uri, type: asset.type, fileName: asset.fileName }], type);
      return uploaded.url;
    } catch (caught) {
      setError(AppError.from(caught));
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [type]);

  return { pickAndUpload, isUploading, error };
}
