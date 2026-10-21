/**
 * The vendor's shop images (PROJECT_BIBLE.md section 38, "Shop Images" and
 * "Upload Shop Images"), through the real VendorNavigator and the real mock
 * vendor profile service, with a stub image service (as the request photos'
 * tests use) so every upload outcome can be chosen.
 *
 * Pinned here:
 *
 * - Profile shows the photos as small squares, or "No shop images yet", and
 *   "Manage shop images" opens the screen; a change made there is on Profile
 *   when the vendor comes back, without a read of its own
 * - every photo is spoken as "Shop photo 2 of 4", its Remove names it, and the
 *   add tile says how many more fit; the counter counts what is on screen
 * - loading, a failed first read and its retry (once, however often pressed),
 *   and a failed pull that keeps the photos under a notice
 * - adding: the library needs no permission and the camera asks first; a
 *   refused file and a backed-out picker add nothing; an upload shows its
 *   progress, then the photo is saved as the stored list plus its URL
 * - a failed upload stays on its tile with Try again and saves nothing; a
 *   failed save keeps the uploaded tile as "Not saved" with Try again, which
 *   saves without uploading again
 * - two quick adds both land; at the ceiling there is no add tile
 * - removing a saved photo asks first, sends once however often confirmed, and
 *   a read from before it never brings it back; a photo never saved is simply
 *   taken off, and one taken off mid-upload is never saved
 * - saving the profile form never wipes the shop images
 * - leaving with a photo not saved asks first; leaving with all saved does not
 * - one vendor never sees another's photos
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { AppConfig } from '@/core/config/AppConfig';
import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { VendorStackParamList } from '@/navigation/types';
import { VendorNavigator } from '@/navigation/VendorNavigator';
import { ToastProvider } from '@/shared/components';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type {
  ImageAsset,
  ImageService,
  ImageUploadResult,
  UploadProgressListener,
} from '@/shared/services/types/ImageService';
import type {
  PermissionService,
  PermissionStatus,
} from '@/shared/services/types/PermissionService';
import type { VendorProfile } from '@/shared/services/types/VendorProfileService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = VENDOR_COPY.shopImages;
const PROFILE = VENDOR_COPY.profile;
const FORM = VENDOR_COPY.profileForm;

const MAX = AppConfig.image.maxShopImagesPerVendor;

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const MEENA: AuthUser = {
  id: 'usr_vendor_2',
  firstName: 'Meena',
  lastName: 'Iyer',
  phone: '9000000002',
  role: 'vendor',
};

/** A picked file, as the image service hands it over. */
function picked(id: string): ImageAsset {
  return {
    id,
    uri: `file:///cache/${id}.jpg`,
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    width: 800,
    height: 600,
  };
}

/** Where the stub "uploads" a picked file to. */
const remote = (id: string) => `https://cdn.example.com/${id}.jpg`;

/** Already on the profile before a test starts. */
const seeded = (n: number) => `https://cdn.example.com/seeded-${n}.jpg`;

const offline = () => new AppError({ kind: 'network', message: 'offline' });

/** The leave dialog's message when nothing is in the air and nothing went out unanswered. */
const NOTHING_UNCERTAIN = { alsoSending: false, mayBeSaved: false, alsoRemoving: false };

let current: AuthUser;
let profiles: MockVendorProfileService;
let cameraStatus: PermissionStatus;
let picks: number;
let pickFromGallery: jest.Mock;
let pickFromCamera: jest.Mock;
let validate: jest.Mock;
let upload: jest.Mock;
let retryUpload: jest.Mock;
let removeUpload: jest.Mock;
let requestPermission: jest.Mock;

async function uploaded(asset: ImageAsset, onProgress?: UploadProgressListener): Promise<ImageUploadResult> {
  onProgress?.({ assetId: asset.id, status: 'uploading', progress: 0.5 });
  return { assetId: asset.id, remoteUrl: remote(asset.id) };
}

beforeEach(async () => {
  resetServices();
  current = RAVI;
  const currentUser = async () => current;

  profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  registerService('vendorProfile', profiles);
  registerService('vendorRequests', new MockVendorRequestService({ latency: NO_LATENCY, currentUser }));
  registerService('vendorDashboard', new MockVendorDashboardService({ latency: NO_LATENCY, currentUser }));
  registerService('category', {
    listServiceCategories: jest.fn(async () => [{ id: 'cat_electrician', name: 'Electrician' }]),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  // A new file on every pick, as a picker gives.
  picks = 0;
  const pickOne = async () => {
    picks += 1;
    return [picked(`img_${picks}`)];
  };
  pickFromGallery = jest.fn(pickOne);
  pickFromCamera = jest.fn(pickOne);
  validate = jest.fn(() => ({ valid: true }));
  upload = jest.fn(uploaded);
  retryUpload = jest.fn(uploaded);
  removeUpload = jest.fn(async () => undefined);
  registerService('image', {
    pickFromCamera,
    pickFromGallery,
    compress: jest.fn(async (asset: ImageAsset) => asset),
    generatePreview: jest.fn(async (asset: ImageAsset) => asset.uri),
    validate,
    upload,
    retryUpload,
    remove: removeUpload,
  } as ImageService);

  cameraStatus = 'granted';
  requestPermission = jest.fn(async () => cameraStatus);
  registerService('permission', {
    check: jest.fn(async () => cameraStatus),
    request: requestPermission,
    openSettings: jest.fn(async () => undefined),
  } as PermissionService);

  setSessionStorage({
    read: async () => ({ token: 'token', user: current }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  // Both vendors have finished setup: shop images are offered only after it.
  await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });
  current = MEENA;
  await profiles.saveProfile({ businessName: 'Iyer Interiors', serviceCategoryIds: ['cat_electrician'] });
  current = RAVI;
});

type Instance = ReactTestRenderer.ReactTestInstance;

/*
  Unmounted after every test: a tree left loading leaves the placeholders
  animating, and a tree left mid-upload leaves work scheduled.
*/
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

function textOf(node: Instance): string {
  return node.children.map(child => (typeof child === 'string' ? child : textOf(child))).join(' ');
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {});
  }
}

function held<T>() {
  let land!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    land = resolve;
    fail = reject;
  });
  return { promise, land, fail };
}

/** What a fresh read of the service says is stored. */
async function storedUrls(): Promise<string[]> {
  return (await profiles.getProfile()).shopImageUrls;
}

/** Renders the vendor application and, unless told otherwise, opens Shop images from Profile. */
async function render({ open = true }: { open?: boolean } = {}) {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: current }));
  const navigation = createNavigationContainerRef<VendorStackParamList>();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer ref={navigation}>
              <VendorNavigator />
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);
  await flush();

  const hosts = (match: (id: string) => boolean, within: Instance = renderer.root) =>
    within.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props?.testID === 'string' &&
        match(node.props.testID),
    );
  const host = (id: string) => hosts(testID => testID === id)[0];
  const has = (id: string) => hosts(testID => testID === id).length > 0;

  const pressable = (label: string, within: Instance = renderer.root) =>
    within
      .findAll(node => node.props?.accessibilityLabel === label)
      .filter(node => typeof node.props?.onPress === 'function');

  const press = async (label: string, within?: Instance) => {
    const [target] = pressable(label, within);
    if (!target) {
      throw new Error(`Nothing pressable labelled "${label}"`);
    }
    await act(async () => {
      target.props.onPress();
    });
    await flush();
  };

  /** By test id, for a control whose words are not what the test is about. */
  const control = (id: string) => {
    const [target] = renderer.root.findAll(
      node => node.props?.testID === id && typeof node.props?.onPress === 'function',
    );
    if (!target) {
      throw new Error(`No control "${id}"`);
    }
    return target;
  };

  const tap = async (id: string) => {
    const target = control(id);
    await act(async () => {
      target.props.onPress();
    });
    await flush();
  };

  /** The screen's scroll view: the one that may carry a pull-to-refresh. */
  const scroll = () =>
    host('shop-images').findAll(node => 'refreshControl' in (node.props ?? {}))[0];

  const screen = {
    renderer,
    navigation,
    host,
    has,
    pressable,
    press,
    control,
    tap,
    scroll,
    flush,
    text: (id: string) => (has(id) ? textOf(host(id)) : ''),
    /** How many photo tiles are on screen. */
    tiles: () => hosts(testID => /^shop-image-\d+$/.test(testID)).length,
    /** The one spoken block a saved tile, or a tile on its way, is. */
    spoken: (position: number) =>
      host(`shop-image-${position}`).findAll(
        node => typeof node.type === 'string' && node.props?.accessible === true,
      )[0]?.props.accessibilityLabel,
    /** The add tile's two ways in. */
    addFromLibrary: () => screen.tap('shop-images-add-gallery'),
    addFromCamera: () => screen.tap('shop-images-add-camera'),
    toast: (): string | undefined =>
      renderer.root.findAll(
        node =>
          node.props?.accessibilityHint === 'Dismisses this message' &&
          typeof node.props.onPress === 'function',
      )[0]?.props.accessibilityLabel,
    pull: async () => {
      await act(async () => {
        scroll().props.refreshControl.props.onRefresh();
      });
      await flush();
    },
    /** The squares on the Profile tab's card. */
    profilePhotos: () =>
      host('vendor-profile-shop-images').findAll(
        node => typeof node.type === 'string' && node.props?.accessibilityRole === 'image',
      ),
    /** Within the remove dialog, so its Remove is never confused with a tile's. */
    dialog: () => host('shop-images-remove-dialog'),
    leaveDialog: () => host('shop-images-leave-dialog'),
    /**
     * The testID of every native view on this screen that says it is busy —
     * Profile is still mounted underneath, so only this screen's subtree is read.
     *
     * Ids, not the nodes: a failed match on a test instance makes jest print it,
     * and printing one walks the whole fiber tree — the run never finishes.
     */
    busy: (): Array<string | undefined> =>
      host('shop-images')
        .findAll(
          node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true,
        )
        .map(node => node.props.testID),
    /**
     * Whether this very node is still drawn. A view React updated in place is
     * the same node with new props; a replaced one is gone from the tree.
     */
    inTree: (target: Instance) => renderer.root.findAll(node => node === target).length > 0,
    onScreen: () => has('shop-images'),
    back: () => screen.press(COPY.back, host('shop-images')),
    open: async () => {
      await screen.press('Profile');
      await screen.press(PROFILE.shopImages);
    },
    switchTo: async (user: AuthUser) => {
      current = user;
      await act(async () => {
        store.dispatch(signedIn({ token: 'token', user }));
      });
      await flush();
    },
  };

  if (open) {
    await screen.open();
  }

  return screen;
}

describe('Shop images — on the Profile tab', () => {
  it('says there are none yet, and "Manage shop images" opens the screen', async () => {
    const screen = await render({ open: false });
    await screen.press('Profile');

    expect(screen.text('vendor-profile-shop-images')).toContain(PROFILE.shopImagesSection);
    expect(screen.text('vendor-profile-shop-images')).toContain(PROFILE.shopImagesEmpty);
    expect(screen.pressable(PROFILE.shopImages)[0].props.accessibilityHint).toBe(PROFILE.shopImagesHint);

    await screen.press(PROFILE.shopImages);

    expect(screen.onScreen()).toBe(true);
    expect(screen.text('shop-images-heading')).toBe(COPY.title);
  });

  it('shows each photo as a square spoken by its place, and no "none yet"', async () => {
    await profiles.updateShopImages([seeded(1), seeded(2), seeded(3)]);
    const screen = await render({ open: false });
    await screen.press('Profile');

    const section = screen.host('vendor-profile-shop-images');
    const photos = section.findAll(
      node => typeof node.type === 'string' && node.props?.accessibilityRole === 'image',
    );
    expect(photos.map(node => node.props.accessibilityLabel)).toEqual([
      COPY.photoSpoken(1, 3),
      COPY.photoSpoken(2, 3),
      COPY.photoSpoken(3, 3),
    ]);
    expect(textOf(section)).not.toContain(PROFILE.shopImagesEmpty);
  });
});

describe('Shop images — the screen', () => {
  it('says there are none yet against the ceiling, with both ways to add one', async () => {
    const screen = await render();

    expect(screen.text('shop-images-count')).toBe(COPY.emptyCount(MAX));
    expect(screen.tiles()).toBe(0);
    expect(screen.pressable(COPY.takePhotoSpoken(MAX))).not.toHaveLength(0);
    expect(screen.pressable(COPY.choosePhotoSpoken(MAX))).not.toHaveLength(0);
    // Each starts with the words on the tile, so voice control finds it.
    expect(COPY.takePhotoSpoken(MAX).startsWith(COPY.takePhoto)).toBe(true);
    expect(COPY.choosePhotoSpoken(MAX).startsWith(COPY.choosePhoto)).toBe(true);
    expect(screen.text('shop-images-add')).toContain(COPY.takePhoto);
    expect(screen.text('shop-images-add')).toContain(COPY.choosePhoto);
  });

  it('counts the photos, speaks each by its place and names each Remove for it', async () => {
    await profiles.updateShopImages([seeded(1), seeded(2)]);
    const screen = await render();

    expect(screen.text('shop-images-count')).toBe(COPY.count(2, MAX));
    expect(screen.tiles()).toBe(2);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 2));
    expect(screen.spoken(2)).toBe(COPY.photoSpoken(2, 2));
    expect(screen.pressable(COPY.removeSpoken(2, 2))[0].props.accessibilityHint).toBe(COPY.removeHint);
    expect(screen.pressable(COPY.choosePhotoSpoken(MAX - 2))).not.toHaveLength(0);
  });

  it('offers no add tile at the ceiling, and says how many fit one short of it', async () => {
    const all = Array.from({ length: MAX }, (_, index) => seeded(index + 1));
    await profiles.updateShopImages(all.slice(0, MAX - 1));
    const screen = await render();

    expect(screen.pressable(COPY.choosePhotoSpoken(1))).not.toHaveLength(0);
    expect(COPY.choosePhotoSpoken(1)).toContain('1 more photo can');

    await profiles.updateShopImages(all);
    await screen.pull();

    expect(screen.text('shop-images-count')).toBe(COPY.count(MAX, MAX));
    expect(screen.has('shop-images-add')).toBe(false);
  });

  it('leaves the grid unnamed, so it is no stop of its own, with nothing busy', async () => {
    // The grid used to be named on every render — "Your shop images" once
    // loaded — so TalkBack stopped on it to say what the heading had just said.
    const screen = await render();

    expect(screen.text('shop-images-count')).toBe(COPY.emptyCount(MAX));
    const grid = screen.host('shop-images-grid');
    expect(grid.props.accessibilityLabel).toBeUndefined();
    expect(grid.props.accessibilityState).toBeUndefined();
    expect(grid.props.accessibilityRole).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });
});

describe('Shop images — loading and failing', () => {
  it('fills the grid with placeholders, named and busy, until the photos arrive', async () => {
    await profiles.updateShopImages([seeded(1)]);
    const screen = await render({ open: false });
    await screen.press('Profile');
    const answer = held<VendorProfile>();
    const getProfile = jest.spyOn(profiles, 'getProfile').mockReturnValueOnce(answer.promise);

    await screen.press(PROFILE.shopImages);

    const waiting = screen.host('shop-images-grid');
    expect(waiting.props.accessibilityLabel).toBe(COPY.loading);
    expect(waiting.props.accessibilityState).toEqual({ busy: true });
    expect(screen.busy()).toEqual(['shop-images-grid']);
    expect(screen.has('shop-images-add')).toBe(false);
    expect(screen.tiles()).toBe(0);

    getProfile.mockRestore();
    await act(async () => {
      answer.land(await profiles.getProfile());
    });
    await screen.flush();

    expect(screen.tiles()).toBe(1);
    // A different native view, not the loading one updated in place — so none
    // is left holding the old `busy`, whatever Android does with a prop that
    // disappears — and it carries no name, role or state of its own.
    const grid = screen.host('shop-images-grid');
    expect(screen.inTree(waiting)).toBe(false);
    expect(grid === waiting).toBe(false);
    expect(grid.props.accessibilityLabel).toBeUndefined();
    expect(grid.props.accessibilityState).toBeUndefined();
    expect(grid.props.accessibilityRole).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });

  it('replaces the busy region with the failure, and the failure with a new one on Try again', async () => {
    await profiles.updateShopImages([seeded(1)]);
    const screen = await render({ open: false });
    await screen.press('Profile');
    const first = held<VendorProfile>();
    const second = held<VendorProfile>();
    const getProfile = jest
      .spyOn(profiles, 'getProfile')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    await screen.press(PROFILE.shopImages);
    const waiting = screen.host('shop-images-grid');

    await act(async () => {
      first.fail(offline());
    });
    await screen.flush();

    // The failure in its own words, in a new region with no name or state.
    expect(screen.text('shop-images-error')).toContain(COPY.failedTitle);
    const failed = screen.host('shop-images-grid');
    expect(screen.inTree(waiting)).toBe(false);
    expect(failed.props.accessibilityLabel).toBeUndefined();
    expect(failed.props.accessibilityState).toBeUndefined();
    expect(screen.busy()).toEqual([]);

    await screen.press('Try again', screen.host('shop-images'));

    const again = screen.host('shop-images-grid');
    expect(screen.inTree(failed)).toBe(false);
    expect(again.props.accessibilityLabel).toBe(COPY.loading);
    expect(screen.busy()).toEqual(['shop-images-grid']);

    getProfile.mockRestore();
    await act(async () => {
      second.land(await profiles.getProfile());
    });
    await screen.flush();

    expect(screen.tiles()).toBe(1);
    expect(screen.inTree(again)).toBe(false);
    expect(screen.busy()).toEqual([]);
  });

  it('says a failed first read failed, with a retry and no pull or add over it', async () => {
    const screen = await render({ open: false });
    await screen.press('Profile');
    jest.spyOn(profiles, 'getProfile').mockRejectedValueOnce(offline());

    await screen.press(PROFILE.shopImages);

    expect(screen.has('shop-images-error')).toBe(true);
    expect(screen.text('shop-images-error')).toContain(COPY.failedTitle);
    expect(screen.text('shop-images-error')).not.toContain('offline');
    expect(screen.has('shop-images-add')).toBe(false);
    expect(screen.scroll().props.refreshControl).toBeUndefined();
  });

  it('reads again once, however often Try again is pressed', async () => {
    await profiles.updateShopImages([seeded(1)]);
    const screen = await render({ open: false });
    await screen.press('Profile');
    const getProfile = jest.spyOn(profiles, 'getProfile').mockRejectedValueOnce(offline());
    await screen.press(PROFILE.shopImages);

    const [retry] = screen.pressable('Try again', screen.host('shop-images'));
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        retry.props.onPress();
      }
    });
    await screen.flush();

    expect(getProfile).toHaveBeenCalledTimes(2);
    expect(screen.tiles()).toBe(1);
  });

  it('keeps the photos and says they may be out of date when a pull fails, until a read works', async () => {
    await profiles.updateShopImages([seeded(1)]);
    const screen = await render();
    jest.spyOn(profiles, 'getProfile').mockRejectedValueOnce(offline());

    await screen.pull();

    expect(screen.tiles()).toBe(1);
    expect(screen.has('shop-images-stale')).toBe(true);
    expect(screen.text('shop-images-stale')).toContain(COPY.staleMessage);

    await screen.press(COPY.staleRetry, screen.host('shop-images-stale'));
    expect(screen.has('shop-images-stale')).toBe(false);
  });
});

describe('Shop images — adding', () => {
  it('uploads a photo from the library, saves it straight away, and says so', async () => {
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const screen = await render();

    await screen.addFromLibrary();

    expect(requestPermission).not.toHaveBeenCalled();
    expect(pickFromGallery).toHaveBeenCalledWith({ maxCount: 1 });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(updateShopImages).toHaveBeenCalledTimes(1);
    expect(updateShopImages).toHaveBeenCalledWith([remote('img_1')]);
    expect(await storedUrls()).toEqual([remote('img_1')]);
    expect(screen.toast()).toBe(COPY.added);
    expect(screen.tiles()).toBe(1);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 1));
    expect(screen.text('shop-images-count')).toBe(COPY.count(1, MAX));
  });

  it('adds to the end of what is stored', async () => {
    await profiles.updateShopImages([seeded(1), seeded(2)]);
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const screen = await render();

    await screen.addFromLibrary();

    expect(updateShopImages).toHaveBeenCalledWith([seeded(1), seeded(2), remote('img_1')]);
    expect(screen.spoken(3)).toBe(COPY.photoSpoken(3, 3));
  });

  it('shows the upload’s progress on the photo, then saving, then the saved photo', async () => {
    const answer = held<ImageUploadResult>();
    let progress!: UploadProgressListener;
    upload.mockImplementationOnce((_asset: ImageAsset, onProgress: UploadProgressListener) => {
      progress = onProgress;
      return answer.promise;
    });
    const saving = held<VendorProfile>();
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockReturnValueOnce(saving.promise);
    const screen = await render();

    await screen.addFromLibrary();
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 1)}, ${COPY.uploading}`);
    expect(screen.text('shop-image-1-status')).toContain(COPY.uploading);

    await act(async () => {
      progress({ assetId: 'img_1', status: 'uploading', progress: 0.4 });
    });
    expect(screen.host('shop-image-1-progress').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: '40%' })]),
    );
    expect(updateShopImages).not.toHaveBeenCalled();

    await act(async () => {
      answer.land({ assetId: 'img_1', remoteUrl: remote('img_1') });
    });
    await screen.flush();
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 1)}, ${COPY.saving}`);
    // Its save is already in line: taking it off now would be undone by that save.
    expect(screen.has('shop-image-1-remove')).toBe(false);

    updateShopImages.mockRestore();
    await act(async () => {
      saving.land(await profiles.updateShopImages([remote('img_1')]));
    });
    await screen.flush();
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 1));
    expect(screen.has('shop-image-1-remove')).toBe(true);
  });

  it('asks for the camera only when it is chosen, then takes the photo', async () => {
    const screen = await render();

    await screen.addFromCamera();

    expect(requestPermission).toHaveBeenCalledWith('camera');
    expect(pickFromCamera).toHaveBeenCalledWith({ maxCount: 1 });
    expect(await storedUrls()).toEqual([remote('img_1')]);
  });

  it('says the camera could not be opened, and opens nothing, when it is refused', async () => {
    cameraStatus = 'denied';
    const screen = await render();

    await screen.addFromCamera();

    expect(pickFromCamera).not.toHaveBeenCalled();
    expect(screen.text('shop-images-notice')).toBe(COPY.cameraUnavailable);
    expect(screen.host('shop-images-notice').props.accessibilityLiveRegion).toBe('polite');
    expect(screen.tiles()).toBe(0);
  });

  it('says why a file was refused, and adds nothing', async () => {
    validate.mockReturnValueOnce({ valid: false, reason: 'size', message: 'Images must be smaller than 5 MB.' });
    const screen = await render();

    await screen.addFromLibrary();

    expect(screen.text('shop-images-notice')).toBe('Images must be smaller than 5 MB.');
    expect(upload).not.toHaveBeenCalled();
    expect(screen.tiles()).toBe(0);
  });

  it('adds nothing, and says nothing, when the picker is backed out of', async () => {
    pickFromGallery.mockResolvedValueOnce([]);
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const screen = await render();

    await screen.addFromLibrary();

    expect(screen.has('shop-images-notice')).toBe(false);
    expect(screen.tiles()).toBe(0);
    expect(updateShopImages).not.toHaveBeenCalled();
  });

  it('lands both of two quick adds, the second saved on top of the first', async () => {
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const screen = await render();

    const gallery = screen.control('shop-images-add-gallery');
    await act(async () => {
      gallery.props.onPress();
      gallery.props.onPress();
    });
    await screen.flush();

    expect(updateShopImages).toHaveBeenCalledTimes(2);
    expect(updateShopImages.mock.calls[1][0]).toEqual([remote('img_1'), remote('img_2')]);
    expect(await storedUrls()).toEqual([remote('img_1'), remote('img_2')]);
    expect(screen.tiles()).toBe(2);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 2));
    expect(screen.spoken(2)).toBe(COPY.photoSpoken(2, 2));
  });

  it('stops at the ceiling when the last place is taken while a second photo is picked', async () => {
    await profiles.updateShopImages(Array.from({ length: MAX - 1 }, (_, index) => seeded(index + 1)));
    const screen = await render();

    const gallery = screen.control('shop-images-add-gallery');
    await act(async () => {
      gallery.props.onPress();
      gallery.props.onPress();
    });
    await screen.flush();

    expect((await storedUrls()).length).toBe(MAX);
    expect(screen.text('shop-images-notice')).toBe(COPY.limitReached(MAX));
    expect(screen.has('shop-images-add')).toBe(false);
  });
});

describe('Shop images — when an upload or a save fails', () => {
  it('keeps a failed upload on its tile with Try again, saving nothing, then uploads it again', async () => {
    upload.mockRejectedValueOnce(offline());
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const screen = await render();

    await screen.addFromLibrary();

    expect(screen.text('shop-image-1-status')).toContain(COPY.uploadFailed);
    expect(updateShopImages).not.toHaveBeenCalled();
    expect(await storedUrls()).toEqual([]);
    const retryLabel = COPY.tryAgainSpoken(1, 1, COPY.uploadFailed);
    expect(screen.pressable(retryLabel)).not.toHaveLength(0);

    await screen.press(retryLabel);

    expect(retryUpload).toHaveBeenCalledTimes(1);
    expect(await storedUrls()).toEqual([remote('img_1')]);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 1));
  });

  it('keeps an uploaded photo whose save failed as "Not saved", and saves it without uploading again', async () => {
    jest.spyOn(profiles, 'updateShopImages').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.addFromLibrary();

    expect(screen.toast()).toBe(`${COPY.saveFailed} ${offline().userMessage}`);
    expect(screen.tiles()).toBe(1);
    expect(screen.text('shop-image-1-status')).toContain(COPY.notSaved);
    expect(screen.text('shop-image-1-status')).toContain(COPY.tryAgain);
    expect(await storedUrls()).toEqual([]);

    await screen.press(COPY.tryAgainSpoken(1, 1, COPY.notSaved));

    expect(upload).toHaveBeenCalledTimes(1);
    expect(retryUpload).not.toHaveBeenCalled();
    expect(await storedUrls()).toEqual([remote('img_1')]);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 1));
  });

  it('tries a failed upload again once, however often Try again is pressed', async () => {
    upload.mockRejectedValueOnce(offline());
    const screen = await render();
    await screen.addFromLibrary();

    const [retry] = screen.pressable(COPY.tryAgainSpoken(1, 1, COPY.uploadFailed));
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        retry.props.onPress();
      }
    });
    await screen.flush();

    expect(retryUpload).toHaveBeenCalledTimes(1);
    expect(await storedUrls()).toEqual([remote('img_1')]);
  });

  it('takes off a photo that was never saved without asking, and nothing stored changes', async () => {
    upload.mockRejectedValueOnce(offline());
    await profiles.updateShopImages([seeded(1)]);
    const screen = await render();
    await screen.addFromLibrary();

    const [remove] = screen.pressable(COPY.removeSpoken(2, 2));
    expect(remove.props.accessibilityHint).toBe(COPY.discardHint);
    await screen.press(COPY.removeSpoken(2, 2));

    expect(screen.has('shop-images-remove-dialog')).toBe(false);
    expect(screen.tiles()).toBe(1);
    expect(removeUpload).toHaveBeenCalledWith('img_1');
    expect(await storedUrls()).toEqual([seeded(1)]);
  });

  it('never saves a photo taken off while it was uploading', async () => {
    const answer = held<ImageUploadResult>();
    upload.mockReturnValueOnce(answer.promise);
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const screen = await render();
    await screen.addFromLibrary();

    await screen.press(COPY.removeSpoken(1, 1));
    expect(screen.tiles()).toBe(0);

    await act(async () => {
      answer.land({ assetId: 'img_1', remoteUrl: remote('img_1') });
    });
    await screen.flush();

    expect(updateShopImages).not.toHaveBeenCalled();
    expect(screen.tiles()).toBe(0);
  });

  it('keeps the uploaded file when a photo whose save failed is taken off — that save may have landed', async () => {
    jest.spyOn(profiles, 'updateShopImages').mockRejectedValueOnce(offline());
    const screen = await render();
    await screen.addFromLibrary();
    expect(screen.text('shop-image-1-status')).toContain(COPY.notSaved);

    const [remove] = screen.pressable(COPY.removeSpoken(1, 1));
    expect(remove.props.accessibilityHint).toBe(COPY.discardHint);
    await screen.press(COPY.removeSpoken(1, 1));

    expect(screen.has('shop-images-remove-dialog')).toBe(false);
    expect(screen.tiles()).toBe(0);
    expect(removeUpload).not.toHaveBeenCalled();
    expect(await storedUrls()).toEqual([]);
  });

  it('never calls a first save saved because its URL is already stored', async () => {
    await profiles.updateShopImages([seeded(1)]);
    // An upload that comes back with a URL the list already holds — a mock reusing one, say.
    upload.mockImplementationOnce(async (asset: ImageAsset) => ({
      assetId: asset.id,
      remoteUrl: seeded(1),
    }));
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const screen = await render();

    await screen.addFromLibrary();

    // Sent, and refused as the duplicate it is — never taken as already saved.
    expect(updateShopImages).toHaveBeenCalledWith([seeded(1), seeded(1)]);
    expect(screen.toast()).toBe(
      `${COPY.saveFailed} ${new AppError({ kind: 'validation' }).userMessage}`,
    );
    expect(screen.text('shop-image-2-status')).toContain(COPY.notSaved);
    expect(await storedUrls()).toEqual([seeded(1)]);

    // A refusal is an answer: Try again asks again rather than assuming it landed.
    await screen.press(COPY.tryAgainSpoken(2, 2, COPY.notSaved));

    expect(updateShopImages).toHaveBeenCalledTimes(2);
    expect(screen.toast()).not.toBe(COPY.added);
    expect(screen.tiles()).toBe(2);
    expect(screen.text('shop-image-2-status')).toContain(COPY.notSaved);
  });

  /** The next save is stored, but its answer is lost on the way back. */
  function loseTheNextAnswer() {
    const real = profiles.updateShopImages.bind(profiles);
    return jest
      .spyOn(profiles, 'updateShopImages')
      .mockImplementationOnce(async (list: string[]) => {
        await real(list);
        throw offline();
      });
  }

  it('takes a photo whose lost answer had stored it as saved once a read shows it — once, and on Profile', async () => {
    const updateShopImages = loseTheNextAnswer();
    const screen = await render();
    await screen.addFromLibrary();
    // Until a read says otherwise, nothing calls it saved on a guess.
    expect(screen.text('shop-image-1-status')).toContain(COPY.notSaved);

    await screen.pull();

    // One photo: one square, counted once, saved — not a saved square beside a "Not saved" one.
    expect(screen.tiles()).toBe(1);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 1));
    expect(screen.has('shop-image-1-status')).toBe(false);
    expect(screen.text('shop-images-count')).toBe(COPY.count(1, MAX));
    expect(screen.toast()).toBe(COPY.added);
    expect(updateShopImages).toHaveBeenCalledTimes(1);
    expect(await storedUrls()).toEqual([remote('img_1')]);

    // Nothing is unsaved any more: Back asks nothing, and Profile has it.
    await screen.back();
    expect(screen.has('shop-images-leave-dialog')).toBe(false);
    expect(screen.onScreen()).toBe(false);
    expect(screen.profilePhotos()).toHaveLength(1);
  });

  it('counts such a photo once at the ceiling, with no add tile', async () => {
    await profiles.updateShopImages(Array.from({ length: MAX - 1 }, (_, index) => seeded(index + 1)));
    loseTheNextAnswer();
    const screen = await render();
    await screen.addFromLibrary();

    await screen.pull();

    expect(screen.tiles()).toBe(MAX);
    expect(screen.text('shop-images-count')).toBe(COPY.count(MAX, MAX));
    expect(screen.has('shop-images-add')).toBe(false);
  });
});

describe('Shop images — reads and the Profile tab', () => {
  it('carries what a pull reads to Profile', async () => {
    const screen = await render();
    // Added elsewhere — another device — so only a read can know.
    await profiles.updateShopImages([seeded(1), seeded(2)]);

    await screen.pull();
    expect(screen.tiles()).toBe(2);

    await screen.back();
    expect(screen.profilePhotos()).toHaveLength(2);
  });

  it('never lets a read in the air put the old list back on Profile after a save', async () => {
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const screen = await render();
    const before = await profiles.getProfile();
    const read = held<VendorProfile>();
    jest.spyOn(profiles, 'getProfile').mockReturnValueOnce(read.promise);

    // A pull is in the air, holding the list as it was …
    await act(async () => {
      screen.scroll().props.refreshControl.props.onRefresh();
    });
    // … when a photo is added: uploaded, its save waits behind the read.
    await screen.addFromLibrary();
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 1)}, ${COPY.waiting}`);
    expect(updateShopImages).not.toHaveBeenCalled();

    await act(async () => {
      read.land(before);
    });
    await screen.flush();

    // The old read ended first; the save after it is the last word, here and on Profile.
    expect(screen.tiles()).toBe(1);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 1));
    await screen.back();
    expect(screen.profilePhotos()).toHaveLength(1);
  });

  it('makes a pull wait for a save already in the air, and reads once it has answered', async () => {
    const real = profiles.updateShopImages.bind(profiles);
    const sent = held<VendorProfile>();
    jest.spyOn(profiles, 'updateShopImages').mockReturnValueOnce(sent.promise);
    const getProfile = jest.spyOn(profiles, 'getProfile');
    const screen = await render();
    const reads = getProfile.mock.calls.length;
    await screen.addFromLibrary();

    await act(async () => {
      screen.scroll().props.refreshControl.props.onRefresh();
    });
    await act(async () => {
      // A second pull while the first waits is the same pull.
      screen.scroll().props.refreshControl.props.onRefresh();
    });
    await screen.flush();

    // Never read while the save is in the air, and the spinner says it is coming.
    expect(getProfile.mock.calls.length).toBe(reads);
    expect(screen.scroll().props.refreshControl.props.refreshing).toBe(true);

    await act(async () => {
      sent.land(await real([remote('img_1')]));
    });
    await screen.flush();

    expect(getProfile.mock.calls.length).toBe(reads + 1);
    expect(screen.scroll().props.refreshControl.props.refreshing).toBe(false);
    expect(screen.tiles()).toBe(1);
  });
});

describe('Shop images — a lost answer, a pull and another save (review probes)', () => {
  /*
    X is stored but its answer is lost; Y is added and held in the air; then the
    vendor pulls. Before the line held reads too, the read answered first and
    called X saved, and Y's whole-list save — built without X — then took it off
    the server: X gone, no tile, no retry.
  */
  it('keeps a lost-answer photo truthfully "Not saved" when the save in the air takes it off', async () => {
    const real = profiles.updateShopImages.bind(profiles);
    const sentY = held<VendorProfile>();
    let listY: string[] = [];
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockImplementationOnce(async (list: string[]) => {
        await real(list);
        throw offline();
      })
      .mockImplementationOnce((list: string[]) => {
        listY = list;
        return sentY.promise;
      });
    const getProfile = jest.spyOn(profiles, 'getProfile');
    const screen = await render();

    await screen.addFromLibrary();
    await screen.addFromLibrary();
    expect(await storedUrls()).toEqual([remote('img_1')]);
    expect(screen.text('shop-image-1-status')).toContain(COPY.notSaved);
    expect(screen.spoken(2)).toBe(`${COPY.photoSpoken(2, 2)}, ${COPY.saving}`);

    const reads = getProfile.mock.calls.length;
    await act(async () => {
      screen.scroll().props.refreshControl.props.onRefresh();
    });
    await screen.flush();
    // The read waits behind Y, so it cannot call X saved under Y's feet.
    expect(getProfile.mock.calls.length).toBe(reads);
    expect(screen.text('shop-image-1-status')).toContain(COPY.notSaved);

    // Y answers: built before anyone knew X was stored, it replaced the list.
    await act(async () => {
      sentY.land(await real(listY));
    });
    await screen.flush();

    expect(getProfile.mock.calls.length).toBe(reads + 1);
    expect(await storedUrls()).toEqual([remote('img_2')]);
    // X is not stored — and is still here, "Not saved", with its Try again; drawn once.
    expect(screen.tiles()).toBe(2);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 2));
    expect(screen.text('shop-image-2-status')).toContain(COPY.notSaved);
    expect(screen.text('shop-images-count')).toBe(COPY.count(2, MAX));

    // Now known not to be stored, so leaving says "will not", not "may not".
    await screen.back();
    expect(textOf(screen.leaveDialog())).toContain(COPY.leaveMessage(NOTHING_UNCERTAIN));
    await screen.press(COPY.leaveStay, screen.leaveDialog());

    await screen.press(COPY.tryAgainSpoken(2, 2, COPY.notSaved));
    expect(updateShopImages).toHaveBeenCalledTimes(3);
    expect(await storedUrls()).toEqual([remote('img_2'), remote('img_1')]);
    await screen.back();
    expect(screen.profilePhotos()).toHaveLength(2);
  });

  /** X stored with its answer lost; Y's save held in the air, to be refused. */
  async function lostThenRefused() {
    const real = profiles.updateShopImages.bind(profiles);
    const refusedY = held<VendorProfile>();
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockImplementationOnce(async (list: string[]) => {
        await real(list);
        throw offline();
      })
      .mockImplementationOnce(() => refusedY.promise);
    const screen = await render();
    await screen.addFromLibrary();
    await screen.addFromLibrary();
    const refuseY = () => refusedY.fail(new AppError({ kind: 'validation', message: 'refused' }));
    return { screen, updateShopImages, refuseY };
  }

  /*
    The second probe: X lost, Y in the air, Try again on X (waiting), then a
    pull. Before, the read showed X while it waited, X was drawn twice, then
    sent as [X, X], refused as a duplicate and stuck "Not saved" for good.
  */
  it('saves a retried photo in its turn once, never twice and never stuck, when it retries before the pull', async () => {
    const { screen, updateShopImages, refuseY } = await lostThenRefused();

    await screen.press(COPY.tryAgainSpoken(1, 2, COPY.notSaved));
    await act(async () => {
      screen.scroll().props.refreshControl.props.onRefresh();
    });
    await screen.flush();
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 2)}, ${COPY.waiting}`);

    await act(async () => {
      refuseY();
    });
    await screen.flush();

    // X's turn came before the read: sent on the list as last known, accepted.
    expect(updateShopImages).toHaveBeenCalledTimes(3);
    expect(updateShopImages.mock.calls[2][0]).toEqual([remote('img_1')]);
    expect(await storedUrls()).toEqual([remote('img_1')]);
    expect(screen.tiles()).toBe(2);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 2));
    expect(screen.text('shop-image-2-status')).toContain(COPY.notSaved);
    expect(screen.text('shop-images-count')).toBe(COPY.count(2, MAX));
    await screen.back();
    await screen.press(COPY.leaveStay, screen.leaveDialog());
    expect(screen.onScreen()).toBe(true);
  });

  it('draws a retried photo once, as saved, while it waits behind another save with its URL already stored', async () => {
    const real = profiles.updateShopImages.bind(profiles);
    const refusedY = held<VendorProfile>();
    const sentZ = held<VendorProfile>();
    let listZ: string[] = [];
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockImplementationOnce(async (list: string[]) => {
        await real(list);
        throw offline();
      })
      .mockImplementationOnce(() => refusedY.promise)
      .mockImplementationOnce((list: string[]) => {
        listZ = list;
        return sentZ.promise;
      });
    const screen = await render();
    await screen.addFromLibrary(); // X: stored, answer lost
    await screen.addFromLibrary(); // Y: in the air
    // In line behind Y: a pull, then Z's save, then X's retry.
    await act(async () => {
      screen.scroll().props.refreshControl.props.onRefresh();
    });
    await screen.addFromLibrary(); // Z
    await screen.press(COPY.tryAgainSpoken(1, 3, COPY.notSaved));

    await act(async () => {
      refusedY.fail(new AppError({ kind: 'validation', message: 'refused' }));
    });
    await screen.flush();

    // The read showed X stored; X now waits behind Z — and is drawn once, as saved.
    expect(screen.tiles()).toBe(3);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 3));
    expect(screen.text('shop-image-3-status')).toContain(COPY.saving);
    expect(screen.text('shop-images-count')).toBe(COPY.count(3, MAX));
    expect(listZ).toEqual([remote('img_1'), remote('img_3')]);

    await act(async () => {
      sentZ.land(await real(listZ));
    });
    await screen.flush();

    // X's turn: already stored, so not sent again.
    expect(updateShopImages).toHaveBeenCalledTimes(3);
    expect(await storedUrls()).toEqual([remote('img_1'), remote('img_3')]);
    expect(screen.tiles()).toBe(3);
    expect(screen.text('shop-images-count')).toBe(COPY.count(3, MAX));
  });

  it('saves a retried photo in its turn without sending it again, when the pull before it shows it stored', async () => {
    const { screen, updateShopImages, refuseY } = await lostThenRefused();

    await act(async () => {
      screen.scroll().props.refreshControl.props.onRefresh();
    });
    await screen.flush();
    await screen.press(COPY.tryAgainSpoken(1, 2, COPY.notSaved));
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 2)}, ${COPY.waiting}`);

    await act(async () => {
      refuseY();
    });
    await screen.flush();

    // The read (after Y) showed X stored; in X's turn it was saved without a duplicate send.
    expect(updateShopImages).toHaveBeenCalledTimes(2);
    expect(await storedUrls()).toEqual([remote('img_1')]);
    expect(screen.tiles()).toBe(2);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 2));
    expect(screen.text('shop-image-2-status')).toContain(COPY.notSaved);
    expect(screen.text('shop-images-count')).toBe(COPY.count(2, MAX));
    await screen.back();
    await screen.press(COPY.leaveConfirm, screen.leaveDialog());
    expect(screen.profilePhotos()).toHaveLength(1);
  });
});

describe('Shop images — removing a saved photo', () => {
  beforeEach(async () => {
    await profiles.updateShopImages([seeded(1), seeded(2), seeded(3)]);
  });

  it('asks first; Cancel sends nothing', async () => {
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const screen = await render();

    await screen.press(COPY.removeSpoken(2, 3));

    expect(screen.has('shop-images-remove-dialog')).toBe(true);
    expect(textOf(screen.dialog())).toContain(COPY.removeTitle);
    expect(textOf(screen.dialog())).toContain(COPY.removeMessage);

    await screen.press(COPY.removeCancel, screen.dialog());

    expect(screen.has('shop-images-remove-dialog')).toBe(false);
    expect(updateShopImages).not.toHaveBeenCalled();
    expect(screen.tiles()).toBe(3);
  });

  it('removes once confirmed — the stored list without it — says so, and Profile shows it', async () => {
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const getProfile = jest.spyOn(profiles, 'getProfile');
    const screen = await render();
    const readsBefore = getProfile.mock.calls.length;

    await screen.press(COPY.removeSpoken(2, 3));
    await screen.press(COPY.removeConfirm, screen.dialog());

    expect(updateShopImages).toHaveBeenCalledWith([seeded(1), seeded(3)]);
    expect(screen.toast()).toBe(COPY.removed);
    expect(screen.has('shop-images-remove-dialog')).toBe(false);
    expect(screen.tiles()).toBe(2);
    expect(screen.text('shop-images-count')).toBe(COPY.count(2, MAX));

    await screen.back();

    expect(screen.onScreen()).toBe(false);
    const photos = screen
      .host('vendor-profile-shop-images')
      .findAll(node => typeof node.type === 'string' && node.props?.accessibilityRole === 'image');
    expect(photos).toHaveLength(2);
    // Profile adopted the answer; it did not read again.
    expect(getProfile.mock.calls.length).toBe(readsBefore);
  });

  it('leaves the photo where it was when removal fails, and says why', async () => {
    jest.spyOn(profiles, 'updateShopImages').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press(COPY.removeSpoken(2, 3));
    await screen.press(COPY.removeConfirm, screen.dialog());

    expect(screen.toast()).toBe(`${COPY.removeFailed} ${offline().userMessage}`);
    expect(screen.tiles()).toBe(3);
    expect(await storedUrls()).toEqual([seeded(1), seeded(2), seeded(3)]);
  });

  it('closes the dialog at once and marks the photo Removing, counted, until the removal answers — once however often confirmed', async () => {
    const real = profiles.updateShopImages.bind(profiles);
    const answer = held<VendorProfile>();
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockReturnValueOnce(answer.promise);
    const screen = await render();

    await screen.press(COPY.removeSpoken(1, 3));
    const [confirm] = screen.pressable(COPY.removeConfirm, screen.dialog());
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        confirm.props.onPress();
      }
    });
    await screen.flush();

    expect(updateShopImages).toHaveBeenCalledTimes(1);
    expect(screen.has('shop-images-remove-dialog')).toBe(false);
    // Still stored until the service says otherwise: drawn, counted, and with no Remove of its own.
    expect(screen.tiles()).toBe(3);
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 3)}, ${COPY.removing}`);
    expect(screen.text('shop-image-1-status')).toContain(COPY.removing);
    expect(screen.has('shop-image-1-remove')).toBe(false);
    expect(screen.text('shop-images-count')).toBe(COPY.count(3, MAX));
    // Other photos can still be removed meanwhile.
    expect(screen.pressable(COPY.removeSpoken(2, 3))).not.toHaveLength(0);

    await act(async () => {
      answer.land(await real([seeded(2), seeded(3)]));
    });
    await screen.flush();

    expect(screen.toast()).toBe(COPY.removed);
    expect(screen.tiles()).toBe(2);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 2));
    expect(screen.text('shop-images-count')).toBe(COPY.count(2, MAX));
  });

  it('puts the photo back as it was, and says why, when a removal fails after the dialog has closed', async () => {
    const failing = held<VendorProfile>();
    jest.spyOn(profiles, 'updateShopImages').mockReturnValueOnce(failing.promise);
    const screen = await render();

    await screen.press(COPY.removeSpoken(2, 3));
    await screen.press(COPY.removeConfirm, screen.dialog());
    expect(screen.spoken(2)).toBe(`${COPY.photoSpoken(2, 3)}, ${COPY.removing}`);

    await act(async () => {
      failing.fail(offline());
    });
    await screen.flush();

    expect(screen.toast()).toBe(`${COPY.removeFailed} ${offline().userMessage}`);
    expect(screen.spoken(2)).toBe(COPY.photoSpoken(2, 3));
    expect(screen.pressable(COPY.removeSpoken(2, 3))).not.toHaveLength(0);
    expect(await storedUrls()).toEqual([seeded(1), seeded(2), seeded(3)]);
  });

  it('removes two photos confirmed one after the other, each on what the last stored', async () => {
    const real = profiles.updateShopImages.bind(profiles);
    const first = held<VendorProfile>();
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockReturnValueOnce(first.promise);
    const screen = await render();

    await screen.press(COPY.removeSpoken(1, 3));
    await screen.press(COPY.removeConfirm, screen.dialog());
    await screen.press(COPY.removeSpoken(3, 3));
    await screen.press(COPY.removeConfirm, screen.dialog());
    expect(screen.spoken(3)).toBe(`${COPY.photoSpoken(3, 3)}, ${COPY.removing}`);

    await act(async () => {
      first.land(await real([seeded(2), seeded(3)]));
    });
    await screen.flush();

    expect(updateShopImages).toHaveBeenCalledTimes(2);
    expect(updateShopImages.mock.calls[1][0]).toEqual([seeded(2)]);
    expect(await storedUrls()).toEqual([seeded(2)]);
    expect(screen.tiles()).toBe(1);
  });

  it('finishes a confirmed removal after the screen is left — even one still waiting its turn — without asking', async () => {
    const real = profiles.updateShopImages.bind(profiles);
    const sentX = held<VendorProfile>();
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockReturnValueOnce(sentX.promise);
    const screen = await render();

    // A new photo's save in the air, and a confirmed removal waiting behind it.
    await screen.addFromLibrary();
    await screen.press(COPY.removeSpoken(1, 4));
    await screen.press(COPY.removeConfirm, screen.dialog());
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 4)}, ${COPY.removing}`);
    await screen.back();

    // Nothing would be lost by leaving — a sent save and a confirmed removal both go — so nothing was asked.
    expect(screen.has('shop-images-leave-dialog')).toBe(false);
    expect(screen.onScreen()).toBe(false);
    expect(updateShopImages).toHaveBeenCalledTimes(1);

    await act(async () => {
      sentX.land(await real([seeded(1), seeded(2), seeded(3), remote('img_1')]));
    });
    await screen.flush();

    // The removal's turn came after the screen had gone, and it still went.
    expect(updateShopImages).toHaveBeenCalledTimes(2);
    expect(updateShopImages.mock.calls[1][0]).toEqual([seeded(2), seeded(3), remote('img_1')]);
    expect(screen.toast()).toBe(COPY.removed);
    expect(await storedUrls()).toEqual([seeded(2), seeded(3), remote('img_1')]);
    expect(screen.profilePhotos()).toHaveLength(3);
  });

  it('says a Removing photo will still be removed when the leave dialog asks for another reason', async () => {
    const held1 = held<VendorProfile>();
    jest.spyOn(profiles, 'updateShopImages').mockReturnValueOnce(held1.promise);
    upload.mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press(COPY.removeSpoken(1, 3));
    await screen.press(COPY.removeConfirm, screen.dialog());
    await screen.addFromLibrary();
    await screen.back();

    expect(textOf(screen.leaveDialog())).toContain(
      COPY.leaveMessage({ alsoSending: false, mayBeSaved: false, alsoRemoving: true }),
    );
    expect(COPY.leaveMessage({ alsoSending: false, mayBeSaved: false, alsoRemoving: true })).toContain(
      `marked ${COPY.removing} will still be removed`,
    );
  });

  it('never lets a read from before the removal bring the photo back', async () => {
    const updateShopImages = jest.spyOn(profiles, 'updateShopImages');
    const screen = await render();
    const before = await profiles.getProfile();
    const read = held<VendorProfile>();
    jest.spyOn(profiles, 'getProfile').mockReturnValueOnce(read.promise);

    // A pull is in the air, holding the photos as they were …
    await act(async () => {
      screen.scroll().props.refreshControl.props.onRefresh();
    });
    // … when the removal is confirmed: it waits its turn behind the read, the photo "Removing".
    await screen.press(COPY.removeSpoken(1, 3));
    await screen.press(COPY.removeConfirm, screen.dialog());
    expect(updateShopImages).not.toHaveBeenCalled();
    expect(screen.has('shop-images-remove-dialog')).toBe(false);
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 3)}, ${COPY.removing}`);
    expect(screen.tiles()).toBe(3);

    await act(async () => {
      read.land(before);
    });
    await screen.flush();

    // The read ended first, and the photo stayed "Removing" through it; the removal then
    // went out on what it read, and is the last word.
    expect(updateShopImages).toHaveBeenCalledWith([seeded(2), seeded(3)]);
    expect(screen.tiles()).toBe(2);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 2));
    await screen.back();
    expect(screen.profilePhotos()).toHaveLength(2);
  });
});

describe('Shop images — and the profile form', () => {
  it('keeps every shop image when the business profile is saved', async () => {
    const screen = await render();
    await screen.addFromLibrary();
    await screen.addFromLibrary();
    expect(await storedUrls()).toEqual([remote('img_1'), remote('img_2')]);

    await screen.back();
    await screen.press(PROFILE.edit);
    await act(async () => {
      screen.renderer.root
        .findAll(
          node =>
            node.props?.testID === 'vendor-profile-business-name' &&
            typeof node.props?.onChangeText === 'function',
        )[0]
        .props.onChangeText('Kumar & Sons Electricals');
    });
    await screen.press(FORM.saveEdit);

    expect(screen.has('vendor-profile-edit')).toBe(false);
    expect(await storedUrls()).toEqual([remote('img_1'), remote('img_2')]);
    expect((await profiles.getProfile()).businessName).toBe('Kumar & Sons Electricals');
    const photos = screen
      .host('vendor-profile-shop-images')
      .findAll(node => typeof node.type === 'string' && node.props?.accessibilityRole === 'image');
    expect(photos).toHaveLength(2);
  });
});

describe('Shop images — leaving', () => {
  it('asks before leaving with a photo not saved; Stay stays, Leave leaves it unsaved', async () => {
    upload.mockRejectedValueOnce(offline());
    const screen = await render();
    await screen.addFromLibrary();

    await screen.back();
    expect(screen.onScreen()).toBe(true);
    expect(textOf(screen.leaveDialog())).toContain(COPY.leaveTitle);
    // Nothing is in the air and nothing went out unanswered: every word is "will not".
    expect(textOf(screen.leaveDialog())).toContain(COPY.leaveMessage(NOTHING_UNCERTAIN));
    expect(textOf(screen.leaveDialog())).not.toContain('will finish');
    expect(textOf(screen.leaveDialog())).not.toContain('may not');

    await screen.press(COPY.leaveStay, screen.leaveDialog());
    expect(screen.onScreen()).toBe(true);
    expect(screen.tiles()).toBe(1);

    await screen.back();
    await screen.press(COPY.leaveConfirm, screen.leaveDialog());

    expect(screen.onScreen()).toBe(false);
    expect(await storedUrls()).toEqual([]);
    expect(screen.text('vendor-profile-shop-images')).toContain(PROFILE.shopImagesEmpty);
  });

  it('leaves at once when everything on screen is saved', async () => {
    const screen = await render();
    await screen.addFromLibrary();

    await screen.back();

    expect(screen.has('shop-images-leave-dialog')).toBe(false);
    expect(screen.onScreen()).toBe(false);
  });

  it('leaves without asking when the only save left has been sent — and it lands', async () => {
    const real = profiles.updateShopImages.bind(profiles);
    const sent = held<VendorProfile>();
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockReturnValueOnce(sent.promise);
    const screen = await render();
    await screen.addFromLibrary();
    expect(updateShopImages).toHaveBeenCalledTimes(1);
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 1)}, ${COPY.saving}`);

    await screen.back();

    // Leaving cannot stop it, so there was nothing to ask.
    expect(screen.has('shop-images-leave-dialog')).toBe(false);
    expect(screen.onScreen()).toBe(false);

    await act(async () => {
      sent.land(await real([remote('img_1')]));
    });
    await screen.flush();

    expect(await storedUrls()).toEqual([remote('img_1')]);
    expect(screen.toast()).toBe(COPY.added);
    // Profile adopted the answer: the square is there.
    const photos = screen
      .host('vendor-profile-shop-images')
      .findAll(node => typeof node.type === 'string' && node.props?.accessibilityRole === 'image');
    expect(photos).toHaveLength(1);
  });

  /** One photo's save sent and held; a second uploaded and waiting behind it. */
  async function oneSentOneWaiting() {
    const real = profiles.updateShopImages.bind(profiles);
    const first = held<VendorProfile>();
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockReturnValueOnce(first.promise);
    const screen = await render();
    await screen.addFromLibrary();
    await screen.addFromLibrary();
    return { screen, first, real, updateShopImages };
  }

  it('says a waiting save is a different thing from one being sent', async () => {
    const { screen } = await oneSentOneWaiting();

    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 2)}, ${COPY.saving}`);
    expect(screen.spoken(2)).toBe(`${COPY.photoSpoken(2, 2)}, ${COPY.waiting}`);
    expect(screen.text('shop-image-2-status')).toContain(COPY.waiting);
    // Its save is in line: taking it off would be undone by that save.
    expect(screen.has('shop-image-2-remove')).toBe(false);
  });

  it('names in the dialog exactly the states the tiles show, and promises a sent save only an answer', () => {
    const plain = COPY.leaveMessage(NOTHING_UNCERTAIN);
    for (const word of [COPY.uploading, COPY.waiting, COPY.uploadFailed, COPY.notSaved]) {
      expect(plain).toContain(word);
    }
    expect(plain).toContain('will not be added');
    expect(plain).not.toContain('may not');
    expect(plain).not.toContain(COPY.saving);

    const sending = COPY.leaveMessage({ alsoSending: true, mayBeSaved: false, alsoRemoving: false });
    expect(sending).toContain(`marked ${COPY.saving} will finish`);
    expect(sending).toContain('you will be told if it is not saved');
    // It can still fail after leaving, so it is never promised to be added.
    expect(sending).not.toMatch(/will (still )?be added/);
  });

  it('says "may not" only for the states a save with no answer can be in', () => {
    const uncertain = COPY.leaveMessage({ alsoSending: false, mayBeSaved: true, alsoRemoving: false });

    // Never reached a save: still exactly "will not".
    expect(uncertain).toContain(
      `marked ${COPY.uploading} or ${COPY.uploadFailed} will not be added`,
    );
    // A save went out and no answer came: it may be stored already.
    expect(uncertain).toContain(`marked ${COPY.waiting} or ${COPY.notSaved} may not be`);
    expect(uncertain).toContain('check your shop images later');
    expect(uncertain).not.toMatch(/will (still )?be added/);
  });

  it('tells the truth about a photo whose save got no answer when leaving', async () => {
    const real = profiles.updateShopImages.bind(profiles);
    jest.spyOn(profiles, 'updateShopImages').mockImplementationOnce(async (list: string[]) => {
      await real(list);
      throw offline();
    });
    const screen = await render();
    await screen.addFromLibrary();
    expect(screen.text('shop-image-1-status')).toContain(COPY.notSaved);

    await screen.back();

    expect(textOf(screen.leaveDialog())).toContain(
      COPY.leaveMessage({ alsoSending: false, mayBeSaved: true, alsoRemoving: false }),
    );
    await screen.press(COPY.leaveConfirm, screen.leaveDialog());

    // It had been stored; the next read finds it, and it is drawn once, as saved.
    await screen.open();
    expect(screen.tiles()).toBe(1);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 1));
  });

  it('asks before leaving with a save waiting, says the sent one will finish, and sends only that one', async () => {
    const { screen, first, real, updateShopImages } = await oneSentOneWaiting();

    await screen.back();

    expect(screen.onScreen()).toBe(true);
    expect(textOf(screen.leaveDialog())).toContain(
      COPY.leaveMessage({ alsoSending: true, mayBeSaved: false, alsoRemoving: false }),
    );

    await screen.press(COPY.leaveConfirm, screen.leaveDialog());
    expect(screen.onScreen()).toBe(false);

    await act(async () => {
      first.land(await real([remote('img_1')]));
    });
    await screen.flush();

    // Exactly what the dialog said: the sent one landed, the waiting one was never sent.
    expect(updateShopImages).toHaveBeenCalledTimes(1);
    expect(await storedUrls()).toEqual([remote('img_1')]);
    const photos = screen
      .host('vendor-profile-shop-images')
      .findAll(node => typeof node.type === 'string' && node.props?.accessibilityRole === 'image');
    expect(photos).toHaveLength(1);
  });

  it('leaves by itself once, while it asks, nothing would be lost any more', async () => {
    const { screen, first, real, updateShopImages } = await oneSentOneWaiting();
    await screen.back();
    expect(screen.has('shop-images-leave-dialog')).toBe(true);

    // The first lands, so the waiting one is sent in its turn — nothing left to lose.
    await act(async () => {
      first.land(await real([remote('img_1')]));
    });
    await screen.flush();

    expect(screen.onScreen()).toBe(false);
    expect(updateShopImages).toHaveBeenCalledTimes(2);
    expect(await storedUrls()).toEqual([remote('img_1'), remote('img_2')]);
  });
});

describe('Shop images — the vendor’s one line, across screens and sessions (review probes, round 4)', () => {
  /*
    Probe B1. With a line per screen, the screen opened again read past the
    last one's save still in the air, showed [], and its next save sent a list
    without that photo — which the server then lost.
  */
  it('reads a screen opened again only after the last one’s save, so a new photo lands beside it', async () => {
    const real = profiles.updateShopImages.bind(profiles);
    const sentX = held<VendorProfile>();
    const getProfile = jest.spyOn(profiles, 'getProfile');
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockReturnValueOnce(sentX.promise);
    const screen = await render();
    await screen.addFromLibrary();
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 1)}, ${COPY.saving}`);

    // Saving is no reason to ask: Back leaves at once. Then Shop images is opened again.
    await screen.back();
    expect(screen.onScreen()).toBe(false);
    const reads = getProfile.mock.calls.length;
    await screen.press(PROFILE.shopImages);

    // Its first read waits for X's save: placeholders, and nothing read yet.
    expect(screen.host('shop-images-grid').props.accessibilityState).toEqual({ busy: true });
    expect(getProfile.mock.calls.length).toBe(reads);

    await act(async () => {
      sentX.land(await real([remote('img_1')]));
    });
    await screen.flush();

    expect(getProfile.mock.calls.length).toBe(reads + 1);
    expect(screen.tiles()).toBe(1);
    expect(screen.spoken(1)).toBe(COPY.photoSpoken(1, 1));

    await screen.addFromLibrary();

    expect(updateShopImages).toHaveBeenLastCalledWith([remote('img_1'), remote('img_2')]);
    expect(await storedUrls()).toEqual([remote('img_1'), remote('img_2')]);
    await screen.back();
    expect(screen.profilePhotos()).toHaveLength(2);
  });

  /*
    Probe B4. A pull's read that ends after its screen has gone changed nothing
    stored, and must not be put on Profile — it may be older than what Profile
    already shows.
  */
  it('never puts a read on Profile that ends after its screen has gone', async () => {
    await profiles.updateShopImages([seeded(1), seeded(2)]);
    const screen = await render();
    const stored = await profiles.getProfile();
    const read = held<VendorProfile>();
    jest.spyOn(profiles, 'getProfile').mockReturnValueOnce(read.promise);

    await act(async () => {
      screen.scroll().props.refreshControl.props.onRefresh();
    });
    // Nothing unsaved: Back leaves at once, the read still in the air.
    await screen.back();
    expect(screen.onScreen()).toBe(false);
    expect(screen.profilePhotos()).toHaveLength(2);

    // It answers late, with an older list.
    await act(async () => {
      read.land({ ...stored, shopImageUrls: [seeded(1)] });
    });
    await screen.flush();

    expect(screen.profilePhotos()).toHaveLength(2);
  });

  it('makes the profile form’s save wait for a shop save still answering, so Profile ends on the newer business', async () => {
    const real = profiles.updateShopImages.bind(profiles);
    const reply = held<void>();
    // Stored at once, as a server would; only its answer is slow to come back.
    jest.spyOn(profiles, 'updateShopImages').mockImplementationOnce(async (list: string[]) => {
      const answer = await real(list);
      await reply.promise;
      return answer;
    });
    const saveProfile = jest.spyOn(profiles, 'saveProfile');
    const screen = await render();
    await screen.addFromLibrary();
    await screen.back();

    await screen.press(PROFILE.edit);
    await act(async () => {
      screen.renderer.root
        .findAll(
          node =>
            node.props?.testID === 'vendor-profile-business-name' &&
            typeof node.props?.onChangeText === 'function',
        )[0]
        .props.onChangeText('Kumar & Sons Electricals');
    });
    await screen.press(FORM.saveEdit);
    // In line behind the shop save's answer: not sent yet.
    expect(saveProfile).not.toHaveBeenCalled();

    await act(async () => {
      reply.land();
    });
    await screen.flush();

    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(screen.has('vendor-profile-edit')).toBe(false);
    expect(screen.text('vendor-profile-business')).toBe('Kumar & Sons Electricals');
    expect(screen.profilePhotos()).toHaveLength(1);
  });

  it('runs nothing one vendor asked for in another vendor’s session', async () => {
    await profiles.updateShopImages([seeded(1)]);
    const ravi = await profiles.getProfile();
    const sentX = held<VendorProfile>();
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockReturnValueOnce(sentX.promise);
    const screen = await render();

    // Ravi: a save in the air, and a confirmed removal waiting behind it.
    await screen.addFromLibrary();
    await screen.press(COPY.removeSpoken(1, 2));
    await screen.press(COPY.removeConfirm, screen.dialog());
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 2)}, ${COPY.removing}`);

    // Meena signs in on the same device; Ravi's save answers afterwards.
    await screen.switchTo(MEENA);
    await act(async () => {
      sentX.land({ ...ravi, shopImageUrls: [seeded(1), remote('img_1')] });
    });
    await screen.flush();

    // Ravi's waiting removal was never sent — not as Ravi, and not into Meena's session.
    expect(updateShopImages).toHaveBeenCalledTimes(1);
    expect(await storedUrls()).toEqual([]);
    await screen.press('Profile');
    expect(screen.text('vendor-profile-shop-images')).toContain(PROFILE.shopImagesEmpty);
  });
});

describe('Shop images — unmounted part-way', () => {
  /** One photo's save sent and held, a second photo's upload held. */
  async function sentAndUploading() {
    const real = profiles.updateShopImages.bind(profiles);
    const sent = held<VendorProfile>();
    const uploading = held<ImageUploadResult>();
    let progress!: UploadProgressListener;
    const updateShopImages = jest
      .spyOn(profiles, 'updateShopImages')
      .mockReturnValueOnce(sent.promise);
    upload
      .mockImplementationOnce(uploaded)
      .mockImplementationOnce((_asset: ImageAsset, onProgress: UploadProgressListener) => {
        progress = onProgress;
        return uploading.promise;
      });
    const screen = await render();
    await screen.addFromLibrary();
    await screen.addFromLibrary();
    expect(screen.spoken(1)).toBe(`${COPY.photoSpoken(1, 2)}, ${COPY.saving}`);
    expect(screen.spoken(2)).toBe(`${COPY.photoSpoken(2, 2)}, ${COPY.uploading}`);
    return { screen, sent, uploading, real, updateShopImages, progress: () => progress };
  }

  it('touches nothing and sends nothing more once the whole tree is gone, without an error', async () => {
    const { screen, uploading, updateShopImages, progress } = await sentAndUploading();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      screen.renderer.unmount();
    });
    mounted.splice(mounted.indexOf(screen.renderer), 1);

    // The upload reports progress and finishes after the tree has gone. (The sent
    // save stays unanswered: answering it would toast into a provider that is gone.)
    await act(async () => {
      progress()({ assetId: 'img_2', status: 'uploading', progress: 0.9 });
      uploading.land({ assetId: 'img_2', remoteUrl: remote('img_2') });
    });
    await flush();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    // The upload that finished afterwards was never saved.
    expect(updateShopImages).toHaveBeenCalledTimes(1);
    expect(await storedUrls()).toEqual([]);
  });

  it('lands only the save already sent once the screen is left mid-way, without an error', async () => {
    const { screen, sent, uploading, real, updateShopImages } = await sentAndUploading();

    // The upload is unsaved, so leaving asks; the vendor leaves anyway.
    await screen.back();
    await screen.press(COPY.leaveConfirm, screen.leaveDialog());
    expect(screen.onScreen()).toBe(false);

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      uploading.land({ assetId: 'img_2', remoteUrl: remote('img_2') });
      sent.land(await real([remote('img_1')]));
    });
    await screen.flush();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    expect(updateShopImages).toHaveBeenCalledTimes(1);
    expect(await storedUrls()).toEqual([remote('img_1')]);
    expect(screen.toast()).toBe(COPY.added);
  });
});

describe('Shop images — whose', () => {
  it('shows each vendor their own photos, and never the last vendor’s', async () => {
    await profiles.updateShopImages([seeded(1)]);
    const screen = await render();
    expect(screen.tiles()).toBe(1);

    await screen.switchTo(MEENA);
    await screen.open();

    expect(screen.tiles()).toBe(0);
    expect(screen.text('shop-images-count')).toBe(COPY.emptyCount(MAX));
    await screen.addFromLibrary();
    expect((await profiles.getProfile()).shopImageUrls).toEqual([remote('img_1')]);

    current = RAVI;
    expect(await storedUrls()).toEqual([seeded(1)]);
  });
});
