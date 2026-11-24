/**
 * ApiImageService is the phone's camera and photo library and the backend's
 * `POST /uploads` (Phase 4B contract §1, 24/11/2026). What is pinned here is
 * what crosses each of those lines:
 *
 * - the picker is asked for a photo at the app's own size and quality, with
 *   nothing extra read from it (`includeExtra: false` — a photo can carry the
 *   position of somebody's home), and never for more than a request may hold;
 * - the camera is asked for through the PermissionService before it opens, and
 *   a refusal opens nothing; the library asks for no permission at all;
 * - backing out is no photo, not a failure; a picker error rejects by its code;
 * - an upload is exactly two parts — `type` (the purpose) and one `files` part
 *   — under `multipart/form-data`, with a neutral file name: the device's own
 *   never travels;
 * - progress is the platform's own figure, then done; the answer is the stored
 *   path as an address this phone can load;
 * - the backend's refusals of the file are validation failures with the app's
 *   copy, never retryable; a transport failure stays what it was.
 *
 * The picker is a jest mock and the backend a fake axios adapter on the real
 * HttpClient, so the multipart call runs through the real client. React
 * Native's FormData is stood in for by one that records its parts.
 */

import {
  AxiosError,
  type AxiosAdapter,
  type AxiosProgressEvent,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import { ApiImageService } from '@/shared/services/api/ApiImageService';
import { MockImageService } from '@/shared/services/mock/MockImageService';
import type { ImageAsset, ImageUploadPurpose } from '@/shared/services/types/ImageService';
import type { PermissionService, PermissionStatus } from '@/shared/services/types/PermissionService';
import { AppError } from '@/shared/types/error';

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

const camera = launchCamera as jest.Mock;
const library = launchImageLibrary as jest.Mock;

/** React Native's FormData, as far as this service uses it: parts, in order. */
class RecordingFormData {
  readonly parts: [string, unknown][] = [];

  append(name: string, value: unknown): void {
    this.parts.push([name, value]);
  }

  // What axios recognises a form by when it is not the platform's own class.
  get [Symbol.toStringTag](): string {
    return 'FormData';
  }
}

const realFormData = globalThis.FormData;

type Reply = { status: number; body: unknown } | 'network';

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

/** Answers every request with `reply`, reporting `progress` on the way if given. */
function backendAnswers(reply: Reply, progress: Partial<AxiosProgressEvent>[] = []): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    for (const event of progress) {
      config.onUploadProgress?.({ loaded: 0, bytes: 0, upload: true, ...event } as AxiosProgressEvent);
    }
    if (reply === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response: AxiosResponse = {
      data: reply.body,
      status: reply.status,
      statusText: '',
      headers: {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

const PATH = '/uploads/request/9f3c0a1b2c3d4e5f60718293a4b5c6e1.jpg';
const ORIGIN = AppConfig.api.baseUrl.replace(/\/api\/v1\/?$/, '');

function stored(path = PATH, extra: Record<string, unknown> = {}): Reply {
  return {
    status: 201,
    body: {
      success: true,
      message: 'Uploaded',
      data: {
        files: [
          {
            id: '6b0a1c2d3e4f5a6b7c8d9e0f',
            path,
            url: `http://192.168.1.20:5000${path}`,
            type: 'request',
            mimeType: 'image/jpeg',
            sizeBytes: 412345,
            ...extra,
          },
        ],
      },
      meta: {},
      errors: null,
    },
  };
}

function failure(status: number, code: string): Reply {
  return {
    status,
    body: { success: false, message: 'Backend English', code, errors: [{ field: 'files', message: 'x' }], data: null },
  };
}

/** The device's own file name, which must never travel. */
const DEVICE_NAME = 'IMG_20261124_kitchen_42_Park_Street.jpg';

const ASSET: ImageAsset = {
  id: 'img_test_1',
  uri: 'file:///data/user/0/com.fixora/cache/rn_image_picker_lib_temp_1.jpg',
  fileName: DEVICE_NAME,
  mimeType: 'image/jpeg',
  sizeBytes: 412_345,
  width: 1600,
  height: 1200,
};

function picked(extra: Partial<Asset> = {}): Asset {
  return {
    uri: 'file:///data/user/0/com.fixora/cache/rn_image_picker_lib_temp_1.jpg',
    fileName: DEVICE_NAME,
    type: 'image/jpeg',
    fileSize: 412_345,
    width: 1600,
    height: 1200,
    ...extra,
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

let cameraStatus: PermissionStatus;
let requestPermission: jest.Mock;
let service: ApiImageService;

beforeAll(() => {
  (globalThis as { FormData: unknown }).FormData = RecordingFormData;
});

afterAll(() => {
  (globalThis as { FormData: unknown }).FormData = realFormData;
});

beforeEach(() => {
  sent.length = 0;
  camera.mockReset();
  library.mockReset();
  for (const method of ['log', 'warn', 'error'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  cameraStatus = 'granted';
  requestPermission = jest.fn(async () => cameraStatus);
  const permissions: PermissionService = {
    check: jest.fn(async () => cameraStatus),
    request: requestPermission,
    openSettings: jest.fn(async () => undefined),
  };
  service = new ApiImageService({ permissions: () => permissions });
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

/** The options every pick is made with: a photo, at the app's size and quality, nothing extra. */
const PICK_AS = {
  mediaType: 'photo',
  maxWidth: AppConfig.image.maxDimension,
  maxHeight: AppConfig.image.maxDimension,
  quality: AppConfig.image.compressionQuality,
  includeBase64: false,
  includeExtra: false,
};

describe('choosing from the library', () => {
  it('asks for a photo at the app’s size and quality, reading nothing extra from it', async () => {
    library.mockResolvedValueOnce({ assets: [picked()] });

    await service.pickFromGallery({ maxCount: 3 });

    expect(library).toHaveBeenCalledTimes(1);
    expect(library.mock.calls[0][0]).toEqual({ ...PICK_AS, selectionLimit: 3 });
  });

  it.each([
    ['nothing asked', undefined, 1],
    ['more than a request holds', { maxCount: 9 }, AppConfig.image.maxUploadsPerRequest],
    ['none', { maxCount: 0 }, 1],
    ['a number that is not one', { maxCount: Number.NaN }, 1],
  ])('never asks for an unlimited pick: %s → %s', async (_case, options, limit) => {
    library.mockResolvedValueOnce({ assets: [] });

    await service.pickFromGallery(options);

    // 0 is the library's "no limit", so it must never be sent.
    expect(library.mock.calls[0][0].selectionLimit).toBe(limit);
  });

  it('asks for no permission: the system picker hands over only what was chosen', async () => {
    library.mockResolvedValueOnce({ assets: [picked()] });

    await service.pickFromGallery();

    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('reads each photo into an asset with its own id', async () => {
    library.mockResolvedValueOnce({
      assets: [picked(), picked({ uri: 'file:///cache/2.png', type: 'image/png', fileSize: 1000 })],
    });

    const assets = await service.pickFromGallery({ maxCount: 2 });

    expect(assets).toHaveLength(2);
    expect(assets[0]).toEqual({
      id: expect.any(String),
      uri: 'file:///data/user/0/com.fixora/cache/rn_image_picker_lib_temp_1.jpg',
      fileName: DEVICE_NAME,
      mimeType: 'image/jpeg',
      sizeBytes: 412_345,
      width: 1600,
      height: 1200,
    });
    expect(assets[1].mimeType).toBe('image/png');
    expect(assets[0].id).not.toBe(assets[1].id);
  });

  it('reads a gallery’s image/jpg or upper case as the JPEG it is', async () => {
    library.mockResolvedValueOnce({ assets: [picked({ type: 'image/jpg' }), picked({ type: 'IMAGE/JPEG' })] });

    const assets = await service.pickFromGallery({ maxCount: 2 });

    expect(assets.map(asset => asset.mimeType)).toEqual(['image/jpeg', 'image/jpeg']);
    expect(assets.every(asset => service.validate(asset).valid)).toBe(true);
  });

  it('leaves out a photo with no file, and never returns more than was asked for', async () => {
    library.mockResolvedValueOnce({ assets: [picked({ uri: undefined }), picked(), picked(), picked()] });

    const assets = await service.pickFromGallery({ maxCount: 2 });

    expect(assets).toHaveLength(1);
  });

  it('answers backing out with no photo, not a failure', async () => {
    library.mockResolvedValueOnce({ didCancel: true });

    await expect(service.pickFromGallery()).resolves.toEqual([]);
  });

  it.each([
    ['permission', 'permission'],
    ['camera_unavailable', 'unknown'],
    ['others', 'unknown'],
  ])('rejects a picker error %s as %s, by its code alone', async (errorCode, kind) => {
    library.mockResolvedValueOnce({ errorCode, errorMessage: '/storage/emulated/0/DCIM/private.jpg' });

    const error = await rejectionOf(service.pickFromGallery());

    expect(error.kind).toBe(kind);
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain('private.jpg');
  });
});

describe('taking a photo', () => {
  it('asks for the camera through the permission service before opening it', async () => {
    camera.mockResolvedValueOnce({ assets: [picked()] });

    const assets = await service.pickFromCamera({ maxCount: 4 });

    expect(requestPermission).toHaveBeenCalledWith('camera');
    expect(requestPermission.mock.invocationCallOrder[0]).toBeLessThan(camera.mock.invocationCallOrder[0]);
    // One photo, never saved to the phone's own gallery.
    expect(camera.mock.calls[0][0]).toEqual({ ...PICK_AS, saveToPhotos: false });
    expect(assets).toHaveLength(1);
  });

  it.each(['denied', 'blocked', 'unavailable'] as const)(
    'opens nothing when the camera is %s, and says permission is the reason',
    async status => {
      cameraStatus = status;

      const error = await rejectionOf(service.pickFromCamera());

      expect(error.kind).toBe('permission');
      expect(camera).not.toHaveBeenCalled();
    },
  );

  it('answers backing out of the camera with no photo', async () => {
    camera.mockResolvedValueOnce({ didCancel: true });

    await expect(service.pickFromCamera()).resolves.toEqual([]);
  });
});

describe('before the upload', () => {
  it('returns the picked asset as it is: the picker already compressed it', async () => {
    await expect(service.compress(ASSET)).resolves.toBe(ASSET);
    await expect(service.generatePreview(ASSET)).resolves.toBe(ASSET.uri);
  });

  it.each([
    ['a JPEG', ASSET],
    ['a HEIC', { ...ASSET, mimeType: 'image/heic' }],
    ['a GIF', { ...ASSET, mimeType: 'image/gif' }],
    ['one over the limit', { ...ASSET, sizeBytes: AppConfig.image.maxSizeBytes + 1 }],
    ['one exactly at the limit', { ...ASSET, sizeBytes: AppConfig.image.maxSizeBytes }],
  ])('validates %s exactly as the mock does', (_case, asset) => {
    expect(service.validate(asset)).toEqual(new MockImageService().validate(asset));
  });
});

describe('uploading', () => {
  it('posts exactly a type part and one file part, as multipart, to /uploads', async () => {
    backendAnswers(stored());

    await service.upload(ASSET, 'request');

    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/uploads');
    expect(String(sent[0].headers['Content-Type'])).toContain('multipart/form-data');
    const form = sent[0].data as RecordingFormData;
    expect(form).toBeInstanceOf(RecordingFormData);
    expect(form.parts).toEqual([
      ['type', 'request'],
      ['files', { uri: ASSET.uri, name: 'photo.jpg', type: 'image/jpeg' }],
    ]);
  });

  it('never sends the device’s own file name', async () => {
    backendAnswers(stored());

    await service.upload(ASSET, 'request');

    expect(JSON.stringify((sent[0].data as RecordingFormData).parts)).not.toContain('IMG_');
  });

  it.each([
    ['image/png', 'photo.png'],
    ['image/webp', 'photo.webp'],
  ])('names a %s file by its type alone', async (mimeType, name) => {
    backendAnswers(stored());

    await service.upload({ ...ASSET, mimeType }, 'shop');

    expect((sent[0].data as RecordingFormData).parts[1]).toEqual([
      'files',
      { uri: ASSET.uri, name, type: mimeType },
    ]);
  });

  it.each(['request', 'profile', 'shop', 'team'] as ImageUploadPurpose[])(
    'sends the purpose %s as the backend’s type, word for word',
    async purpose => {
      backendAnswers(stored());

      await service.upload(ASSET, purpose);

      expect((sent[0].data as RecordingFormData).parts[0]).toEqual(['type', purpose]);
    },
  );

  it('answers with the stored path as an address this phone can load', async () => {
    backendAnswers(stored());

    await expect(service.upload(ASSET, 'request')).resolves.toEqual({
      assetId: ASSET.id,
      // The API's own origin — never the host the backend happened to see.
      remoteUrl: `${ORIGIN}${PATH}`,
    });
  });

  it('reports the platform’s own progress, then done', async () => {
    backendAnswers(stored(), [{ loaded: 25, total: 100, progress: 0.25 }, { loaded: 100, total: 100 }]);
    const onProgress = jest.fn();

    await service.upload(ASSET, 'request', onProgress);

    expect(onProgress.mock.calls.map(([state]) => state)).toEqual([
      { assetId: ASSET.id, status: 'uploading', progress: 0.25 },
      { assetId: ASSET.id, status: 'uploading', progress: 1 },
      { assetId: ASSET.id, status: 'success', progress: 1 },
    ]);
  });

  it('reports no figure while the size is unknown', async () => {
    backendAnswers(stored(), [{ loaded: 40 }]);
    const onProgress = jest.fn();

    await service.upload(ASSET, 'request', onProgress);

    expect(onProgress.mock.calls.map(([state]) => state.status)).toEqual(['success']);
  });

  it.each([
    ['a type the backend refuses', { ...ASSET, mimeType: 'image/heic' }],
    ['a file over the limit', { ...ASSET, sizeBytes: AppConfig.image.maxSizeBytes + 1 }],
  ])('refuses %s before sending anything', async (_case, asset) => {
    backendAnswers(stored());

    const error = await rejectionOf(service.upload(asset, 'request'));

    expect(error.kind).toBe('validation');
    expect(error.userMessage).toBe(service.validate(asset).message);
    expect(sent).toHaveLength(0);
  });

  it('refuses a purpose the backend does not take, sending nothing', async () => {
    backendAnswers(stored());

    const error = await rejectionOf(service.upload(ASSET, 'avatar' as ImageUploadPurpose));

    expect(error.kind).toBe('validation');
    expect(sent).toHaveLength(0);
  });

  it.each([
    [413, 'FILE_TOO_LARGE', 'This photo is too large to upload. Please choose a smaller one.'],
    [400, 'FILE_TYPE_NOT_ALLOWED', 'Only JPG, PNG and WebP images are supported.'],
    [400, 'TOO_MANY_FILES', 'Too many photos were sent at once. Please try again with fewer.'],
  ])('reads %s %s as a refusal of the file, with its copy, not to be retried', async (status, code, copy) => {
    backendAnswers(failure(status, code));

    const error = await rejectionOf(service.upload(ASSET, 'request'));

    expect(error.kind).toBe('validation');
    expect(error.code).toBe(code);
    expect(error.userMessage).toBe(copy);
    expect(error.isRetryable).toBe(false);
    expect(error.userMessage).not.toContain('Backend English');
  });

  it('keeps a lost connection what it was, so the photo offers Try again', async () => {
    backendAnswers('network');

    const error = await rejectionOf(service.upload(ASSET, 'request'));

    expect(error.kind).toBe('network');
    expect(error.isRetryable).toBe(true);
  });

  it.each([
    ['no files', { status: 201, body: { success: true, data: { files: [] } } }],
    ['two files for one photo', {
      status: 201,
      body: { success: true, data: { files: [{ path: PATH }, { path: PATH }] } },
    }],
    ['no path', stored(PATH, { path: undefined })],
    ['a path that is not one', stored('uploads/request/a.jpg')],
  ] as [string, Reply][])('refuses an answer with %s as a server fault', async (_case, reply) => {
    backendAnswers(reply);

    const error = await rejectionOf(service.upload(ASSET, 'request'));

    expect(error.kind).toBe('server');
  });

  it('retries as one more upload of the same file, for the same purpose', async () => {
    backendAnswers(stored());

    await expect(service.retryUpload(ASSET, 'team')).resolves.toEqual({
      assetId: ASSET.id,
      remoteUrl: `${ORIGIN}${PATH}`,
    });
    expect((sent[0].data as RecordingFormData).parts[0]).toEqual(['type', 'team']);
  });
});

describe('removing', () => {
  it('asks the backend nothing: there is no way to delete an upload yet', async () => {
    backendAnswers(stored());

    await expect(service.remove(ASSET.id)).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});
