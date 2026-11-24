/**
 * useImageUploads
 *
 * Picks images (camera or gallery) and uploads each one immediately, tracking
 * per-image state so the UI can show progress, failure and retry
 * (App PROJECT_BIBLE §16). `isBusy` / `hasFailures` let the caller block submit
 * until every required upload has actually succeeded.
 */

import { useCallback, useMemo, useState } from 'react';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { uploadApi, type UploadType } from '@/shared/services/api';
import { AppError } from '@/shared/types/error';

const log = createLogger('useImageUploads');

export type UploadStatus = 'uploading' | 'uploaded' | 'failed';

export interface UploadItem {
  key: string;
  localUri: string;
  type?: string;
  fileName?: string;
  status: UploadStatus;
  /** Server path once uploaded. */
  url?: string;
  error?: string;
}

export function useImageUploads(type: UploadType, initialUrls: string[] = [], max: number = AppConfig.image.maxUploadsPerRequest) {
  const [items, setItems] = useState<UploadItem[]>(() =>
    initialUrls.map(url => ({ key: url, localUri: url, url, status: 'uploaded' as const })),
  );

  const patch = (key: string, update: Partial<UploadItem>) =>
    setItems(prev => prev.map(item => (item.key === key ? { ...item, ...update } : item)));

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      patch(item.key, { status: 'uploading', error: undefined });
      try {
        const [uploaded] = await uploadApi.upload([{ uri: item.localUri, type: item.type, fileName: item.fileName }], type);
        patch(item.key, { status: 'uploaded', url: uploaded.url });
      } catch (caught) {
        const error = AppError.from(caught);
        log.warn('upload failed', { kind: error.kind });
        patch(item.key, { status: 'failed', error: error.userMessage });
      }
    },
    [type],
  );

  const addAssets = useCallback(
    (assets: Asset[]) => {
      const accepted: UploadItem[] = [];
      const rejected: string[] = [];
      assets.forEach((asset, index) => {
        if (!asset.uri) {
          return;
        }
        if (asset.fileSize && asset.fileSize > AppConfig.image.maxSizeBytes) {
          rejected.push('Image is larger than 5 MB.');
          return;
        }
        accepted.push({
          key: `${Date.now()}-${index}-${asset.uri.slice(-12)}`,
          localUri: asset.uri,
          type: asset.type,
          fileName: asset.fileName,
          status: 'uploading',
        });
      });
      setItems(prev => [...prev, ...accepted].slice(0, max));
      accepted.forEach(item => void uploadOne(item));
      return rejected;
    },
    [max, uploadOne],
  );

  const pick = useCallback(
    async (source: 'camera' | 'gallery'): Promise<string[]> => {
      const remaining = max - items.length;
      if (remaining <= 0) {
        return [`You can attach up to ${max} images.`];
      }
      const options = {
        mediaType: 'photo' as const,
        quality: AppConfig.image.compressionQuality as 0.7,
        maxWidth: AppConfig.image.maxDimension,
        maxHeight: AppConfig.image.maxDimension,
        selectionLimit: remaining,
      };
      const result = source === 'camera' ? await launchCamera(options) : await launchImageLibrary(options);
      if (result.didCancel) {
        return [];
      }
      if (result.errorCode) {
        return [result.errorCode === 'permission' ? 'Permission is required to access photos.' : 'Could not open the camera or gallery.'];
      }
      return addAssets(result.assets ?? []);
    },
    [addAssets, items.length, max],
  );

  const retry = useCallback((key: string) => {
    const item = items.find(i => i.key === key);
    if (item) {
      void uploadOne(item);
    }
  }, [items, uploadOne]);

  const remove = useCallback((key: string) => setItems(prev => prev.filter(i => i.key !== key)), []);

  return useMemo(
    () => ({
      items,
      pick,
      retry,
      remove,
      canAddMore: items.length < max,
      urls: items.filter(i => i.status === 'uploaded' && i.url).map(i => i.url as string),
      isBusy: items.some(i => i.status === 'uploading'),
      hasFailures: items.some(i => i.status === 'failed'),
    }),
    [items, pick, retry, remove, max],
  );
}

export type ImageUploadsController = ReturnType<typeof useImageUploads>;
