/**
 * Edit Profile (PROJECT_BIBLE.md section 25, Phase 3D-8).
 *
 * Pinned here:
 *
 * - the form opens on what the session holds, split back into its parts
 * - the phone is shown but is not a field — section 7A makes it the identity
 * - a valid save sends the trimmed values, updates the session and goes back
 * - an invalid one never reaches the service
 * - a refused one keeps what was typed, stays put, and says what happened
 * - Save cannot be pressed twice
 * - leaving with unsaved edits asks first; leaving an untouched form does not
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { EditProfileScreen } from '@/features/customer/screens/EditProfileScreen';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CustomerProfileUpdate, ProfileService } from '@/shared/services/types/ProfileService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = CUSTOMER_COPY.editProfile;

interface BeforeRemoveEvent {
  data: { action: { type: string } };
  preventDefault: () => void;
}

const ASHA: AuthUser = {
  id: 'usr_customer_1',
  firstName: 'Asha',
  lastName: 'Patel',
  email: 'asha@example.com',
  phone: '9876543210',
  role: 'customer',
};

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
  /** What the service does with the update. Resolves to the new user by default. */
  onUpdate?: (input: CustomerProfileUpdate) => Promise<AuthUser>;
}

async function render({ user = ASHA, onUpdate }: Options = {}) {
  setSessionStorage({
    read: async () => ({ token: 'token', user }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  const updateProfile = jest.fn(
    onUpdate ?? (async (input: CustomerProfileUpdate) => ({ ...user, ...input })),
  );
  registerService('profile', {
    updateProfile,
    setProfileImage: jest.fn(),
    removeProfileImage: jest.fn(),
  } as unknown as ProfileService);

  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user }));

  /*
    A navigator stub with a real `beforeRemove`, because that is where the
    discard guard lives. `goBack` raises the event the way React Navigation
    does, and only actually leaves if nothing prevented it — which is what makes
    "the hardware back button is guarded too" testable at all.
  */
  const goBack = jest.fn();
  const dispatch = jest.fn();
  const listeners: ((event: BeforeRemoveEvent) => void)[] = [];

  const goBackAction = { type: 'GO_BACK' as const };
  const leaveBy = (action: { type: string }) => {
    let prevented = false;
    const event: BeforeRemoveEvent = {
      data: { action },
      preventDefault: () => {
        prevented = true;
      },
    };
    listeners.forEach(listener => listener(event));
    if (!prevented) {
      goBack();
    }
  };

  const navigation = {
    goBack: () => leaveBy(goBackAction),
    dispatch,
    addListener: (name: string, listener: (event: BeforeRemoveEvent) => void) => {
      if (name !== 'beforeRemove') {
        return () => undefined;
      }
      listeners.push(listener);
      return () => {
        listeners.splice(listeners.indexOf(listener), 1);
      };
    },
  } as never;
  const route = { key: 'EditProfile', name: 'EditProfile' as const } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <EditProfileScreen navigation={navigation} route={route} />
        </ThemeProvider>
      </Provider>,
    );
  });
  await act(async () => {});

  const byTestID = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);

  /** The text field inside a labelled wrapper. */
  const field = (id: string) =>
    renderer.root.findAll(
      node => node.props?.testID === id && typeof node.props?.onChangeText === 'function',
    )[0];

  const type = async (id: string, value: string) => {
    await act(async () => {
      field(id).props.onChangeText(value);
    });
    await act(async () => {});
  };

  const button = (label: string) =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    );

  const press = async (target: ReactTestRenderer.ReactTestInstance | undefined) => {
    if (!target) {
      throw new Error('Nothing to press');
    }
    await act(async () => {
      target.props.onPress();
    });
    await act(async () => {});
  };

  return {
    store,
    renderer,
    goBack,
    dispatch,
    goBackAction,
    /** Leaves the way Android's hardware back button does. */
    hardwareBack: async () => {
      await act(async () => {
        leaveBy(goBackAction);
      });
      await act(async () => {});
    },
    updateProfile,
    byTestID,
    field,
    type,
    button,
    press,
    save: async () => {
      // Save shows "Saving…" mid-flight, so it is found by either label.
      const [target] = [...button(COPY.save), ...button(COPY.saving)];
      await press(target);
    },
    text: () => textOf(renderer.toJSON()),
  };
}

afterEach(() => {
  resetServices();
});

describe('EditProfileScreen — what it opens with', () => {
  it('pre-populates each field from the stored profile', async () => {
    const { field } = await render();

    expect(field('edit-profile-first-name').props.value).toBe('Asha');
    expect(field('edit-profile-last-name').props.value).toBe('Patel');
    expect(field('edit-profile-email').props.value).toBe('asha@example.com');
  });

  it('opens an account with no name or email on empty fields, not on the fallback', async () => {
    const nameless: AuthUser = {
      id: 'usr_customer_3',
      firstName: '',
      lastName: '',
      phone: '9876543212',
      role: 'customer',
    };

    const { field } = await render({ user: nameless });

    // Never the phone number: that is what the profile *displays* in place of a
    // missing name, not a name anybody typed.
    expect(field('edit-profile-first-name').props.value).toBe('');
    expect(field('edit-profile-email').props.value).toBe('');
  });

  it('shows the phone as a read-only row, with the reason, and never as a field', async () => {
    const { byTestID, field, text } = await render();

    expect(byTestID('edit-profile-phone')[0]?.props.accessibilityLabel).toBe(
      `${COPY.phoneLabel}: 9876543210`,
    );
    expect(field('edit-profile-phone')).toBeUndefined();
    expect(text()).toContain(COPY.phoneHelp);
  });
});

describe('EditProfileScreen — saving', () => {
  it('sends the trimmed values and returns to the profile', async () => {
    const { type, save, updateProfile, goBack } = await render();

    await type('edit-profile-first-name', '  Asha ');
    await type('edit-profile-last-name', ' Sharma ');
    await save();

    expect(updateProfile).toHaveBeenCalledWith({
      firstName: 'Asha',
      lastName: 'Sharma',
      email: 'asha@example.com',
    });
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('updates the session, so the profile behind it is not stale', async () => {
    const { type, save, store } = await render();

    await type('edit-profile-last-name', 'Sharma');
    await save();

    expect(store.getState().auth.user?.lastName).toBe('Sharma');
  });

  it('sends no email at all when the box is emptied — that is how it is removed', async () => {
    const { type, save, updateProfile } = await render();

    await type('edit-profile-email', '');
    await save();

    expect(updateProfile).toHaveBeenCalledWith({ firstName: 'Asha', lastName: 'Patel' });
  });

  it('accepts a name with no second part', async () => {
    const { type, save, updateProfile } = await render();

    await type('edit-profile-last-name', '');
    await save();

    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ lastName: '' }));
  });

  it('never calls the service when the form is invalid, and says why', async () => {
    const { type, save, updateProfile, text } = await render();

    await type('edit-profile-first-name', '   ');
    await save();

    expect(updateProfile).not.toHaveBeenCalled();
    expect(text()).toContain(`${COPY.firstNameLabel} is required.`);
  });

  it('refuses an address that is not one, without asking the service', async () => {
    const { type, save, updateProfile, text } = await render();

    await type('edit-profile-email', 'not-an-email');
    await save();

    expect(updateProfile).not.toHaveBeenCalled();
    expect(text()).toContain('Enter a valid email address.');
  });
});

describe('EditProfileScreen — when saving fails', () => {
  const refuse = async () => {
    throw new AppError({ kind: 'server', message: 'Mock refused' });
  };

  it('keeps what was typed, stays on the form, and shows a safe message', async () => {
    const { type, save, field, goBack, text } = await render({ onUpdate: refuse });

    await type('edit-profile-first-name', 'Ashaa');
    await save();

    expect(goBack).not.toHaveBeenCalled();
    expect(field('edit-profile-first-name').props.value).toBe('Ashaa');
    expect(text()).toContain(COPY.saveFailedTitle);
    // The service's own words never reach the screen.
    expect(text()).not.toContain('Mock refused');
  });

  it('leaves the session alone, so the profile still shows what is stored', async () => {
    const { type, save, store } = await render({ onUpdate: refuse });

    await type('edit-profile-last-name', 'Sharma');
    await save();

    expect(store.getState().auth.user?.lastName).toBe('Patel');
  });

  it('can be tried again', async () => {
    const { type, save, updateProfile } = await render({ onUpdate: refuse });

    await type('edit-profile-last-name', 'Sharma');
    await save();
    await save();

    expect(updateProfile).toHaveBeenCalledTimes(2);
  });
});

describe('EditProfileScreen — pressed twice', () => {
  it('saves once however often Save is pressed while it is in flight', async () => {
    let release!: (user: AuthUser) => void;
    const pending = new Promise<AuthUser>(resolve => {
      release = resolve;
    });

    const { save, updateProfile, button } = await render({ onUpdate: () => pending });

    await save();
    // Still saving: the label has changed and the button reports itself busy.
    expect(button(COPY.saving).length).toBeGreaterThan(0);

    await save();
    await act(async () => {
      release({ ...ASHA, lastName: 'Patel' });
    });

    expect(updateProfile).toHaveBeenCalledTimes(1);
  });
});

describe('EditProfileScreen — leaving', () => {
  /*
    The back control by its accessible name, not its testID: the testID sits on
    a host node, and only the pressable above it carries onPress.
  */
  const back = async (r: Awaited<ReturnType<typeof render>>) =>
    r.press(r.button(CUSTOMER_COPY.profile.title)[0]);

  it('leaves an untouched form without asking', async () => {
    const r = await render();

    await back(r);

    expect(r.goBack).toHaveBeenCalledTimes(1);
    expect(r.byTestID('edit-profile-discard-dialog')).toHaveLength(0);
  });

  it('asks before throwing away edits, and keeps them if the answer is no', async () => {
    const r = await render();
    await r.type('edit-profile-last-name', 'Sharma');

    await back(r);

    expect(r.goBack).not.toHaveBeenCalled();
    expect(r.text()).toContain(COPY.discardTitle);

    const keep = r
      .byTestID('edit-profile-discard-dialog')[0]
      ?.findAll(
        node =>
          node.props?.accessibilityRole === 'button' &&
          node.props?.accessibilityLabel === COPY.discardKeep &&
          typeof node.props?.onPress === 'function',
      )[0];
    await r.press(keep);

    expect(r.goBack).not.toHaveBeenCalled();
    expect(r.field('edit-profile-last-name').props.value).toBe('Sharma');
  });

  it('leaves without saving when the answer is discard', async () => {
    const r = await render();
    await r.type('edit-profile-last-name', 'Sharma');
    await back(r);

    const discard = r
      .byTestID('edit-profile-discard-dialog')[0]
      ?.findAll(
        node =>
          node.props?.accessibilityRole === 'button' &&
          node.props?.accessibilityLabel === COPY.discardConfirm &&
          typeof node.props?.onPress === 'function',
      )[0];
    await r.press(discard);

    // The interrupted navigation is replayed, not assumed to be a step back.
    expect(r.dispatch).toHaveBeenCalledWith(r.goBackAction);
    expect(r.updateProfile).not.toHaveBeenCalled();
    expect(r.store.getState().auth.user?.lastName).toBe('Patel');
  });

  /*
    On Android the hardware back button and the back gesture are how most people
    leave a screen. A guard that only the header button honoured would look
    present while being trivially avoidable — this is what stops that.
  */
  it('asks when Android’s back button is what leaves, not only the header', async () => {
    const r = await render();
    await r.type('edit-profile-last-name', 'Sharma');

    await r.hardwareBack();

    expect(r.goBack).not.toHaveBeenCalled();
    expect(r.text()).toContain(COPY.discardTitle);
  });

  it('lets Android’s back button through when nothing was edited', async () => {
    const r = await render();

    await r.hardwareBack();

    expect(r.goBack).toHaveBeenCalledTimes(1);
    expect(r.byTestID('edit-profile-discard-dialog')).toHaveLength(0);
  });

  it('does not ask on the way out after a successful save', async () => {
    const r = await render();
    await r.type('edit-profile-last-name', 'Sharma');

    await r.save();

    // The edits are saved, so there is nothing to lose and nothing to ask.
    expect(r.goBack).toHaveBeenCalledTimes(1);
    expect(r.text()).not.toContain(COPY.discardTitle);
  });
});
