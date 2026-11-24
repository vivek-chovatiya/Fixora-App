/**
 * useImageUpload's progress (Phase 3G-4, 21/10/2026): the upload's own report
 * of how far it has got, as a fraction a photo field can draw.
 *
 * The rules pinned here are the ones a bar gets wrong:
 *
 * - `null` until the service has reported — never 0%, which through picking
 *   and compressing would read as a stuck upload
 * - the reported fraction, held to 0–1, a non-number ignored
 * - cleared when the upload lands and when it fails
 * - a report from an attempt that has ended — after it landed, after it
 *   failed and a retry began, after unmount — is dropped, so a late report
 *   never draws a bar under a finished or a different upload
 * - the hook's earlier contract is untouched: `isRunning()` from the tap, one
 *   action at a time, the compressed file uploaded
 * - the upload names the purpose its caller gave (Phase 4B): the backend
 *   attaches a picture only to a field of its own kind
 *
 * The screens' own picture tests (customer profile, business picture, team
 * member) still cover what happens to the uploaded URL.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useImageUpload, type ImageUpload } from '@/shared/hooks/useImageUpload';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  ImageAsset,
  ImageService,
  ImageUploadResult,
  UploadProgressListener,
} from '@/shared/services/types/ImageService';
import { AppError } from '@/shared/types/error';

const PICKED: ImageAsset = {
  id: 'img_1',
  uri: 'file:///tmp/photo.jpg',
  fileName: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 900_000,
  width: 2000,
  height: 1500,
};

const COMPRESSED: ImageAsset = { ...PICKED, uri: 'file:///tmp/photo-small.jpg', sizeBytes: 200_000 };

const REMOTE = 'https://cdn.example.com/photo.jpg';

/** One upload the test answers by hand, with the listener it was given. */
interface HeldUpload {
  report: UploadProgressListener;
  land: () => void;
  fail: () => void;
}

let latest: ImageUpload;
let uploads: HeldUpload[];
let attached: string[];
let upload: jest.Mock;

function Probe() {
  latest = useImageUpload({
    purpose: 'team',
    attach: url => {
      attached.push(url);
    },
    detach: () => undefined,
  });
  return null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function mount() {
  await act(async () => {
    mounted.push(ReactTestRenderer.create(<Probe />));
  });
}

async function settle() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {});
  }
}

beforeEach(() => {
  resetServices();
  uploads = [];
  attached = [];
  upload = jest.fn(
    (_asset: ImageAsset, _purpose: string, onProgress?: UploadProgressListener) =>
      new Promise<ImageUploadResult>((resolve, reject) => {
        uploads.push({
          report: state => onProgress?.(state),
          land: () => resolve({ assetId: PICKED.id, remoteUrl: REMOTE }),
          fail: () => reject(new AppError({ kind: 'network', message: 'offline' })),
        });
      }),
  );
  registerService('image', {
    pickFromCamera: jest.fn(async () => [PICKED]),
    pickFromGallery: jest.fn(async () => [PICKED]),
    validate: jest.fn(() => ({ valid: true })),
    compress: jest.fn(async () => COMPRESSED),
    upload,
  } as unknown as ImageService);
});

afterEach(async () => {
  // Unmounted even when an assertion failed part-way (CLAUDE.md section 7).
  while (mounted.length > 0) {
    const renderer = mounted.pop()!;
    await act(async () => {
      renderer.unmount();
    });
  }
  resetServices();
});

/** Starts an upload from the gallery and waits until the service has it. */
async function startUpload() {
  act(() => {
    latest.choose('gallery');
  });
  await settle();
  expect(uploads.length).toBeGreaterThan(0);
  return uploads[uploads.length - 1];
}

async function report(held: HeldUpload, progress: number) {
  await act(async () => {
    held.report({ assetId: COMPRESSED.id, status: 'uploading', progress });
  });
}

describe('useImageUpload — progress', () => {
  it('is null at rest, and stays null through an upload that has not reported yet', async () => {
    await mount();
    expect(latest.progress).toBeNull();

    await startUpload();

    expect(latest.isBusy).toBe(true);
    // Uploading, but how far is not known: not 0%.
    expect(latest.progress).toBeNull();
  });

  it('gives the uploader’s own reports as a fraction, as they come', async () => {
    await mount();
    const held = await startUpload();

    await report(held, 0.2);
    expect(latest.progress).toBe(0.2);

    await report(held, 0.42);
    expect(latest.progress).toBe(0.42);
    expect(latest.isBusy).toBe(true);
  });

  it('hands the uploader the compressed file, the caller’s purpose and a listener', async () => {
    await mount();
    await startUpload();

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(COMPRESSED, 'team', expect.any(Function));
  });

  it('holds a report to 0–1, and ignores one that is not a number', async () => {
    await mount();
    const held = await startUpload();

    await report(held, 1.02);
    expect(latest.progress).toBe(1);

    await report(held, -0.1);
    expect(latest.progress).toBe(0);

    await report(held, 0.5);
    await report(held, Number.NaN);
    expect(latest.progress).toBe(0.5);
    await report(held, 'half' as unknown as number);
    expect(latest.progress).toBe(0.5);
  });

  it('clears when the upload lands, and the picture is attached', async () => {
    await mount();
    const held = await startUpload();
    await report(held, 0.8);

    await act(async () => {
      held.land();
    });
    await settle();

    expect(attached).toEqual([REMOTE]);
    expect(latest.status).toBe('idle');
    expect(latest.progress).toBeNull();
  });

  it('clears when the upload fails, keeping the picture for Try again', async () => {
    await mount();
    const held = await startUpload();
    await report(held, 0.6);

    await act(async () => {
      held.fail();
    });
    await settle();

    expect(latest.status).toBe('failed');
    expect(latest.pending).toEqual(PICKED);
    expect(latest.progress).toBeNull();
  });

  it('drops a report that arrives after its upload has landed', async () => {
    await mount();
    const held = await startUpload();

    await act(async () => {
      held.land();
    });
    await settle();
    await report(held, 0.9);

    expect(latest.status).toBe('idle');
    expect(latest.progress).toBeNull();
  });

  it('never draws a failed attempt’s late report under the retry', async () => {
    await mount();
    const first = await startUpload();
    await act(async () => {
      first.fail();
    });
    await settle();

    act(() => {
      latest.retry();
    });
    await settle();
    const second = uploads[1];
    expect(second).toBeDefined();
    expect(latest.progress).toBeNull();

    // The first attempt reports once more after it failed: not this upload's.
    await report(first, 0.95);
    expect(latest.progress).toBeNull();

    await report(second, 0.3);
    expect(latest.progress).toBe(0.3);
  });

  it('ignores a report after unmount, and settles without complaint', async () => {
    await mount();
    const held = await startUpload();
    await report(held, 0.4);

    const renderer = mounted.pop()!;
    await act(async () => {
      renderer.unmount();
    });

    await expect(
      act(async () => {
        held.report({ assetId: COMPRESSED.id, status: 'uploading', progress: 0.7 });
        held.land();
      }),
    ).resolves.toBeUndefined();
  });
});

describe('useImageUpload — what was already there', () => {
  it('is running from the tap, a render before isBusy lands, and not once it ends', async () => {
    await mount();

    act(() => {
      latest.choose('camera');
      // Read inside the same act: no render has happened yet.
      expect(latest.isRunning()).toBe(true);
    });
    await settle();

    await act(async () => {
      uploads[0].land();
    });
    await settle();
    expect(latest.isRunning()).toBe(false);
  });

  it('runs one action at a time, however often it is asked', async () => {
    await mount();
    await startUpload();

    act(() => {
      latest.choose('gallery');
      latest.choose('camera');
      latest.remove();
    });
    await settle();

    expect(upload).toHaveBeenCalledTimes(1);
  });
});
