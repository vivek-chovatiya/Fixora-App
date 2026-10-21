/**
 * The customer profile (PROJECT_BIBLE.md section 25), as the owner scoped it for
 * Phase 3D-7: read-only, from the session, plus a Logout that asks first.
 *
 * Pinned here:
 *
 * - it shows the session's name, phone and email, and nothing it does not have:
 *   no email row without an email, the phone number in place of a missing name,
 *   initials or the profile glyph in the avatar — the phone, in both places,
 *   written for reading ("+91 98765 43210") rather than as stored
 * - it offers nothing that is not built — Log out is the only control
 * - Log out asks; Cancel changes nothing, the unsent draft included
 * - confirming clears the draft first, then the session, once however often it
 *   is pressed, and survives the server refusing to sign out
 * - a customer's submitted requests and reviews are still stored afterwards,
 *   and their draft cannot reach the next customer on the device
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { AppConfig } from '@/core/config/AppConfig';
import { setSessionStorage, type SessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { profileOf } from '@/features/customer/hooks/useCustomerProfile';
import { CustomerProfileScreen } from '@/features/customer/screens/CustomerProfileScreen';
import {
  RequestDraftProvider,
  useRequestDraft,
  type RequestDraft,
} from '@/features/customer/state/RequestDraftContext';
import {
  AsyncStorageRequestDraft,
  setRequestDraftStorage,
  type RequestDraftStorage,
} from '@/features/customer/state/requestDraftStorage';
import { AsyncStorageMockRequestHistory } from '@/shared/services/mock/MockRequestHistoryStorage';
import { AsyncStorageMockReviewStorage } from '@/shared/services/mock/MockReviewStorage';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService } from '@/shared/services/types/AuthService';
import type { CustomerRequestDetails } from '@/shared/services/types/RequestService';
import { ThemeProvider } from '@/shared/theme';

const COPY = CUSTOMER_COPY.profile;

const ASHA: AuthUser = {
  id: 'usr_customer_1',
  firstName: 'Asha',
  lastName: 'Patel',
  phone: '9876543210',
  role: 'customer',
};

const LONG: AuthUser = {
  id: 'usr_customer_2',
  firstName: 'Venkata Subrahmanya Lakshmi',
  lastName: 'Narasimhamurthy-Ramachandran',
  email: 'venkata.narasimhamurthy.ramachandran@example.com',
  phone: '9876543211',
  role: 'customer',
};

const NAMELESS: AuthUser = {
  id: 'usr_customer_3',
  firstName: '',
  lastName: '',
  phone: '9876543212',
  role: 'customer',
};

const DRAFT: RequestDraft = {
  categoryId: 'cat_electrician',
  subCategoryId: 'sub_fan_repair',
  values: { priority: 'HIGH', preferredDate: '', preferredTime: '', notes: 'Fan grinds.' },
  imageUrls: [],
  address: { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' },
  vendor: { kind: 'none' },
};

function textOf(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string {
  if (node === null) {
    return '';
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(' ');
  }
  return (node.children ?? [])
    .map(child => (typeof child === 'string' ? child : textOf(child)))
    .join(' ');
}

/** Everything the steps below do, in the order they did it. */
let calls: string[] = [];

const sessionClear = jest.fn(async () => {
  calls.push('session.clear');
});

beforeEach(async () => {
  calls = [];
  sessionClear.mockClear();
  await AsyncStorage.clear();

  const session: SessionStorage = {
    read: async () => null,
    write: async () => undefined,
    clear: sessionClear,
  };
  setSessionStorage(session);

  registerService('auth', {
    signOut: jest.fn(async () => {
      calls.push('auth.signOut');
    }),
  } as unknown as AuthService);
});

afterEach(() => {
  resetServices();
});

/** The draft storage, recording its clears. */
function recordingDraftStorage(saved: RequestDraft | null): RequestDraftStorage & {
  clear: jest.Mock;
} {
  return {
    read: jest.fn(async () => (saved ? { draft: saved, savedAt: new Date().toISOString() } : null)),
    write: jest.fn(async () => true),
    clear: jest.fn(async () => {
      calls.push('draft.clear');
    }),
  };
}

async function render(user: AuthUser, draft: RequestDraft | null = DRAFT) {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user }));

  const storage = recordingDraftStorage(draft);
  setRequestDraftStorage(storage);

  let current: RequestDraft | null | undefined;
  function DraftProbe() {
    current = useRequestDraft().draft;
    return null;
  }

  const navigation = {} as never;
  const route = { key: 'Profile', name: 'Profile' as const } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <RequestDraftProvider ownerId={user.id}>
            <DraftProbe />
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

  return {
    store,
    storage,
    renderer,
    byTestID,
    draft: () => current,
    text: () => textOf(renderer.toJSON()),
    labelOf: (id: string): string | undefined => byTestID(id)[0]?.props.accessibilityLabel,
    buttons: () =>
      renderer.root
        .findAll(
          node =>
            node.props?.accessibilityRole === 'button' &&
            typeof node.props?.onPress === 'function',
        )
        .map(node => node.props.accessibilityLabel as string),
    /** The dialog's buttons are found inside it, so the screen's Log out is not mistaken for them. */
    dialogButton: (label: string) =>
      byTestID('profile-logout-dialog')[0]?.findAll(
        node =>
          node.props?.accessibilityRole === 'button' &&
          node.props?.accessibilityLabel === label &&
          typeof node.props?.onPress === 'function',
      )[0],
    press: async (target: ReactTestRenderer.ReactTestInstance | undefined) => {
      if (!target) {
        throw new Error('Nothing to press');
      }
      await act(async () => {
        target.props.onPress();
      });
      await act(async () => {});
    },
    screenLogOut: () => button(COPY.logout).find(node => !isInside(node, 'profile-logout-dialog')),
  };
}

function isInside(node: ReactTestRenderer.ReactTestInstance, testID: string): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.props?.testID === testID) {
      return true;
    }
  }
  return false;
}

describe('profileOf', () => {
  it('joins the first and last name, trimmed', () => {
    expect(profileOf({ ...ASHA, firstName: '  Asha ', lastName: ' Patel ' })).toEqual({
      // The parts stay separate for the form that edits them (3D-8); the joined
      // name is what the page reads by.
      firstName: 'Asha',
      lastName: 'Patel',
      name: 'Asha Patel',
      heading: 'Asha Patel',
      phone: '9876543210',
    });
  });

  it('uses whichever half of a name there is', () => {
    expect(profileOf({ ...ASHA, lastName: '' }).heading).toBe('Asha');
    expect(profileOf({ ...ASHA, firstName: '   ' }).heading).toBe('Patel');
  });

  it('heads the page with the phone number, written for reading, when there is no name', () => {
    expect(profileOf(NAMELESS)).toEqual({
      firstName: '',
      lastName: '',
      name: null,
      // The heading is text to read (owner, 21/10/2026); the phone stays the
      // stored value, for anything that edits or sends it.
      heading: '+91 98765 43212',
      phone: '9876543212',
    });
  });

  it('keeps an email, and treats a blank one as none', () => {
    expect(profileOf(LONG).email).toBe(LONG.email);
    expect(Object.keys(profileOf({ ...ASHA, email: '   ' }))).not.toContain('email');
    expect(Object.keys(profileOf(ASHA))).not.toContain('email');
  });
});

describe('CustomerProfileScreen — what it shows', () => {
  it('names itself, and shows the name, phone and email', async () => {
    const { byTestID, labelOf } = await render(LONG);

    expect(byTestID('profile-heading')[0].props.children).toBe(COPY.title);
    expect(byTestID('profile-heading')[0].props.accessibilityRole).toBe('header');
    expect(byTestID('profile-name')[0].props.children).toBe(
      'Venkata Subrahmanya Lakshmi Narasimhamurthy-Ramachandran',
    );
    // Written for reading, not as the stored digits (owner, 21/10/2026).
    expect(labelOf('profile-phone')).toBe(`${COPY.phoneLabel}: +91 98765 43211`);
    expect(labelOf('profile-phone')).not.toContain('9876543211');
    expect(labelOf('profile-email')).toBe(`${COPY.emailLabel}: ${LONG.email}`);
  });

  it('hides the email row when the account has no email, and offers none', async () => {
    const { byTestID, text } = await render(ASHA);

    expect(byTestID('profile-email')).toHaveLength(0);
    expect(text()).not.toContain(COPY.emailLabel);
    expect(text()).not.toMatch(/add email/i);
  });

  it('draws the name wrapping, never cut off', async () => {
    const { byTestID } = await render(LONG);

    expect(byTestID('profile-name')[0].props.numberOfLines).toBeUndefined();
  });

  it('shows initials in the avatar, and names it', async () => {
    const { byTestID, labelOf } = await render(ASHA);

    const avatar = byTestID('profile-avatar')[0];
    expect(avatar.props.accessibilityRole).toBe('image');
    expect(labelOf('profile-avatar')).toBe('Asha Patel profile picture');
    expect(avatar.findAll(node => node.props?.children === 'AP').length).toBeGreaterThan(0);
  });

  it('heads a nameless account with its phone number and a glyph for an avatar', async () => {
    const { byTestID, labelOf } = await render(NAMELESS);

    expect(byTestID('profile-name')[0].props.children).toBe('+91 98765 43212');
    expect(labelOf('profile-avatar')).toBe('Profile picture');
    const avatar = byTestID('profile-avatar')[0];
    // No letters at all: the fallback glyph, not an empty string of initials.
    expect(avatar.findAll(node => typeof node.props?.children === 'string')).toHaveLength(0);
    expect(avatar.findAll(node => node.props?.name === 'profile').length).toBeGreaterThan(0);
  });

  /*
    Section 25's four actions, and nothing else: 3D-8 added the picture and Edit
    Profile, 3D-9 added Manage Addresses. What stays absent is section 25's
    "Future" list, which this is what keeps absent.
  */
  it('offers exactly the actions section 25 defines — and none of its future ones', async () => {
    const { buttons, text } = await render(LONG);

    expect(buttons()).toEqual([
      COPY.photoCamera,
      COPY.photoGallery,
      COPY.edit,
      COPY.addresses,
      COPY.logout,
    ]);
    expect(text()).not.toMatch(/favourite|favorite|saved service|setting|notification/i);
  });
});

describe('CustomerProfileScreen — logging out', () => {
  it('asks first, in the owner’s words, with two distinct answers', async () => {
    const { press, screenLogOut, byTestID, dialogButton, text } = await render(ASHA);

    expect(byTestID('profile-logout-dialog')).toHaveLength(0);

    await press(screenLogOut());

    const [dialog] = byTestID('profile-logout-dialog');
    expect(dialog.props.accessibilityViewIsModal).toBe(true);
    expect(dialog.props.accessibilityLabel).toBe(COPY.logoutConfirmTitle);
    expect(text()).toContain(COPY.logoutConfirmTitle);
    expect(text()).toContain(COPY.logoutConfirmMessage);
    expect(dialogButton(COPY.logoutCancel)).toBeDefined();
    expect(dialogButton(COPY.logoutConfirm)).toBeDefined();
    // Nothing has happened yet.
    expect(calls).toEqual([]);
  });

  it('changes nothing on Cancel: still signed in, draft still there', async () => {
    const { press, screenLogOut, dialogButton, byTestID, store, storage, draft } = await render(ASHA);

    expect(draft()).toEqual(DRAFT);
    await press(screenLogOut());
    await press(dialogButton(COPY.logoutCancel));

    expect(byTestID('profile-logout-dialog')).toHaveLength(0);
    expect(store.getState().auth.status).toBe('authenticated');
    expect(storage.clear).not.toHaveBeenCalled();
    expect(sessionClear).not.toHaveBeenCalled();
    expect(draft()).toEqual(DRAFT);
  });

  it('clears the draft, then signs out, on confirming', async () => {
    const { press, screenLogOut, dialogButton, store, draft } = await render(ASHA);

    await press(screenLogOut());
    await press(dialogButton(COPY.logoutConfirm));

    expect(calls).toEqual(['draft.clear', 'auth.signOut', 'session.clear']);
    expect(draft()).toBeNull();
    expect(store.getState().auth.status).toBe('unauthenticated');
    expect(store.getState().auth.user).toBeNull();
  });

  it('logs out once however often confirm is pressed', async () => {
    const { press, screenLogOut, dialogButton } = await render(ASHA);

    await press(screenLogOut());
    const confirm = dialogButton(COPY.logoutConfirm);
    await act(async () => {
      confirm?.props.onPress();
      confirm?.props.onPress();
      confirm?.props.onPress();
    });
    await act(async () => {});

    expect(calls.filter(call => call === 'draft.clear')).toHaveLength(1);
    expect(calls.filter(call => call === 'auth.signOut')).toHaveLength(1);
  });

  it('holds the dialog open and busy while it works, so nothing can be pressed again', async () => {
    let release!: () => void;
    registerService('auth', {
      signOut: jest.fn(
        () =>
          new Promise<void>(done => {
            release = done;
          }),
      ),
    } as unknown as AuthService);
    const { press, screenLogOut, dialogButton, byTestID } = await render(ASHA);

    await press(screenLogOut());
    await press(dialogButton(COPY.logoutConfirm));

    expect(byTestID('profile-logout-dialog')).toHaveLength(1);
    expect(dialogButton(COPY.logoutConfirm)?.props.accessibilityState).toMatchObject({ busy: true });
    expect(dialogButton(COPY.logoutCancel)?.props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await act(async () => {
      release();
    });
  });

  it('still signs out when the server refuses, as sign-out always has', async () => {
    registerService('auth', {
      signOut: jest.fn(async () => {
        throw new Error('offline');
      }),
    } as unknown as AuthService);
    const { press, screenLogOut, dialogButton, store } = await render(ASHA);

    await press(screenLogOut());
    await press(dialogButton(COPY.logoutConfirm));

    expect(sessionClear).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.status).toBe('unauthenticated');
  });

  it('says so, and stays signed in, when the device cannot clear the session', async () => {
    sessionClear.mockImplementationOnce(async () => {
      throw new Error('disk');
    });
    const { press, screenLogOut, dialogButton, store, byTestID, buttons } = await render(ASHA);

    await press(screenLogOut());
    await press(dialogButton(COPY.logoutConfirm));

    expect(store.getState().auth.status).toBe('authenticated');
    expect(byTestID('profile-logout-dialog')).toHaveLength(0);
    expect(byTestID('profile-logout-error')).toHaveLength(1);
    // Log out is still there to try again.
    expect(buttons()).toContain(COPY.logout);
  });
});

/**
 * With the device storage the app really uses: what logging out leaves behind,
 * and what it does not.
 */
describe('CustomerProfileScreen — what survives logging out', () => {
  const REQUEST: CustomerRequestDetails = {
    id: 'REQ-24083',
    categoryId: 'cat_electrician',
    subCategoryId: 'sub_fan_repair',
    categoryName: 'Electrician',
    serviceName: 'Fan Repair',
    status: 'COMPLETED',
    priority: 'HIGH',
    createdAt: '2026-09-20T10:00:00.000Z',
    address: { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' },
  };

  async function renderWithDeviceStorage(user: AuthUser) {
    const screen = await render(user);
    // Swap in the real storage after mounting: the draft under test is written
    // through it for this customer.
    const storage = new AsyncStorageRequestDraft();
    setRequestDraftStorage(storage);
    await storage.write(DRAFT, user.id);
    return { ...screen, storage };
  }

  it('keeps submitted requests and reviews, and removes the draft', async () => {
    const history = new AsyncStorageMockRequestHistory();
    const reviews = new AsyncStorageMockReviewStorage();
    await history.save(ASHA.id, REQUEST);
    await reviews.save(ASHA.id, {
      requestId: REQUEST.id,
      rating: 4,
      submittedAt: '2026-09-21T10:00:00.000Z',
    });

    const { press, screenLogOut, dialogButton, storage } = await renderWithDeviceStorage(ASHA);
    await press(screenLogOut());
    await press(dialogButton(COPY.logoutConfirm));

    expect(await AsyncStorage.getItem(AppConfig.storage.requestDraftKey)).toBeNull();
    expect(await storage.read(ASHA.id)).toBeNull();
    expect(await history.read(ASHA.id)).toEqual([REQUEST]);
    expect(await reviews.read(ASHA.id)).toHaveLength(1);
  });

  it('never offers the next customer the draft, even when clearing it failed', async () => {
    const storage = new AsyncStorageRequestDraft();
    await storage.write(DRAFT, ASHA.id);

    // The removal at logout failed: the draft is still on the device.
    jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('disk'));
    await storage.clear();
    expect(await AsyncStorage.getItem(AppConfig.storage.requestDraftKey)).not.toBeNull();

    // The next customer signs in on the same device.
    let seen: RequestDraft | null | undefined;
    function Probe() {
      const value = useRequestDraft();
      seen = value.isRestored ? value.draft : undefined;
      return null;
    }
    setRequestDraftStorage(storage);
    await act(async () => {
      ReactTestRenderer.create(
        <RequestDraftProvider ownerId={LONG.id}>
          <Probe />
        </RequestDraftProvider>,
      );
    });
    await act(async () => {});

    expect(seen).toBeNull();
    // And it is gone for good, so it cannot surface later either.
    expect(await AsyncStorage.getItem(AppConfig.storage.requestDraftKey)).toBeNull();
  });
});
