/**
 * Vendor profile setup (PROJECT_BIBLE.md section 38, Phase 3E-1), through the
 * real VendorNavigator.
 *
 * Pinned here:
 *
 * - a vendor who has not set up sees setup and nothing else; one who has goes
 *   straight to the application
 * - the business name and at least one service are required; a refused form
 *   never reaches the service and keeps what was typed
 * - a valid save sends trimmed values and swaps setup for the application —
 *   without any screen navigating
 * - Save cannot be pressed twice; a failed save keeps everything and retries
 * - a photo that fails to upload is kept for Try again, and saved with the form
 * - the same form edits the profile later, from the Profile tab
 * - another vendor on the same device starts from their own, empty profile
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { VendorNavigator } from '@/navigation/VendorNavigator';
import { ToastProvider } from '@/shared/components';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { ImageAsset, ImageService } from '@/shared/services/types/ImageService';
import type {
  VendorProfile,
  VendorProfileUpdate,
} from '@/shared/services/types/VendorProfileService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const FORM = VENDOR_COPY.profileForm;
const RULES = VENDOR_COPY.validation;

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
  email: 'meena.iyer@example.com',
  phone: '9000000002',
  role: 'vendor',
};

const CATEGORIES = [
  { id: 'cat_electrician', name: 'Electrician' },
  { id: 'cat_plumber', name: 'Plumber' },
];

const ASSET: ImageAsset = {
  id: 'img_1',
  uri: 'file:///cache/shop.jpg',
  fileName: 'shop.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1000,
  width: 800,
  height: 600,
};

const UPLOADED = 'https://cdn.example.com/shop.jpg';

let current: AuthUser;
let profiles: MockVendorProfileService;
let upload: jest.Mock;

beforeEach(() => {
  resetServices();
  current = RAVI;
  // Real rules, in memory: what the service does is part of what is tested.
  profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser: async () => current });
  registerService('vendorProfile', profiles);
  // What setup hands over to (Phase 3E-2); the dashboard has its own suite.
  registerService(
    'vendorDashboard',
    new MockVendorDashboardService({ latency: NO_LATENCY, currentUser: async () => current }),
  );
  registerService('category', {
    listServiceCategories: jest.fn(async () => CATEGORIES),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  upload = jest.fn(async () => ({ assetId: ASSET.id, remoteUrl: UPLOADED }));
  registerService('image', {
    pickFromGallery: jest.fn(async () => [ASSET]),
    pickFromCamera: jest.fn(async () => [ASSET]),
    validate: jest.fn(() => ({ valid: true })),
    compress: jest.fn(async (asset: ImageAsset) => asset),
    upload,
  } as unknown as ImageService);

  setSessionStorage({
    read: async () => ({ token: 'token', user: current }),
    write: async () => undefined,
    clear: async () => undefined,
  });
});

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

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {});
  }
}

async function render() {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: current }));

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer>
              <VendorNavigator />
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  await flush();

  const has = (id: string) => renderer.root.findAll(node => node.props?.testID === id).length > 0;

  const pressable = (label: string) =>
    renderer.root.findAll(
      node => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
    );

  const press = async (label: string) => {
    const [target] = pressable(label);
    if (!target) {
      throw new Error(`Nothing labelled "${label}"`);
    }
    await act(async () => {
      target.props.onPress();
    });
    await flush();
  };

  const field = (id: string) => {
    const [target] = renderer.root.findAll(
      node => node.props?.testID === id && typeof node.props?.onChangeText === 'function',
    );
    if (!target) {
      throw new Error(`No field "${id}"`);
    }
    return target;
  };

  const type = async (id: string, value: string) => {
    await act(async () => {
      field(id).props.onChangeText(value);
    });
  };

  const checked = (label: string) =>
    pressable(label).some(node => node.props.accessibilityState?.checked === true);

  const switchTo = async (user: AuthUser) => {
    current = user;
    await act(async () => {
      store.dispatch(signedIn({ token: 'token', user }));
    });
    await flush();
  };

  return {
    renderer,
    has,
    press,
    pressable,
    type,
    field,
    checked,
    switchTo,
    text: () => textOf(renderer.toJSON()),
    inSetup: () => has('vendor-profile-setup'),
  };
}

const saveSetup = FORM.saveSetup;

describe('Vendor profile setup — which screen', () => {
  it('opens on setup, and only setup, for a vendor who has not set up', async () => {
    const screen = await render();

    expect(screen.inSetup()).toBe(true);
    expect(screen.text()).toContain(FORM.setupTitle);
    expect(screen.text()).not.toContain('Dashboard');
    expect(screen.field('vendor-profile-business-name').props.value).toBe('');
  });

  it('shows the account’s contact details rather than asking for them', async () => {
    current = MEENA;
    const screen = await render();

    expect(screen.text()).toContain('9000000002');
    expect(screen.text()).toContain('meena.iyer@example.com');
    expect(screen.text()).toContain('Meena Iyer');
    expect(() => screen.field('vendor-profile-phone')).toThrow();
  });

  it('opens straight on the application once set up', async () => {
    await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });

    const screen = await render();

    expect(screen.inSetup()).toBe(false);
    expect(screen.text()).toContain('Dashboard');
  });

  it('says so and offers a retry when the profile cannot be loaded', async () => {
    const getProfile = jest.spyOn(profiles, 'getProfile');
    getProfile.mockRejectedValueOnce(new AppError({ kind: 'network', message: 'offline' }));

    const screen = await render();
    expect(screen.has('vendor-gate-error')).toBe(true);

    await screen.press('Try again');
    expect(screen.inSetup()).toBe(true);
  });
});

describe('Vendor profile setup — validation', () => {
  it('refuses to save without a business name, and keeps what was typed', async () => {
    const save = jest.spyOn(profiles, 'saveProfile');
    const screen = await render();

    await screen.type('vendor-profile-description', 'Wiring and repairs');
    await screen.press('Electrician');
    await screen.press(saveSetup);

    expect(save).not.toHaveBeenCalled();
    expect(screen.text()).toContain(RULES.businessNameRequired);
    expect(screen.has('vendor-profile-fix-errors')).toBe(true);
    expect(screen.field('vendor-profile-description').props.value).toBe('Wiring and repairs');
    expect(screen.checked('Electrician')).toBe(true);
    expect(screen.inSetup()).toBe(true);
  });

  it('treats a name of spaces as no name', async () => {
    const save = jest.spyOn(profiles, 'saveProfile');
    const screen = await render();

    await screen.type('vendor-profile-business-name', '    ');
    await screen.press('Electrician');
    await screen.press(saveSetup);

    expect(save).not.toHaveBeenCalled();
    expect(screen.text()).toContain(RULES.businessNameRequired);
  });

  it('requires at least one service', async () => {
    const save = jest.spyOn(profiles, 'saveProfile');
    const screen = await render();

    await screen.type('vendor-profile-business-name', 'Kumar Electricals');
    await screen.press(saveSetup);

    expect(save).not.toHaveBeenCalled();
    expect(screen.text()).toContain(RULES.categoriesRequired);
  });
});

describe('Vendor profile setup — categories', () => {
  it('selects and deselects a service, and says so to a screen reader', async () => {
    const screen = await render();

    await screen.press('Plumber');
    expect(screen.checked('Plumber')).toBe(true);

    await screen.press('Plumber');
    expect(screen.checked('Plumber')).toBe(false);
  });
});

describe('Vendor profile setup — saving', () => {
  it('sends trimmed values and swaps setup for the application', async () => {
    const save = jest.spyOn(profiles, 'saveProfile');
    const screen = await render();

    await screen.type('vendor-profile-business-name', '  Kumar Electricals  ');
    await screen.type('vendor-profile-area', ' Koramangala ');
    await screen.press('Electrician');
    await screen.press('Plumber');
    await screen.press(saveSetup);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual({
      businessName: 'Kumar Electricals',
      serviceCategoryIds: ['cat_electrician', 'cat_plumber'],
      serviceArea: { description: 'Koramangala' },
    });
    expect(screen.inSetup()).toBe(false);
    expect(screen.text()).toContain('Dashboard');
    await expect(profiles.getProfile()).resolves.toMatchObject({ isSetupComplete: true });
  });

  it('cannot be saved twice by pressing Save twice', async () => {
    let finish!: (profile: VendorProfile) => void;
    const save = jest
      .spyOn(profiles, 'saveProfile')
      .mockImplementationOnce(
        (_update: VendorProfileUpdate) => new Promise<VendorProfile>(resolve => (finish = resolve)),
      );
    const screen = await render();

    await screen.type('vendor-profile-business-name', 'Kumar Electricals');
    await screen.press('Electrician');

    const [button] = screen.pressable(saveSetup);
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    await flush();

    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish({
        vendorId: RAVI.id,
        businessName: 'Kumar Electricals',
        serviceCategoryIds: ['cat_electrician'],
        shopImageUrls: [],
        acceptingRequests: true,
        workingHours: [],
        ownerName: 'Ravi Kumar',
        phone: RAVI.phone,
        isSetupComplete: true,
      });
    });
    await flush();
    expect(screen.text()).toContain('Dashboard');
  });

  it('keeps everything after a failed save, and saves on the next press', async () => {
    const save = jest
      .spyOn(profiles, 'saveProfile')
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'offline' }));
    const screen = await render();

    await screen.type('vendor-profile-business-name', 'Kumar Electricals');
    await screen.press('Electrician');
    await screen.press(saveSetup);

    expect(screen.has('vendor-profile-save-error')).toBe(true);
    expect(screen.inSetup()).toBe(true);
    expect(screen.field('vendor-profile-business-name').props.value).toBe('Kumar Electricals');
    expect(screen.checked('Electrician')).toBe(true);

    await screen.press(saveSetup);

    expect(save).toHaveBeenCalledTimes(2);
    expect(screen.text()).toContain('Dashboard');
  });
});

describe('Vendor profile setup — the photo', () => {
  it('keeps a photo that failed to upload for Try again, then saves it with the form', async () => {
    upload.mockRejectedValueOnce(new AppError({ kind: 'network', message: 'offline' }));
    const save = jest.spyOn(profiles, 'saveProfile');
    const screen = await render();

    await screen.press(FORM.photoAddGallerySpoken);
    expect(screen.has('vendor-profile-photo-error')).toBe(true);
    // Not drawn as the business's picture: nothing was uploaded.
    expect(screen.pressable(FORM.photoRemoveSpoken)).toHaveLength(0);

    await screen.press(FORM.photoRetry);
    expect(screen.has('vendor-profile-photo-error')).toBe(false);
    // Now there is a picture, the actions say they replace it.
    expect(screen.pressable(FORM.photoReplaceGallerySpoken).length).toBeGreaterThan(0);

    await screen.type('vendor-profile-business-name', 'Kumar Electricals');
    await screen.press('Electrician');
    await screen.press(saveSetup);

    expect(save.mock.calls[0][0].imageUrl).toBe(UPLOADED);
  });

  it('forgets a failed photo when it is discarded', async () => {
    upload.mockRejectedValueOnce(new AppError({ kind: 'network', message: 'offline' }));
    const screen = await render();

    await screen.press(FORM.photoAddCameraSpoken);
    await screen.press(FORM.photoDiscard);

    expect(screen.has('vendor-profile-photo-error')).toBe(false);
    expect(screen.pressable(FORM.photoAddCameraSpoken).length).toBeGreaterThan(0);
  });

  it('removes a photo before saving', async () => {
    const save = jest.spyOn(profiles, 'saveProfile');
    const screen = await render();

    await screen.press(FORM.photoAddGallerySpoken);
    await screen.press(FORM.photoRemoveSpoken);
    await screen.type('vendor-profile-business-name', 'Kumar Electricals');
    await screen.press('Electrician');
    await screen.press(saveSetup);

    expect(save.mock.calls[0][0].imageUrl).toBeUndefined();
  });

  it('refuses a Save pressed in the same moment a photo starts uploading, then saves it with the photo', async () => {
    // The frame before the screen has drawn the upload as running: Save's
    // handler still holds the old "not busy", and used to save the profile
    // without the picture that was on its way (the team form's 21/10/2026 fix).
    let land!: (uploaded: { assetId: string; remoteUrl: string }) => void;
    upload.mockReturnValueOnce(new Promise(resolve => (land = resolve)));
    const save = jest.spyOn(profiles, 'saveProfile');
    const screen = await render();

    await screen.type('vendor-profile-business-name', 'Kumar Electricals');
    await screen.press('Electrician');

    const [camera] = screen.pressable(FORM.photoAddCameraSpoken);
    const [button] = screen.pressable(saveSetup);
    await act(async () => {
      camera.props.onPress();
      button.props.onPress();
    });
    await flush();

    expect(save).not.toHaveBeenCalled();
    expect(screen.inSetup()).toBe(true);

    await act(async () => {
      land({ assetId: ASSET.id, remoteUrl: UPLOADED });
    });
    await flush();

    // Nothing was saved behind the vendor's back once the photo landed…
    expect(save).not.toHaveBeenCalled();

    // …and the next Save carries it.
    await screen.press(saveSetup);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].imageUrl).toBe(UPLOADED);
  });
});

describe('Vendor profile — editing and ownership', () => {
  it('edits the same profile from the Profile tab and returns to it', async () => {
    await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });
    const screen = await render();

    await screen.press('Profile');
    expect(screen.text()).toContain('Kumar Electricals');
    expect(screen.text()).toContain('Electrician');

    await screen.press(VENDOR_COPY.profile.edit);
    expect(screen.has('vendor-profile-edit')).toBe(true);
    expect(screen.field('vendor-profile-business-name').props.value).toBe('Kumar Electricals');
    expect(screen.checked('Electrician')).toBe(true);

    await screen.type('vendor-profile-business-name', 'Kumar & Sons Electricals');
    await screen.press(FORM.saveEdit);

    expect(screen.has('vendor-profile-edit')).toBe(false);
    expect(screen.text()).toContain('Kumar & Sons Electricals');
  });

  it('starts another vendor on the same device from their own, empty profile', async () => {
    const screen = await render();
    await screen.type('vendor-profile-business-name', 'Kumar Electricals');
    await screen.press('Electrician');
    await screen.press(saveSetup);
    expect(screen.inSetup()).toBe(false);

    await screen.switchTo(MEENA);

    expect(screen.inSetup()).toBe(true);
    expect(screen.field('vendor-profile-business-name').props.value).toBe('');
    expect(screen.text()).not.toContain('Kumar Electricals');

    await screen.switchTo(RAVI);
    expect(screen.inSetup()).toBe(false);
  });
});
