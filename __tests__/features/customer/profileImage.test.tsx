/**
 * The profile picture (PROJECT_BIBLE.md section 25, Phase 3D-8).
 *
 * The rule section 16 sets for a request's photographs is the rule here, and it
 * is what most of this file exists to pin: nobody may be left believing a
 * picture was saved when the upload that would have saved it failed.
 *
 * Pinned here:
 *
 * - the avatar shows the stored picture, then initials, then the glyph
 * - choosing one validates, compresses, uploads and only then changes the
 *   account — in that order, and never a local file into the session
 * - backing out of the picker is not a failure
 * - a refusal keeps the chosen image for a retry, leaves the avatar showing
 *   what is still stored, and says nothing in the service's own words
 * - Discard forgets it; Remove deletes a stored one
 * - nothing can be started twice while something is running
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { CustomerProfileScreen } from '@/features/customer/screens/CustomerProfileScreen';
import { RequestDraftProvider } from '@/features/customer/state/RequestDraftContext';
import { setRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService } from '@/shared/services/types/AuthService';
import type {
  ImageAsset,
  ImageService,
  UploadProgressListener,
} from '@/shared/services/types/ImageService';
import type { ProfileService } from '@/shared/services/types/ProfileService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = CUSTOMER_COPY.profile;

const ASHA: AuthUser = {
  id: 'usr_customer_1',
  firstName: 'Asha',
  lastName: 'Patel',
  phone: '9876543210',
  role: 'customer',
};

const PICKED: ImageAsset = {
  id: 'img_1',
  uri: 'file:///tmp/selfie.jpg',
  fileName: 'selfie.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 900_000,
  width: 2000,
  height: 2000,
};

const COMPRESSED: ImageAsset = {
  ...PICKED,
  uri: 'file:///tmp/selfie-small.jpg',
  sizeBytes: 200_000,
};

const REMOTE = 'https://cdn.example.com/avatars/usr_customer_1.jpg';

type UploadResult = { assetId: string; remoteUrl: string };

function textOf(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string {
  if (node === null) {
    return '';
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(' ');
  }
  return (node.children ?? [])
    .map(child => (typeof child === 'string' ? child : textOf(child as ReactTestRendererJSON)))
    .join(' ');
}

interface Options {
  user?: AuthUser;
  /** What the picker returns. An empty array is a cancelled pick. */
  picked?: ImageAsset[];
  valid?: boolean;
  onUpload?: (
    asset: ImageAsset,
    purpose: string,
    onProgress?: UploadProgressListener,
  ) => Promise<UploadResult>;
  onSetImage?: (url: string) => Promise<AuthUser>;
}

async function render(options: Options = {}) {
  const { user = ASHA, picked = [PICKED], valid = true, onUpload, onSetImage } = options;

  setSessionStorage({
    read: async () => ({ token: 'token', user }),
    write: async () => undefined,
    clear: async () => undefined,
  });
  setRequestDraftStorage({
    read: async () => null,
    write: async () => true,
    clear: async () => undefined,
  });

  const order: string[] = [];

  const pickFromGallery = jest.fn(async () => {
    order.push('pick');
    return picked;
  });
  const compress = jest.fn(async () => {
    order.push('compress');
    return COMPRESSED;
  });
  const validate = jest.fn(() => {
    order.push('validate');
    return valid
      ? { valid: true }
      : { valid: false as const, reason: 'size' as const, message: 'Too big.' };
  });
  const upload = jest.fn(
    onUpload ??
      (async () => {
        order.push('upload');
        return { assetId: PICKED.id, remoteUrl: REMOTE };
      }),
  );

  registerService('image', {
    pickFromCamera: jest.fn(async () => {
      order.push('pick');
      return picked;
    }),
    pickFromGallery,
    compress,
    generatePreview: jest.fn(async () => COMPRESSED.uri),
    validate,
    upload,
    retryUpload: upload,
    remove: jest.fn(async () => undefined),
  } as unknown as ImageService);

  const setProfileImage = jest.fn(
    onSetImage ??
      (async (url: string) => {
        order.push('attach');
        return { ...user, avatarUrl: url };
      }),
  );
  const removeProfileImage = jest.fn(async () => {
    const stripped = { ...user };
    delete stripped.avatarUrl;
    return stripped;
  });

  registerService('profile', {
    updateProfile: jest.fn(),
    setProfileImage,
    removeProfileImage,
  } as unknown as ProfileService);

  registerService('auth', { signOut: jest.fn(async () => undefined) } as unknown as AuthService);

  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user }));

  const navigation = { navigate: jest.fn() } as never;
  const route = { key: 'Profile', name: 'Profile' as const } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <RequestDraftProvider ownerId={user.id}>
            <CustomerProfileScreen navigation={navigation} route={route} />
          </RequestDraftProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  await act(async () => {});

  const byTestID = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);

  const button = (label: string) =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    );

  const press = async (label: string) => {
    const [target] = button(label);
    if (!target) {
      throw new Error(`Nothing labelled "${label}"`);
    }
    await act(async () => {
      target.props.onPress();
    });
    await act(async () => {});
  };

  return {
    store,
    renderer,
    order,
    setProfileImage,
    removeProfileImage,
    upload,
    compress,
    byTestID,
    button,
    press,
    text: () => textOf(renderer.toJSON()),
    /** What the avatar is currently drawing, if anything. */
    avatarUri: (): string | undefined =>
      renderer.root
        .findAll(node => node.props?.testID === 'profile-avatar')
        .flatMap(node => node.findAll(child => typeof child.props?.source?.uri === 'string'))
        .map(child => child.props.source.uri as string)[0],
  };
}

afterEach(() => {
  resetServices();
});

describe('the avatar', () => {
  it('draws the stored picture when there is one', async () => {
    const { avatarUri } = await render({ user: { ...ASHA, avatarUrl: REMOTE } });

    expect(avatarUri()).toBe(REMOTE);
  });

  it('falls back to initials when there is no picture', async () => {
    const { avatarUri, byTestID } = await render();

    expect(avatarUri()).toBeUndefined();
    expect(byTestID('profile-avatar')[0]?.props.accessibilityLabel).toBe(
      'Asha Patel profile picture',
    );
  });

  it('offers Remove only once there is a picture to remove', async () => {
    const without = await render();
    expect(without.button(COPY.photoRemove)).toHaveLength(0);

    const withOne = await render({ user: { ...ASHA, avatarUrl: REMOTE } });
    expect(withOne.button(COPY.photoRemove).length).toBeGreaterThan(0);
  });
});

describe('choosing a picture', () => {
  it('validates, compresses, uploads, then attaches — in that order', async () => {
    const { press, order, setProfileImage } = await render();

    await press(COPY.photoGallery);

    expect(order).toEqual(['pick', 'validate', 'compress', 'upload', 'attach']);
    expect(setProfileImage).toHaveBeenCalledWith(REMOTE);
  });

  it('uploads the compressed file, never the original', async () => {
    const { press, upload } = await render();

    await press(COPY.photoGallery);

    // With a progress listener since 3G-4; the file is still the compressed one,
    // uploaded as the account's own picture (Phase 4B).
    expect(upload).toHaveBeenCalledWith(COMPRESSED, 'profile', expect.any(Function));
    expect(upload).not.toHaveBeenCalledWith(PICKED, expect.anything(), expect.anything());
  });

  it('puts the uploaded url into the session, never the local file', async () => {
    const { press, store } = await render();

    await press(COPY.photoGallery);

    expect(store.getState().auth.user?.avatarUrl).toBe(REMOTE);
    expect(store.getState().auth.user?.avatarUrl).not.toMatch(/^file:/);
  });

  it('treats backing out of the picker as nothing happening', async () => {
    const { press, setProfileImage, text, byTestID } = await render({ picked: [] });

    await press(COPY.photoGallery);

    expect(setProfileImage).not.toHaveBeenCalled();
    expect(byTestID('profile-photo-error')).toHaveLength(0);
    expect(text()).not.toContain(COPY.photoFailedTitle);
  });

  it('refuses an image the device rules reject, without uploading it', async () => {
    const { press, upload, setProfileImage, text } = await render({ valid: false });

    await press(COPY.photoGallery);

    expect(upload).not.toHaveBeenCalled();
    expect(setProfileImage).not.toHaveBeenCalled();
    expect(text()).toContain(COPY.photoFailedTitle);
  });
});

describe('when saving the picture fails', () => {
  const refuse = async (): Promise<UploadResult> => {
    throw new AppError({ kind: 'server', message: 'Mock upload refused' });
  };

  it('leaves the avatar showing what is still stored, not the failed pick', async () => {
    const { press, avatarUri } = await render({
      user: { ...ASHA, avatarUrl: REMOTE },
      onUpload: refuse,
    });

    await press(COPY.photoGallery);

    // Emphatically not the local file: it was never saved.
    expect(avatarUri()).toBe(REMOTE);
  });

  it('says so in safe words, never the service’s own', async () => {
    const { press, text } = await render({ onUpload: refuse });

    await press(COPY.photoGallery);

    expect(text()).toContain(COPY.photoFailedTitle);
    expect(text()).not.toContain('Mock upload refused');
  });

  it('keeps the chosen image so it can be tried again, without picking twice', async () => {
    const r = await render({ onUpload: refuse });
    await r.press(COPY.photoGallery);

    await r.press(COPY.photoRetry);

    // One pick, two attempts to save it.
    expect(r.order.filter(step => step === 'pick')).toHaveLength(1);
    expect(r.upload).toHaveBeenCalledTimes(2);
  });

  it('forgets it on Discard, and stops offering a retry', async () => {
    const r = await render({ onUpload: refuse });
    await r.press(COPY.photoGallery);

    await r.press(COPY.photoDiscard);

    expect(r.button(COPY.photoRetry)).toHaveLength(0);
    expect(r.text()).not.toContain(COPY.photoFailedTitle);
  });

  it('leaves the session alone when attaching is what failed', async () => {
    const { press, store } = await render({
      onSetImage: async () => {
        throw new AppError({ kind: 'server', message: 'Mock attach refused' });
      },
    });

    await press(COPY.photoGallery);

    expect(store.getState().auth.user?.avatarUrl).toBeUndefined();
  });
});

describe('removing the picture', () => {
  it('deletes it from the account and from the avatar', async () => {
    const { press, removeProfileImage, store } = await render({
      user: { ...ASHA, avatarUrl: REMOTE },
    });

    await press(COPY.photoRemove);

    expect(removeProfileImage).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.user?.avatarUrl).toBeUndefined();
  });
});

describe('pressed twice', () => {
  it('runs one action at a time, however often the buttons are pressed', async () => {
    let release!: (result: UploadResult) => void;
    const pending = new Promise<UploadResult>(resolve => {
      release = resolve;
    });

    const r = await render({ onUpload: () => pending });

    await r.press(COPY.photoGallery);
    // Mid-upload: the screen says so, and the actions are refused.
    expect(r.byTestID('profile-photo-busy').length).toBeGreaterThan(0);

    await r.press(COPY.photoGallery);
    await r.press(COPY.photoCamera);

    await act(async () => {
      release({ assetId: PICKED.id, remoteUrl: REMOTE });
    });
    await act(async () => {});

    expect(r.upload).toHaveBeenCalledTimes(1);
    expect(r.setProfileImage).toHaveBeenCalledTimes(1);
  });
});

/**
 * How far the upload has got (3D-12), as the vendor's photo cards show it
 * (3G-4) and through the same shared piece: the waiting words once, in a polite
 * live region, until the upload reports; then one progressbar stop whose value
 * is the figure, and which is not a live region, so the figure never speaks.
 */
describe('how far the upload has got', () => {
  const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

  afterEach(() => {
    for (const renderer of mounted.splice(0)) {
      act(() => {
        renderer.unmount();
      });
    }
  });

  /** An upload held open, with the listener the screen handed it. */
  async function uploading() {
    let report: UploadProgressListener | undefined;
    let finish!: (result: UploadResult) => void;
    const r = await render({
      onUpload: (_asset, _purpose, onProgress) => {
        report = onProgress;
        return new Promise<UploadResult>(resolve => (finish = resolve));
      },
    });
    mounted.push(r.renderer);
    await r.press(COPY.photoGallery);

    return {
      ...r,
      report: async (fraction: number) => {
        await act(async () => {
          report?.({ assetId: PICKED.id, status: 'uploading', progress: fraction });
        });
      },
      finish: async () => {
        await act(async () => {
          finish({ assetId: PICKED.id, remoteUrl: REMOTE });
        });
        await act(async () => {});
      },
    };
  }

  /** Every polite or assertive live region inside a node, by its own testID. */
  function liveRegionsIn(node: ReactTestRenderer.ReactTestInstance) {
    return node
      .findAll(child => typeof child.type === 'string' && child.props?.accessibilityLiveRegion)
      .map(child => child.props.testID as string | undefined);
  }

  it('says it is saving, once, until the upload has said how far it has got', async () => {
    const r = await uploading();

    const [waiting] = r.byTestID('profile-photo-busy');
    expect(waiting.props.accessibilityLiveRegion).toBe('polite');
    expect(r.text()).toContain(COPY.photoUploading);
    // Never a bar at 0% through picking and compressing.
    expect(r.byTestID('profile-photo-progress')).toHaveLength(0);

    await r.finish();
  });

  it('then shows the figure as one progressbar stop with its value, which never speaks', async () => {
    const r = await uploading();

    await r.report(0.42);

    expect(r.byTestID('profile-photo-busy')).toHaveLength(0);
    const [bar] = r.byTestID('profile-photo-progress');
    expect(bar.props.accessibilityRole).toBe('progressbar');
    expect(bar.props.accessibilityLabel).toBe(COPY.photoUploading);
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 42 });
    expect(r.text()).toContain(COPY.photoProgress(42));
    expect(r.byTestID('profile-photo-progress-fill')).toHaveLength(1);
    expect(liveRegionsIn(bar)).toEqual([]);
    expect(bar.props.accessibilityLiveRegion).toBeUndefined();

    await r.report(0.8);
    expect(r.byTestID('profile-photo-progress')[0].props.accessibilityValue.now).toBe(80);
    expect(r.text()).toContain('Uploading… 80%');

    await r.finish();
  });

  it('leaves no bar once the picture is saved', async () => {
    const r = await uploading();
    await r.report(0.9);

    await r.finish();

    expect(r.byTestID('profile-photo-progress')).toHaveLength(0);
    expect(r.byTestID('profile-photo-busy')).toHaveLength(0);
    expect(r.setProfileImage).toHaveBeenCalledWith(REMOTE);
  });
});
