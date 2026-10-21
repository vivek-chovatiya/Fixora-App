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
 *
 * Since 21/10/2026 the code is six digits and a returning vendor on the same
 * device types only that: the number they signed in with is remembered. Every
 * render gets its own remembered-vendor store, so one test's sign in can never
 * decide which face of the screen the next test sees.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import {
  getKeyValueStorage,
  setKeyValueStorage,
  type KeyValueStorage,
} from '@/core/storage/KeyValueStorage';
import { setSessionStorage, type PersistedSession } from '@/core/storage/SessionStorage';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { authReducer } from '@/features/auth/state/authSlice';
import { signOut } from '@/features/auth/state/authThunks';
import {
  DeviceRememberedVendorStorage,
  setRememberedVendorStorage,
  type RememberedVendorStorage,
} from '@/features/auth/state/rememberedVendorStorage';
import { VENDOR_AUTH_CODE_INPUT_MAX_LENGTH } from '@/features/auth/validation/authSchemas';
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
const SEEDED_CODE = '482913';
/** Six digits that are not the seeded vendor's code. */
const WRONG_CODE = '111111';
const TYPED_PHONE = '+91 90000-00001';
const NORMALISED_PHONE = '919000000001';
/** How "9000000001" is shown and spoken once it is remembered. */
const MASKED_PHONE = '••••••0001';
const SPOKEN_PHONE = 'Phone number ending 0 0 0 1';

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

/**
 * A remembered-vendor store holding `phone`, recording everything it is handed.
 */
function memoryRemembered(phone: string | null = null) {
  let value = phone;
  const given: unknown[] = [];
  const storage = {
    read: jest.fn(async () => value),
    remember: jest.fn(async (next: string) => {
      given.push(next);
      value = next;
      return true;
    }),
    forget: jest.fn(async () => {
      value = null;
    }),
  };
  return { storage, given, peek: () => value };
}

/** An in-memory device under the real remembered-vendor module, recording every write. */
function memoryDevice() {
  const store = new Map<string, string>();
  const written: unknown[] = [];
  const device: KeyValueStorage = {
    getItem: async key => store.get(key) ?? null,
    setItem: async (key, value) => {
      written.push([key, value]);
      store.set(key, value);
    },
    removeItem: async key => {
      written.push(['remove', key]);
      store.delete(key);
    },
  };
  return { device, store, written };
}

async function render(
  service: AuthService,
  options: { remembered?: RememberedVendorStorage; storage?: ReturnType<typeof memoryStorage> } = {},
) {
  registerService('auth', service);

  const remembered = memoryRemembered();
  setRememberedVendorStorage(options.remembered ?? remembered.storage);

  const storage = options.storage ?? memoryStorage();
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
  mounted.push(renderer);

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

  /** Signs in with the code alone, as a remembered vendor does. */
  const signInWithCode = async (code: string) => {
    await fill('vendor-login-code', code);
    await press('Sign in');
  };

  /** The validation message under a field, read off the field it describes. */
  const fieldError = (testID: string) => field(testID)?.props.accessibilityHint;

  return {
    renderer,
    store,
    storage,
    remembered,
    navigate,
    goBack,
    addListener,
    field,
    fill,
    press,
    signInWith,
    signInWithCode,
    fieldError,
    hasField: (testID: string) => field(testID) !== undefined,
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

/**
 * Every screen a test rendered, unmounted after it.
 *
 * Found tracing jest's "A worker process has failed to exit gracefully": a test
 * that raised a toast left its dismiss timer running in a tree nobody
 * unmounted, so the file's last tests were followed by renders after jest had
 * torn the environment down and a worker that could not exit on time.
 * Unmounting runs the cleanup `ToastProvider` already has.
 */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

const originalDevice = getKeyValueStorage();

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
  setKeyValueStorage(originalDevice);
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

  it('takes the code on a number pad, with room for one pasted in groups', async () => {
    const { field } = await render(stubAuthService());
    const props = field('vendor-login-code').props;

    expect(props.keyboardType).toBe('number-pad');
    expect(props.maxLength).toBe(VENDOR_AUTH_CODE_INPUT_MAX_LENGTH);
    // The widest grouping a person is likely to paste still fits whole, so a
    // wrong paste is refused with a reason instead of being cut short.
    expect(props.maxLength).toBeGreaterThanOrEqual('4 8 2 9 1 3'.length);
    // Codes are digits now; nothing should be capitalising them.
    expect(props.autoCapitalize).toBe('none');
  });

  it('keeps the code out of autofill, so it is not offered for saving as a password', async () => {
    const { field } = await render(stubAuthService());
    const props = field('vendor-login-code').props;

    expect(props.autoComplete).toBe('off');
    expect(props.importantForAutofill).toBe('no');
  });

  it('says how long the code is', async () => {
    const { text } = await render(stubAuthService());

    expect(text()).toContain(
      'The 6-digit code you saved when you registered your business.',
    );
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

  it.each([
    ['five digits', '48291', 'Your authentication code is 6 digits.'],
    ['seven digits', '4829134', 'Your authentication code is 6 digits.'],
    ['a letter', '48291a', 'Your authentication code is numbers only.'],
    ['the old code format', 'FX-ABCD-2345', 'Your authentication code is numbers only.'],
  ])('refuses %s beside the field, without calling the service', async (_label, typed, message) => {
    const service = stubAuthService();
    const { signInWith, text, fieldError, valueOf } = await render(service);

    await signInWith(TYPED_PHONE, typed);

    expect(text()).toContain(message);
    // On the field, so a screen reader announces it with the field.
    expect(fieldError('vendor-login-code')).toBe(message);
    // And what was typed is left to be corrected.
    expect(valueOf('vendor-login-code')).toBe(typed);
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

  it.each([
    ['in groups, as it was shown', '482 913'],
    ['with a hyphen', '482-913'],
    ['with a leading zero', '048213'],
  ])('sends a code typed %s as its bare digits', async (_label, typed) => {
    const service = stubAuthService();
    const { signInWith } = await render(service);

    await signInWith(TYPED_PHONE, typed);

    expect(service.signInVendor).toHaveBeenCalledWith(
      NORMALISED_PHONE,
      typed.replace(/\D/g, ''),
    );
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

    // A refusal reads as the app's sentence — one that allows for a code an
    // administrator has changed — whatever words the service chose.
    expect(text()).toContain(COPY.detailsRefused);
    expect(text()).not.toContain('no vendor for');
    expect(text()).not.toContain(SEEDED_CODE);

    // Correcting one character must not mean retyping both fields.
    expect(valueOf('vendor-login-phone')).toBe(TYPED_PHONE);
    expect(valueOf('vendor-login-code')).toBe(SEEDED_CODE);
    expect(store.getState().auth.status).not.toBe('authenticated');
  });

  it('answers a refusal in its own words, never "your session has expired"', async () => {
    // No userMessage: what a real backend's bare 401 becomes. The default copy
    // for `unauthorized` is about a session, and nobody has one yet.
    const service = stubAuthService({
      signInVendor: jest.fn(async () => {
        throw new AppError({ kind: 'unauthorized', message: 'credentials rejected' });
      }),
    });
    const { signInWith, text } = await render(service);

    await signInWith(TYPED_PHONE, WRONG_CODE);

    expect(text()).toContain(COPY.detailsRefused);
    expect(text().toLowerCase()).not.toContain('session');
    expect(text()).not.toContain(WRONG_CODE);
  });

  it('passes on what the service said when the failure is not a refusal', async () => {
    const service = stubAuthService({
      signInVendor: jest.fn(async () => {
        throw new AppError({ kind: 'network' });
      }),
    });
    const { signInWith, text } = await render(service);

    await signInWith(TYPED_PHONE, SEEDED_CODE);

    // A dropped connection is not a wrong code, and saying so would send the
    // vendor hunting for a mistake they did not make.
    expect(text()).toContain('No internet connection');
    expect(text()).not.toContain(COPY.detailsRefused);
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

    await signInWith(TYPED_PHONE, WRONG_CODE);

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

    await signInWith(TYPED_PHONE, WRONG_CODE);

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

    await signInWith(TYPED_PHONE, WRONG_CODE);
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
    const { signInWith, store, storage, remembered, navigate } = await render(stubAuthService());

    await signInWith(TYPED_PHONE, SEEDED_CODE);

    expect(JSON.stringify(store.getState())).not.toContain(SEEDED_CODE);
    expect(JSON.stringify(storage.peek())).not.toContain(SEEDED_CODE);
    expect(JSON.stringify(navigate.mock.calls)).not.toContain(SEEDED_CODE);
    // The device remembers the phone this sign in used, and only that.
    expect(remembered.given).toEqual([NORMALISED_PHONE]);
  });
});

/**
 * The second visit: a vendor who has signed in on this device before types only
 * their code (owner's instruction, 21/10/2026).
 */
describe('VendorLoginScreen — a returning vendor on the same device', () => {
  async function renderRemembered(service: AuthService = stubAuthService(), phone = SEEDED_PHONE) {
    const remembered = memoryRemembered(phone);
    const harness = await render(service, { remembered: remembered.storage });
    return { ...harness, remembered };
  }

  it('asks a first-time vendor for their phone number as well', async () => {
    const { hasField, text } = await render(stubAuthService());

    expect(hasField('vendor-login-phone')).toBe(true);
    expect(hasField('vendor-login-code')).toBe(true);
    expect(text()).toContain(COPY.title);
    expect(text()).not.toContain(COPY.welcomeTitle);
    expect(text()).not.toContain(COPY.useDifferentNumber);
  });

  it('welcomes them back and asks for the code alone', async () => {
    const { hasField, text, renderer } = await renderRemembered();

    expect(text()).toContain(COPY.welcomeTitle);
    expect(hasField('vendor-login-phone')).toBe(false);
    expect(hasField('vendor-login-code')).toBe(true);
    expect(renderer.root.findAllByProps({ accessibilityLabel: COPY.submit }).length)
      .toBeGreaterThan(0);
    expect(text()).toContain(COPY.useDifferentNumber);
    // Registration belongs to the full form, one tap away.
    expect(text()).not.toContain(COPY.registerAction);
  });

  it('shows which number, masked, and never the number itself', async () => {
    const { text, renderer } = await renderRemembered();

    expect(text()).toContain(MASKED_PHONE);
    expect(text()).not.toContain(SEEDED_PHONE);
    expect(JSON.stringify(renderer.toJSON())).not.toContain(SEEDED_PHONE);
  });

  it('speaks the number as its last four digits, one at a time', async () => {
    const { renderer } = await renderRemembered();

    const spoken = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props.accessibilityLabel === SPOKEN_PHONE,
    );
    expect(spoken).toHaveLength(1);
    // One element, not the icon and the bullets read separately.
    expect(spoken[0].props.accessible).toBe(true);
  });

  it('signs in with the remembered number and the code typed', async () => {
    const service = stubAuthService();
    const { signInWithCode, store } = await renderRemembered(service);

    await signInWithCode('482 913');

    expect(service.signInVendor).toHaveBeenCalledWith(SEEDED_PHONE, SEEDED_CODE);
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('checks the code alone, so a short one is refused beside it', async () => {
    const service = stubAuthService();
    const { signInWithCode, fieldError } = await renderRemembered(service);

    await signInWithCode('48291');

    expect(fieldError('vendor-login-code')).toBe('Your authentication code is 6 digits.');
    expect(service.signInVendor).not.toHaveBeenCalled();
  });

  it('keeps the number and the code when the code is refused, and allows for a changed code', async () => {
    const service = stubAuthService({
      signInVendor: jest.fn(async () => {
        throw new AppError({ kind: 'unauthorized', userMessage: 'Not recognised.' });
      }),
    });
    const { signInWithCode, text, valueOf, remembered, hasField } = await renderRemembered(service);

    await signInWithCode(WRONG_CODE);

    expect(text()).toContain(COPY.codeRefused);
    expect(text()).not.toContain(WRONG_CODE);
    expect(valueOf('vendor-login-code')).toBe(WRONG_CODE);
    // A refusal cannot say the account is gone — unknown numbers and wrong
    // codes are refused alike — so the number stays.
    expect(hasField('vendor-login-phone')).toBe(false);
    expect(remembered.storage.forget).not.toHaveBeenCalled();
    expect(remembered.peek()).toBe(SEEDED_PHONE);
  });

  it('"Use a different number" forgets it and brings the phone field back', async () => {
    const service = stubAuthService();
    const { press, hasField, valueOf, text, remembered, fill } = await renderRemembered(service);
    await fill('vendor-login-code', SEEDED_CODE);

    await press(COPY.useDifferentNumber);

    expect(remembered.storage.forget).toHaveBeenCalledTimes(1);
    expect(remembered.peek()).toBeNull();
    expect(hasField('vendor-login-phone')).toBe(true);
    expect(valueOf('vendor-login-phone')).toBe('');
    expect(text()).toContain(COPY.title);
    expect(text()).toContain(COPY.registerAction);
    expect(text()).not.toContain(MASKED_PHONE);
    // The code typed is not thrown away.
    expect(valueOf('vendor-login-code')).toBe(SEEDED_CODE);

    // And the next sign in uses the number typed now, not the forgotten one.
    await fill('vendor-login-phone', '9000000002');
    await press(COPY.submit);
    expect(service.signInVendor).toHaveBeenCalledWith('9000000002', SEEDED_CODE);
  });

  it('asks for a number again rather than signing in with the forgotten one', async () => {
    const service = stubAuthService();
    const { press, text, fill } = await renderRemembered(service);

    await press(COPY.useDifferentNumber);
    await fill('vendor-login-code', SEEDED_CODE);
    await press(COPY.submit);

    expect(text()).toContain('Enter your phone number.');
    expect(service.signInVendor).not.toHaveBeenCalled();
  });

  it('does not repeat a refusal when the vendor then switches number', async () => {
    const service = stubAuthService({
      signInVendor: jest.fn(async () => {
        throw new AppError({ kind: 'unauthorized' });
      }),
    });
    const { signInWithCode, press, text } = await renderRemembered(service);

    await signInWithCode(WRONG_CODE);
    expect(text()).toContain(COPY.codeRefused);

    await press(COPY.useDifferentNumber);

    // Still the one failure, in the words it was first given.
    expect(text()).toContain(COPY.codeRefused);
    expect(text()).not.toContain(COPY.detailsRefused);
  });

  it('labels the way out for assistive technology and locks it during a sign in', async () => {
    let release!: (session: SessionPayload) => void;
    const service = stubAuthService({
      signInVendor: jest.fn(
        () =>
          new Promise<SessionPayload>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { renderer, signInWithCode, press, remembered } = await renderRemembered(service);
    const different = () =>
      renderer.root.findByProps({ accessibilityLabel: COPY.useDifferentNumber }).props;

    expect(different().accessibilityRole).toBe('button');
    expect(different().accessibilityHint).toBe(COPY.useDifferentNumberHint);

    await signInWithCode(SEEDED_CODE);
    expect(different().accessibilityState.disabled).toBe(true);
    await press(COPY.useDifferentNumber);
    expect(remembered.storage.forget).not.toHaveBeenCalled();

    await act(async () => {
      release(VENDOR_SESSION);
    });
  });

  it('shows the full form when the remembered number cannot be read', async () => {
    const failing: RememberedVendorStorage = {
      read: jest.fn(async () => {
        throw new Error('device unavailable');
      }),
      remember: jest.fn(async () => true),
      forget: jest.fn(async () => undefined),
    };
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const service = stubAuthService();
    const { hasField, signInWith, store } = await render(service, { remembered: failing });

    expect(hasField('vendor-login-phone')).toBe(true);

    await signInWith(TYPED_PHONE, SEEDED_CODE);
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('draws no form until the device has answered', async () => {
    let answer!: (phone: string | null) => void;
    const slow: RememberedVendorStorage = {
      read: jest.fn(
        () =>
          new Promise<string | null>(resolve => {
            answer = resolve;
          }),
      ),
      remember: jest.fn(async () => true),
      forget: jest.fn(async () => undefined),
    };
    const { hasField, text } = await render(stubAuthService(), { remembered: slow });

    // Neither face yet: drawing the phone field and swapping it away a moment
    // later would move the form under the vendor's thumb.
    expect(hasField('vendor-login-phone')).toBe(false);
    expect(hasField('vendor-login-code')).toBe(false);
    expect(text()).not.toContain(COPY.title);

    await act(async () => {
      answer(SEEDED_PHONE);
    });

    expect(text()).toContain(COPY.welcomeTitle);
    expect(hasField('vendor-login-code')).toBe(true);
  });
});

/**
 * The whole loop against the real mock service and the real remembered-vendor
 * module, over an in-memory device that records every write: sign in with both,
 * sign out, come back to the code alone — and the code never reaches the device.
 */
describe('VendorLoginScreen — remembered across a sign out', () => {
  it('asks only for the code the second time, and never stores it', async () => {
    const { device, written } = memoryDevice();
    setKeyValueStorage(device);
    const service = new MockAuthService({ latency: NO_LATENCY });
    const storage = memoryStorage();

    const first = await render(service, {
      remembered: new DeviceRememberedVendorStorage(),
      storage,
    });
    expect(first.hasField('vendor-login-phone')).toBe(true);
    await first.signInWith(SEEDED_PHONE, '482-913');
    expect(first.store.getState().auth.status).toBe('authenticated');

    await signOut(first.store.dispatch);
    expect(first.store.getState().auth.status).toBe('unauthenticated');

    const second = await render(service, {
      remembered: new DeviceRememberedVendorStorage(),
      storage,
    });
    expect(second.text()).toContain(COPY.welcomeTitle);
    expect(second.text()).toContain(MASKED_PHONE);
    expect(second.hasField('vendor-login-phone')).toBe(false);

    await second.signInWithCode(SEEDED_CODE);
    expect(second.store.getState().auth.status).toBe('authenticated');
    expect(second.store.getState().auth.user?.id).toBe('usr_vendor_1');

    // Everything the device was ever handed, searched for the code.
    expect(written.length).toBeGreaterThan(0);
    expect(JSON.stringify(written)).toContain(SEEDED_PHONE);
    expect(JSON.stringify(written)).not.toContain(SEEDED_CODE);
    expect(JSON.stringify(written)).not.toContain('482-913');
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

    await signInWith(SEEDED_PHONE, WRONG_CODE);

    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(text()).toContain(COPY.detailsRefused);
  });

  it('accepts the code typed in groups, as it was shown at registration', async () => {
    const service = new MockAuthService({ latency: NO_LATENCY });
    const { signInWith, store } = await render(service);

    await signInWith(SEEDED_PHONE, '482 913');

    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('fails identically for an unknown number, so vendors cannot be enumerated', async () => {
    const unknown = await render(new MockAuthService({ latency: NO_LATENCY }));
    await unknown.signInWith('9111111111', SEEDED_CODE);
    const unknownMessage = unknown.text();

    resetServices();

    const wrongCode = await render(new MockAuthService({ latency: NO_LATENCY }));
    await wrongCode.signInWith(SEEDED_PHONE, WRONG_CODE);

    expect(unknownMessage).toContain(COPY.detailsRefused);
    expect(wrongCode.text()).toContain(COPY.detailsRefused);
    expect(unknown.store.getState().auth.status).not.toBe('authenticated');
  });
});
