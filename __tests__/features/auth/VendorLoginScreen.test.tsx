/**
 * Returning-vendor sign in. Two credentials go in and a session comes out — or
 * nothing does.
 *
 * The security block runs against the real MockAuthService and the seeded vendor
 * account, because "the wrong code does not sign you in" is a claim about the
 * service and the screen together. A stub could be told to agree.
 *
 * These tests also pin what this screen must never do on failure: it must not
 * register, re-register, or regenerate a code. An authentication failure is a
 * failure, not the start of onboarding.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage, type PersistedSession } from '@/core/storage/SessionStorage';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { authReducer } from '@/features/auth/state/authSlice';
import { VendorLoginScreen } from '@/features/auth/screens/VendorLoginScreen';
import type { SessionPayload } from '@/features/auth/types';
import { MockAuthService } from '@/shared/services/mock/MockAuthService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService } from '@/shared/services/types/AuthService';
import { ToastProvider } from '@/shared/components';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = AUTH_COPY.vendorLogin;

/** The seeded, already-onboarded vendor from the mock data. */
const SEEDED_PHONE = '9000000001';
const SEEDED_CODE = 'FX-VENDOR-DEMO-CODE';
const TYPED_PHONE = '+91 90000-00001';
const NORMALISED_PHONE = '919000000001';

const VENDOR_SESSION: SessionPayload = {
  token: 'token_vendor',
  user: {
    id: 'usr_vendor_1',
    firstName: 'Ravi',
    lastName: 'Kumar',
    phone: SEEDED_PHONE,
    role: 'vendor',
  },
};

function stubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  const unexpected = (name: string) =>
    jest.fn(() => {
      throw new Error(`${name} must not be called from vendor sign in`);
    });

  return {
    signInVendor: jest.fn(async () => VENDOR_SESSION),
    registerVendor: unexpected('registerVendor'),
    requestVendorOtp: unexpected('requestVendorOtp'),
    verifyVendorOtp: unexpected('verifyVendorOtp'),
    verifyVendorAuthCode: unexpected('verifyVendorAuthCode'),
    regenerateVendorAuthCode: unexpected('regenerateVendorAuthCode'),
    requestCustomerOtp: unexpected('requestCustomerOtp'),
    verifyCustomerOtp: unexpected('verifyCustomerOtp'),
    signOut: unexpected('signOut'),
    ...overrides,
  } as AuthService;
}

function memoryStorage() {
  let value: PersistedSession | null = null;
  return {
    read: jest.fn(async () => value),
    write: jest.fn(async (session: PersistedSession) => {
      value = session;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
    peek: () => value,
  };
}

async function render(service: AuthService) {
  registerService('auth', service);

  const storage = memoryStorage();
  setSessionStorage(storage);

  const store = configureStore({ reducer: { auth: authReducer } });
  const navigate = jest.fn();
  const goBack = jest.fn();
  const setOptions = jest.fn();
  const addListener = jest.fn();
  const navigation = { navigate, goBack, setOptions, addListener } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <VendorLoginScreen navigation={navigation} route={{} as never} />
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });

  /** The editable input, not the ControlledInput wrapper sharing its testID. */
  const field = (testID: string) => {
    const matches = renderer.root.findAll(
      node => node.props.testID === testID && typeof node.props.onChangeText === 'function',
    );
    return matches[matches.length - 1];
  };

  const fill = async (testID: string, value: string) => {
    await act(async () => {
      field(testID).props.onChangeText(value);
    });
  };

  const press = async (accessibilityLabel: string) => {
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel }).props.onPress();
    });
  };

  const signInWith = async (phone: string, code: string) => {
    await fill('vendor-login-phone', phone);
    await fill('vendor-login-code', code);
    await press('Sign in');
  };

  return {
    renderer,
    store,
    storage,
    navigate,
    goBack,
    addListener,
    field,
    fill,
    press,
    signInWith,
    valueOf: (testID: string) => field(testID).props.value,
    submitButton: () => renderer.root.findByProps({ accessibilityLabel: 'Sign in' }).props,
    text: () => textOf(renderer.toJSON()),
  };
}

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

afterEach(() => {
  resetServices();
  jest.restoreAllMocks();
});

describe('VendorLoginScreen — the form', () => {
  it('asks for a phone number and an auth code', async () => {
    const { renderer, text } = await render(stubAuthService());

    expect(renderer.root.findByProps({ testID: 'vendor-login-phone' })).toBeDefined();
    expect(renderer.root.findByProps({ testID: 'vendor-login-code' })).toBeDefined();
    expect(text()).toContain('Vendor sign in');
  });

  it('carries the same mark and heading as the rest of authentication', async () => {
    const { renderer, text } = await render(stubAuthService());

    // The mark, not the word. The top bar carries the logo alone; "Fixora"
    // appears on this screen only inside "New to Fixora?", which is copy about
    // registering rather than branding, so the mark is what has to be checked.
    expect(renderer.root.findAllByProps({ testID: 'vendor-login-bar-mark' }).length)
      .toBeGreaterThan(0);
    expect(text()).toContain(AUTH_COPY.vendorLogin.title);
  });

  it('carries the safety note over the artwork, as text', async () => {
    const { renderer, text } = await render(stubAuthService());

    // The same foot as customer sign in. Rendered rather than drawn: the
    // supplied artwork had the sentence baked into its pixels, where it could
    // not be translated, could not grow with the OS font size, and could not be
    // read aloud.
    expect(renderer.root.findAllByProps({ testID: 'vendor-login-cityscape' }).length)
      .toBeGreaterThan(0);
    expect(text()).toContain(AUTH_COPY.common.safetyNote);
  });

  it('labels both fields and every action for assistive technology', async () => {
    const { renderer, field } = await render(stubAuthService());

    expect(field('vendor-login-phone').props.accessibilityLabel).toBe(COPY.phoneLabel);
    expect(field('vendor-login-code').props.accessibilityLabel).toBe(COPY.codeLabel);

    const submit = renderer.root.findByProps({ accessibilityLabel: COPY.submit }).props;
    expect(submit.accessibilityRole).toBe('button');
    expect(submit.accessibilityHint).toBe(COPY.submitHint);

    expect(
      renderer.root.findByProps({ accessibilityLabel: COPY.registerAction }).props
        .accessibilityRole,
    ).toBe('button');
  });

  it('masks the auth code as it is typed', async () => {
    const { field } = await render(stubAuthService());

    expect(field('vendor-login-code').props.secureTextEntry).toBe(true);
  });

  it('reveals and re-masks the code without altering what is submitted', async () => {
    const service = stubAuthService();
    const { field, fill, press } = await render(service);

    await fill('vendor-login-code', SEEDED_CODE);

    // Named, so it is reachable by a screen reader rather than announced as
    // an anonymous "button".
    await press(COPY.codeReveal);
    expect(field('vendor-login-code').props.secureTextEntry).toBe(false);
    expect(field('vendor-login-code').props.value).toBe(SEEDED_CODE);

    // The name follows the state, so it always describes what pressing does.
    await press(COPY.codeHide);
    expect(field('vendor-login-code').props.secureTextEntry).toBe(true);
    expect(field('vendor-login-code').props.value).toBe(SEEDED_CODE);

    // Revealing is presentation only: the credential reaches the service intact.
    expect(service.signInVendor).not.toHaveBeenCalled();
    await fill('vendor-login-phone', TYPED_PHONE);
    await press(COPY.submit);
    expect(service.signInVendor).toHaveBeenCalledWith(NORMALISED_PHONE, SEEDED_CODE);
  });

  it('never asks for a one-time code', async () => {
    const { text } = await render(stubAuthService());

    expect(text().toLowerCase()).not.toContain('verification code');
    expect(text().toLowerCase()).not.toContain('resend');
  });

  it('is not subject to the onboarding back guard', async () => {
    const { addListener, renderer } = await render(stubAuthService());

    // The guard works by intercepting `beforeRemove`. This screen registers no
    // such listener, so ordinary back navigation is unaffected.
    const guarded = addListener.mock.calls.some(([event]) => event === 'beforeRemove');
    expect(guarded).toBe(false);
    expect(renderer.root.findByProps({ testID: 'vendor-login-screen' })).toBeDefined();
  });
});

describe('VendorLoginScreen — validation', () => {
  it('requires both credentials before calling the service', async () => {
    const service = stubAuthService();
    const { press, text } = await render(service);

    await press('Sign in');

    expect(text()).toContain('Enter your phone number.');
    expect(text()).toContain('Enter your authentication code.');
    expect(service.signInVendor).not.toHaveBeenCalled();
  });

  it('rejects an implausible phone number', async () => {
    const service = stubAuthService();
    const { signInWith, text } = await render(service);

    await signInWith('12345', SEEDED_CODE);

    expect(text()).toContain('too short');
    expect(service.signInVendor).not.toHaveBeenCalled();
  });
});

describe('VendorLoginScreen — signing in', () => {
  it('sends the normalised phone and the code as typed', async () => {
    const service = stubAuthService();
    const { signInWith } = await render(service);

    await signInWith(TYPED_PHONE, SEEDED_CODE);

    expect(service.signInVendor).toHaveBeenCalledWith(NORMALISED_PHONE, SEEDED_CODE);
  });

  it('publishes the session through auth state, without navigating', async () => {
    const service = stubAuthService();
    const { signInWith, store, storage, navigate, goBack } = await render(service);

    await signInWith(TYPED_PHONE, SEEDED_CODE);

    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('vendor');
    expect(storage.peek()).toEqual(VENDOR_SESSION);

    // RootNavigator reacts to auth state; the screen must not route itself.
    expect(navigate).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
  });

  it('locks the button while the request is in flight', async () => {
    let release!: (session: SessionPayload) => void;
    const service = stubAuthService({
      signInVendor: jest.fn(
        () =>
          new Promise<SessionPayload>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { signInWith, press, submitButton } = await render(service);

    await signInWith(TYPED_PHONE, SEEDED_CODE);
    expect(submitButton().accessibilityState.busy).toBe(true);
    expect(submitButton().accessibilityState.disabled).toBe(true);

    // A second tap while unanswered must not reach the service.
    await press('Sign in');
    expect(service.signInVendor).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(VENDOR_SESSION);
    });
  });

  it('offers a new vendor the way to registration', async () => {
    const { press, navigate } = await render(stubAuthService());

    await press('Register your business');

    expect(navigate).toHaveBeenCalledWith('VendorRegistration');
  });
});

describe('VendorLoginScreen — failure', () => {
  it('shows the safe message and keeps both values', async () => {
    const failure = new AppError({
      kind: 'unauthorized',
      message: `no vendor for 919000000001 with code ${SEEDED_CODE}`,
      userMessage: 'Those sign-in details were not recognised.',
    });
    const service = stubAuthService({
      signInVendor: jest.fn(async () => {
        throw failure;
      }),
    });
    const { signInWith, text, valueOf, store } = await render(service);

    await signInWith(TYPED_PHONE, SEEDED_CODE);

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('no vendor for');
    expect(text()).not.toContain(SEEDED_CODE);

    // Correcting one character must not mean retyping both fields.
    expect(valueOf('vendor-login-phone')).toBe(TYPED_PHONE);
    expect(valueOf('vendor-login-code')).toBe(SEEDED_CODE);
    expect(store.getState().auth.status).not.toBe('authenticated');
  });

  it('says the details were not recognised, not that a session expired', async () => {
    const service = stubAuthService({
      signInVendor: jest.fn(async () => {
        throw new AppError({
          kind: 'unauthorized',
          message: 'credentials rejected',
          userMessage: 'Those sign-in details were not recognised.',
        });
      }),
    });
    const { signInWith, text } = await render(service);

    await signInWith(TYPED_PHONE, 'FX-WRON-GXXX');

    // The message carries itself, so the toast needs no heading to correct.
    expect(text()).toContain('Those sign-in details were not recognised.');
    // Nobody is signed in yet, so the global default for `unauthorized` would
    // claim something expired that never existed.
    expect(text()).not.toContain('Session expired');
  });

  it('says nothing about which credential was wrong', async () => {
    const service = stubAuthService({
      signInVendor: jest.fn(async () => {
        throw new AppError({
          kind: 'unauthorized',
          userMessage: 'Those sign-in details were not recognised.',
        });
      }),
    });
    const { signInWith, text } = await render(service);

    await signInWith(TYPED_PHONE, 'FX-WRON-GXXX');

    const shown = text().toLowerCase();
    // Naming either half would tell an attacker which vendors exist.
    expect(shown).not.toContain('not registered');
    expect(shown).not.toContain('no account');
    expect(shown).not.toContain('wrong code');
    expect(shown).not.toContain('incorrect code');
  });

  it('does not register, re-register or regenerate anything', async () => {
    const service = stubAuthService({
      signInVendor: jest.fn(async () => {
        throw new AppError({ kind: 'unauthorized' });
      }),
    });
    const { signInWith, navigate, storage } = await render(service);

    await signInWith(TYPED_PHONE, 'FX-WRON-GXXX');

    expect(service.registerVendor).not.toHaveBeenCalled();
    expect(service.regenerateVendorAuthCode).not.toHaveBeenCalled();
    expect(service.verifyVendorOtp).not.toHaveBeenCalled();
    expect(service.requestVendorOtp).not.toHaveBeenCalled();

    // And the vendor is not pushed into onboarding.
    expect(navigate).not.toHaveBeenCalled();
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('allows a retry once the credentials are corrected', async () => {
    const service = stubAuthService({
      signInVendor: jest
        .fn()
        .mockRejectedValueOnce(new AppError({ kind: 'unauthorized' }))
        .mockResolvedValueOnce(VENDOR_SESSION),
    });
    const { signInWith, fill, press, store } = await render(service);

    await signInWith(TYPED_PHONE, 'FX-WRON-GXXX');
    expect(store.getState().auth.status).not.toBe('authenticated');

    await fill('vendor-login-code', SEEDED_CODE);
    await press('Sign in');

    expect(store.getState().auth.status).toBe('authenticated');
  });
});

describe('VendorLoginScreen — credentials do not leak', () => {
  it('writes neither the phone nor the code to logs', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    const service = stubAuthService({
      signInVendor: jest
        .fn()
        .mockRejectedValueOnce(new AppError({ kind: 'unauthorized', message: 'rejected' }))
        .mockResolvedValueOnce(VENDOR_SESSION),
    });
    const { signInWith, press } = await render(service);

    await signInWith(TYPED_PHONE, SEEDED_CODE);
    await press('Sign in');

    const logged = spies
      .flatMap(spy => spy.mock.calls)
      .flat()
      .map(entry => JSON.stringify(entry))
      .join(' ');

    expect(logged).not.toContain(SEEDED_CODE);
    expect(logged).not.toContain(NORMALISED_PHONE);
  });

  it('keeps the code out of Redux, storage and navigation', async () => {
    const { signInWith, store, storage, navigate } = await render(stubAuthService());

    await signInWith(TYPED_PHONE, SEEDED_CODE);

    expect(JSON.stringify(store.getState())).not.toContain(SEEDED_CODE);
    expect(JSON.stringify(storage.peek())).not.toContain(SEEDED_CODE);
    expect(JSON.stringify(navigate.mock.calls)).not.toContain(SEEDED_CODE);
  });
});

/**
 * Against the real service and the seeded vendor, so the accept/reject decision
 * is the mock's rather than a stub's.
 */
describe('VendorLoginScreen — against the real mock service', () => {
  it('signs in the seeded vendor with their saved code', async () => {
    const { signInWith, store } = await render(new MockAuthService({ latency: NO_LATENCY }));

    await signInWith(SEEDED_PHONE, SEEDED_CODE);

    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('vendor');
  });

  it('refuses a wrong code, and says nothing about which part was wrong', async () => {
    const { signInWith, store, text } = await render(new MockAuthService({ latency: NO_LATENCY }));

    await signInWith(SEEDED_PHONE, 'FX-WRON-GXXX');

    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(text()).toContain('not recognised');
  });

  it('fails identically for an unknown number, so vendors cannot be enumerated', async () => {
    const unknown = await render(new MockAuthService({ latency: NO_LATENCY }));
    await unknown.signInWith('9111111111', SEEDED_CODE);
    const unknownMessage = unknown.text();

    resetServices();

    const wrongCode = await render(new MockAuthService({ latency: NO_LATENCY }));
    await wrongCode.signInWith(SEEDED_PHONE, 'FX-WRON-GXXX');

    expect(unknownMessage).toContain('not recognised');
    expect(wrongCode.text()).toContain('not recognised');
    expect(unknown.store.getState().auth.status).not.toBe('authenticated');
  });
});
