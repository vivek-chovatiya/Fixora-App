/**
 * Returning-vendor sign in, step one: a phone number goes in and a one-time
 * code is asked for — nothing else (owner decision 28/11/2026,
 * phase5-contract.md section 1.1; the permanent vendor auth code is gone).
 *
 * The mistakes these tests guard against:
 * - a code field, or any auth-code copy, surviving on this screen;
 * - this screen signing anybody in, registering, or reaching any service method
 *   but `requestVendorSignInOtp` — every other method on the stub throws, and
 *   the retired ones (`signInVendor`, `verifyVendorAuthCode`,
 *   `regenerateVendorAuthCode`) are planted on it to prove nothing still calls
 *   them;
 * - the request being sent anything but the normalised digits, or the code
 *   screen being handed anything but the number and the challenge;
 * - a failure losing the typed number, moving on anyway, or showing anything
 *   but the service's `userMessage`;
 * - the request telling a vendor number from any other (it answers alike, so
 *   the screen must move on alike — checked against the real mock service).
 *
 * The remembered-number face (PROJECT_BIBLE.md section 7A.2, amended
 * 21/10/2026) is kept: a vendor who signed in on this device before sees
 * "Welcome back", the number masked, and "Send code". Every render gets its own
 * remembered-vendor store, so one test can never decide which face the next
 * test sees.
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
import { signInVendor, signOut } from '@/features/auth/state/authThunks';
import {
  DeviceRememberedVendorStorage,
  setRememberedVendorStorage,
  type RememberedVendorStorage,
} from '@/features/auth/state/rememberedVendorStorage';
import { VendorLoginScreen } from '@/features/auth/screens/VendorLoginScreen';
import { MockAuthService } from '@/shared/services/mock/MockAuthService';
import { MOCK_OTP_CODE } from '@/shared/services/mock/mockAuthData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService, OtpChallenge } from '@/shared/services/types/AuthService';
import { Toast, ToastProvider } from '@/shared/components';
import { duration, ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = AUTH_COPY.vendorLogin;

/** The seeded, already-onboarded vendor from the mock data. */
const SEEDED_PHONE = '9000000001';
const TYPED_PHONE = '+91 90000-00001';
const NORMALISED_PHONE = '919000000001';
/** How "9000000001" is shown and spoken once it is remembered. */
const MASKED_PHONE = '••••••0001';
const SPOKEN_PHONE = 'Phone number ending 0 0 0 1';

const CHALLENGE: OtpChallenge = {
  maskedDestination: MASKED_PHONE,
  expiresAt: '2026-11-28T10:05:00.000Z',
  resendAfterSeconds: 30,
  deliveryChannel: 'NONE',
};

/** The methods that left with the auth code. Planted on the stub so a caller that still reaches one fails. */
const RETIRED_METHODS = ['signInVendor', 'verifyVendorAuthCode', 'regenerateVendorAuthCode'] as const;

type StubbedAuthService = AuthService & Record<(typeof RETIRED_METHODS)[number], jest.Mock>;

function stubAuthService(overrides: Partial<AuthService> = {}): StubbedAuthService {
  const unexpected = (name: string) =>
    jest.fn(() => {
      throw new Error(`${name} must not be called from vendor sign in`);
    });

  return {
    requestVendorSignInOtp: jest.fn(async () => CHALLENGE),
    verifyVendorSignInOtp: unexpected('verifyVendorSignInOtp'),
    registerVendor: unexpected('registerVendor'),
    requestVendorOtp: unexpected('requestVendorOtp'),
    verifyVendorOtp: unexpected('verifyVendorOtp'),
    requestCustomerOtp: unexpected('requestCustomerOtp'),
    verifyCustomerOtp: unexpected('verifyCustomerOtp'),
    signOut: unexpected('signOut'),
    signInVendor: unexpected('signInVendor'),
    verifyVendorAuthCode: unexpected('verifyVendorAuthCode'),
    regenerateVendorAuthCode: unexpected('regenerateVendorAuthCode'),
    ...overrides,
  } as StubbedAuthService;
}

/** Every method on the stub except the one this screen may call. */
function untouchable(service: StubbedAuthService): jest.Mock[] {
  return (
    [
      'verifyVendorSignInOtp',
      'registerVendor',
      'requestVendorOtp',
      'verifyVendorOtp',
      'requestCustomerOtp',
      'verifyCustomerOtp',
      'signOut',
      ...RETIRED_METHODS,
    ] as const
  ).map(name => (service as unknown as Record<string, jest.Mock>)[name]);
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

/** A remembered-vendor store holding `phone`, recording everything it is handed. */
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

  const requestCodeFor = async (phone: string) => {
    await fill('vendor-login-phone', phone);
    await press(COPY.submit);
  };

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
    requestCodeFor,
    fieldError: (testID: string) => field(testID)?.props.accessibilityHint,
    hasField: (testID: string) => field(testID) !== undefined,
    /** Any node at all carrying the testID — wrapper or input. */
    hasNode: (testID: string) =>
      renderer.root.findAll(node => node.props.testID === testID).length > 0,
    valueOf: (testID: string) => field(testID).props.value,
    submitButton: () => renderer.root.findByProps({ accessibilityLabel: COPY.submit }).props,
    isToastShowing: () => renderer.root.findAllByType(Toast).some(node => node.props.isVisible),
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
 * unmounted. Unmounting runs the cleanup `ToastProvider` already has.
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
  it('asks for a phone number, and for nothing else', async () => {
    const { hasField, hasNode, renderer, text } = await render(stubAuthService());

    expect(hasField('vendor-login-phone')).toBe(true);
    expect(text()).toContain(COPY.title);

    // The auth code is gone: no field for it, no masked input, no reveal
    // toggle, and no sentence about it.
    expect(hasNode('vendor-login-code')).toBe(false);
    expect(renderer.root.findAll(node => node.props.secureTextEntry === true)).toHaveLength(0);
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Show authentication code' }))
      .toHaveLength(0);
    expect(text().toLowerCase()).not.toContain('authentication code');
    expect(text().toLowerCase()).not.toContain('auth code');
  });

  it('carries the same mark and heading as the rest of authentication', async () => {
    const { renderer, text } = await render(stubAuthService());

    expect(renderer.root.findAllByProps({ testID: 'vendor-login-bar-mark' }).length)
      .toBeGreaterThan(0);
    expect(text()).toContain(COPY.title);
    expect(text()).toContain(COPY.subtitle);
  });

  it('carries the safety note over the artwork, as text', async () => {
    const { renderer, text } = await render(stubAuthService());

    expect(renderer.root.findAllByProps({ testID: 'vendor-login-cityscape' }).length)
      .toBeGreaterThan(0);
    expect(text()).toContain(AUTH_COPY.common.safetyNote);
  });

  it('labels the field and every action for assistive technology', async () => {
    const { renderer, field } = await render(stubAuthService());

    expect(field('vendor-login-phone').props.accessibilityLabel).toBe(COPY.phoneLabel);

    const submit = renderer.root.findByProps({ accessibilityLabel: COPY.submit }).props;
    expect(submit.accessibilityRole).toBe('button');
    expect(submit.accessibilityHint).toBe(COPY.submitHint);

    expect(
      renderer.root.findByProps({ accessibilityLabel: COPY.registerAction }).props
        .accessibilityRole,
    ).toBe('button');
  });

  it('sends from the keyboard as well as the button', async () => {
    const service = stubAuthService();
    const { field, fill } = await render(service);

    await fill('vendor-login-phone', TYPED_PHONE);
    expect(field('vendor-login-phone').props.returnKeyType).toBe('send');
    await act(async () => {
      field('vendor-login-phone').props.onSubmitEditing();
    });

    expect(service.requestVendorSignInOtp).toHaveBeenCalledWith(NORMALISED_PHONE);
  });

  it('is not subject to any back guard', async () => {
    const { addListener } = await render(stubAuthService());

    const guarded = addListener.mock.calls.some(([event]) => event === 'beforeRemove');
    expect(guarded).toBe(false);
  });
});

describe('VendorLoginScreen — validation', () => {
  it('requires a phone number before calling the service', async () => {
    const service = stubAuthService();
    const { press, text } = await render(service);

    await press(COPY.submit);

    expect(text()).toContain('Enter your phone number.');
    expect(service.requestVendorSignInOtp).not.toHaveBeenCalled();
  });

  it('rejects an implausible phone number beside the field', async () => {
    const service = stubAuthService();
    const { requestCodeFor, text, valueOf } = await render(service);

    await requestCodeFor('12345');

    expect(text()).toContain('too short');
    expect(valueOf('vendor-login-phone')).toBe('12345');
    expect(service.requestVendorSignInOtp).not.toHaveBeenCalled();
  });
});

describe('VendorLoginScreen — asking for a code', () => {
  it('sends the normalised digits and nothing else', async () => {
    const service = stubAuthService();
    const { requestCodeFor } = await render(service);

    await requestCodeFor(TYPED_PHONE);

    expect(service.requestVendorSignInOtp).toHaveBeenCalledTimes(1);
    expect(jest.mocked(service.requestVendorSignInOtp).mock.calls[0]).toEqual([NORMALISED_PHONE]);
  });

  it('moves on to the code screen with the number and the challenge, and only those', async () => {
    const service = stubAuthService();
    const { requestCodeFor, navigate } = await render(service);

    await requestCodeFor(TYPED_PHONE);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('VendorSignInOtp', {
      phone: NORMALISED_PHONE,
      challenge: CHALLENGE,
    });
    const [, params] = navigate.mock.calls[0];
    expect(Object.keys(params).sort()).toEqual(['challenge', 'phone']);
    // The channel travels inside the challenge, untouched.
    expect(params.challenge.deliveryChannel).toBe('NONE');
  });

  it('signs nobody in and remembers nothing — asking for a code proves nothing', async () => {
    const service = stubAuthService();
    const { requestCodeFor, store, storage, remembered } = await render(service);

    await requestCodeFor(TYPED_PHONE);

    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(storage.write).not.toHaveBeenCalled();
    // The number is remembered by the thunk once a session exists, never here.
    expect(remembered.given).toEqual([]);
  });

  it('reaches no other service method, and none of the retired auth-code ones', async () => {
    const service = stubAuthService();
    const { requestCodeFor } = await render(service);

    await requestCodeFor(TYPED_PHONE);

    for (const method of untouchable(service)) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it('locks the button and the field while the request is in flight', async () => {
    let release!: (challenge: OtpChallenge) => void;
    const service = stubAuthService({
      requestVendorSignInOtp: jest.fn(
        () =>
          new Promise<OtpChallenge>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { requestCodeFor, press, submitButton, field } = await render(service);

    await requestCodeFor(TYPED_PHONE);
    expect(submitButton().accessibilityState.busy).toBe(true);
    expect(submitButton().accessibilityState.disabled).toBe(true);
    expect(field('vendor-login-phone').props.editable).toBe(false);

    // A second tap while unanswered must not reach the service.
    await press(COPY.submit);
    expect(service.requestVendorSignInOtp).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(CHALLENGE);
    });
  });

  it('offers a new vendor the way to registration', async () => {
    const { press, navigate } = await render(stubAuthService());

    await press(COPY.registerAction);

    expect(navigate).toHaveBeenCalledWith('VendorRegistration');
  });
});

describe('VendorLoginScreen — failure', () => {
  it.each([
    [
      'a rate limit',
      new AppError({ kind: 'unknown', code: 'RATE_LIMITED', statusCode: 429, message: 'limit for 919000000001' }),
      'Too many attempts. Please wait a little and try again.',
    ],
    [
      'a code that could not be sent',
      new AppError({ kind: 'server', code: 'OTP_DELIVERY_FAILED', statusCode: 503, message: 'provider said no for 919000000001' }),
      'We could not send your code just now. Please try again.',
    ],
    [
      'a dropped connection',
      new AppError({ kind: 'network', message: 'socket hang up' }),
      'No internet connection. Check your network and try again.',
    ],
  ])('shows the service’s sentence for %s, keeps the number and stays', async (_case, failure, shown) => {
    const service = stubAuthService({
      requestVendorSignInOtp: jest.fn(async () => {
        throw failure;
      }),
    });
    const { requestCodeFor, text, valueOf, navigate, isToastShowing } = await render(service);

    await requestCodeFor(TYPED_PHONE);

    expect(isToastShowing()).toBe(true);
    expect(text()).toContain(shown);
    // `message` is developer detail and never reaches the screen.
    expect(text()).not.toContain(failure.message);
    // Correcting nothing must not mean retyping the number.
    expect(valueOf('vendor-login-phone')).toBe(TYPED_PHONE);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows a retry with one tap once the failure has passed', async () => {
    const service = stubAuthService({
      requestVendorSignInOtp: jest
        .fn()
        .mockRejectedValueOnce(new AppError({ kind: 'server', code: 'OTP_DELIVERY_FAILED' }))
        .mockResolvedValueOnce(CHALLENGE),
    });
    const { requestCodeFor, press, navigate } = await render(service);

    await requestCodeFor(TYPED_PHONE);
    expect(navigate).not.toHaveBeenCalled();

    await press(COPY.submit);

    expect(service.requestVendorSignInOtp).toHaveBeenCalledTimes(2);
    expect(jest.mocked(service.requestVendorSignInOtp).mock.calls[1]).toEqual([NORMALISED_PHONE]);
    expect(navigate).toHaveBeenCalledWith('VendorSignInOtp', {
      phone: NORMALISED_PHONE,
      challenge: CHALLENGE,
    });
  });

  it('does not register, verify or reach any retired method after a failure', async () => {
    const service = stubAuthService({
      requestVendorSignInOtp: jest.fn(async () => {
        throw new AppError({ kind: 'unknown', code: 'RATE_LIMITED' });
      }),
    });
    const { requestCodeFor, storage } = await render(service);

    await requestCodeFor(TYPED_PHONE);

    for (const method of untouchable(service)) {
      expect(method).not.toHaveBeenCalled();
    }
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('writes the phone number to no log', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    const service = stubAuthService({
      requestVendorSignInOtp: jest
        .fn()
        .mockRejectedValueOnce(new AppError({ kind: 'server', message: 'rejected' }))
        .mockResolvedValueOnce(CHALLENGE),
    });
    const { requestCodeFor, press } = await render(service);

    await requestCodeFor(TYPED_PHONE);
    await press(COPY.submit);

    const logged = spies
      .flatMap(spy => spy.mock.calls)
      .flat()
      .map(entry => JSON.stringify(entry))
      .join(' ');

    expect(logged).not.toContain(NORMALISED_PHONE);
  });
});

/**
 * The second visit: a vendor who has signed in on this device before is asked
 * only to send a code to the number they used (owner's instruction, 21/10/2026,
 * kept when the auth code went on 28/11/2026).
 */
describe('VendorLoginScreen — a returning vendor on the same device', () => {
  async function renderRemembered(service: AuthService = stubAuthService(), phone = SEEDED_PHONE) {
    const remembered = memoryRemembered(phone);
    const harness = await render(service, { remembered: remembered.storage });
    return { ...harness, remembered };
  }

  it('asks a first-time vendor for their phone number', async () => {
    const { hasField, text } = await render(stubAuthService());

    expect(hasField('vendor-login-phone')).toBe(true);
    expect(text()).toContain(COPY.title);
    expect(text()).not.toContain(COPY.welcomeTitle);
    expect(text()).not.toContain(COPY.useDifferentNumber);
  });

  it('welcomes them back with "Send code" and no field at all', async () => {
    const { hasField, hasNode, text, renderer } = await renderRemembered();

    expect(text()).toContain(COPY.welcomeTitle);
    expect(text()).toContain(COPY.welcomeSubtitle);
    expect(hasField('vendor-login-phone')).toBe(false);
    expect(hasNode('vendor-login-code')).toBe(false);
    expect(renderer.root.findAllByProps({ accessibilityLabel: COPY.submit }).length)
      .toBeGreaterThan(0);
    expect(text()).toContain(COPY.useDifferentNumber);
    // Registration belongs to the full form, one tap away.
    expect(text()).not.toContain(COPY.registerAction);
    expect(text().toLowerCase()).not.toContain('authentication code');
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

  it('"Send code" asks for a code to the remembered number and moves on', async () => {
    const service = stubAuthService();
    const { press, navigate } = await renderRemembered(service);

    await press(COPY.submit);

    expect(jest.mocked(service.requestVendorSignInOtp).mock.calls).toEqual([[SEEDED_PHONE]]);
    expect(navigate).toHaveBeenCalledWith('VendorSignInOtp', {
      phone: SEEDED_PHONE,
      challenge: CHALLENGE,
    });
    for (const method of untouchable(service)) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it('keeps the remembered number when the request fails', async () => {
    const service = stubAuthService({
      requestVendorSignInOtp: jest.fn(async () => {
        throw new AppError({ kind: 'unknown', code: 'RATE_LIMITED' });
      }),
    });
    const { press, text, remembered, hasField, navigate } = await renderRemembered(service);

    await press(COPY.submit);

    expect(text()).toContain('Too many attempts. Please wait a little and try again.');
    // A failed request says nothing about the account, so the number stays.
    expect(hasField('vendor-login-phone')).toBe(false);
    expect(remembered.storage.forget).not.toHaveBeenCalled();
    expect(remembered.peek()).toBe(SEEDED_PHONE);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('"Use a different number" forgets it and brings the phone field back', async () => {
    const service = stubAuthService();
    const { press, hasField, valueOf, text, remembered, fill, navigate } =
      await renderRemembered(service);

    await press(COPY.useDifferentNumber);

    expect(remembered.storage.forget).toHaveBeenCalledTimes(1);
    expect(remembered.peek()).toBeNull();
    expect(hasField('vendor-login-phone')).toBe(true);
    expect(valueOf('vendor-login-phone')).toBe('');
    expect(text()).toContain(COPY.title);
    expect(text()).toContain(COPY.registerAction);
    expect(text()).not.toContain(MASKED_PHONE);

    // And the next request uses the number typed now, not the forgotten one.
    await fill('vendor-login-phone', '9000000002');
    await press(COPY.submit);
    expect(jest.mocked(service.requestVendorSignInOtp).mock.calls).toEqual([['9000000002']]);
    expect(navigate).toHaveBeenCalledWith('VendorSignInOtp', {
      phone: '9000000002',
      challenge: CHALLENGE,
    });
  });

  it('asks for a number again rather than sending to the forgotten one', async () => {
    const service = stubAuthService();
    const { press, text } = await renderRemembered(service);

    await press(COPY.useDifferentNumber);
    await press(COPY.submit);

    expect(text()).toContain('Enter your phone number.');
    expect(service.requestVendorSignInOtp).not.toHaveBeenCalled();
  });

  it('labels the way out for assistive technology and locks it during a request', async () => {
    let release!: (challenge: OtpChallenge) => void;
    const service = stubAuthService({
      requestVendorSignInOtp: jest.fn(
        () =>
          new Promise<OtpChallenge>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { renderer, press, remembered, submitButton } = await renderRemembered(service);
    const different = () =>
      renderer.root.findByProps({ accessibilityLabel: COPY.useDifferentNumber }).props;

    expect(different().accessibilityRole).toBe('button');
    expect(different().accessibilityHint).toBe(COPY.useDifferentNumberHint);

    await press(COPY.submit);
    expect(submitButton().accessibilityState.busy).toBe(true);
    expect(different().accessibilityState.disabled).toBe(true);
    await press(COPY.useDifferentNumber);
    expect(remembered.storage.forget).not.toHaveBeenCalled();

    await act(async () => {
      release(CHALLENGE);
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
    const { hasField, requestCodeFor, navigate } = await render(service, { remembered: failing });

    expect(hasField('vendor-login-phone')).toBe(true);

    await requestCodeFor(TYPED_PHONE);
    expect(navigate).toHaveBeenCalledWith('VendorSignInOtp', {
      phone: NORMALISED_PHONE,
      challenge: CHALLENGE,
    });
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
    expect(text()).not.toContain(COPY.title);
    expect(text()).not.toContain(COPY.welcomeTitle);

    await act(async () => {
      answer(SEEDED_PHONE);
    });

    expect(text()).toContain(COPY.welcomeTitle);
    expect(hasField('vendor-login-phone')).toBe(false);
  });
});

/**
 * Against the real mock service and the seeded vendor, so the answer is the
 * mock's rather than a stub's.
 */
describe('VendorLoginScreen — against the real mock service', () => {
  it('asks for the seeded vendor’s code and hands the code screen the challenge', async () => {
    const { requestCodeFor, navigate, store } = await render(
      new MockAuthService({ latency: NO_LATENCY }),
    );

    await requestCodeFor(SEEDED_PHONE);

    expect(navigate).toHaveBeenCalledTimes(1);
    const [route, params] = navigate.mock.calls[0];
    expect(route).toBe('VendorSignInOtp');
    expect(params.phone).toBe(SEEDED_PHONE);
    expect(params.challenge).toEqual(
      expect.objectContaining({ maskedDestination: MASKED_PHONE, deliveryChannel: 'NONE' }),
    );
    expect(store.getState().auth.status).not.toBe('authenticated');
  });

  it('moves on alike for a number with no vendor account, so vendors cannot be enumerated', async () => {
    const known = await render(new MockAuthService({ latency: NO_LATENCY }));
    await known.requestCodeFor(SEEDED_PHONE);

    const unknown = await render(new MockAuthService({ latency: NO_LATENCY }));
    await unknown.requestCodeFor('9111111111');

    expect(unknown.navigate).toHaveBeenCalledTimes(1);
    expect(unknown.isToastShowing()).toBe(false);

    const [knownRoute, knownParams] = known.navigate.mock.calls[0];
    const [unknownRoute, unknownParams] = unknown.navigate.mock.calls[0];
    expect(unknownRoute).toBe(knownRoute);
    expect(Object.keys(unknownParams.challenge).sort()).toEqual(
      Object.keys(knownParams.challenge).sort(),
    );
    expect(unknownParams.challenge.deliveryChannel).toBe(knownParams.challenge.deliveryChannel);
    expect(unknownParams.challenge.resendAfterSeconds).toBe(
      knownParams.challenge.resendAfterSeconds,
    );
  });
});

/**
 * The whole loop against the real mock service and the real remembered-vendor
 * module, over an in-memory device that records every write: ask for a code,
 * sign in with it (the thunk the code screen uses), sign out, come back to
 * "Welcome back" — and the code never reaches the device.
 */
describe('VendorLoginScreen — remembered across a sign out', () => {
  it('opens on the remembered number the second time, and never stores the code', async () => {
    const { device, written } = memoryDevice();
    setKeyValueStorage(device);
    const service = new MockAuthService({ latency: NO_LATENCY });
    const storage = memoryStorage();

    const first = await render(service, {
      remembered: new DeviceRememberedVendorStorage(),
      storage,
    });
    expect(first.hasField('vendor-login-phone')).toBe(true);
    await first.requestCodeFor(SEEDED_PHONE);
    const [, params] = first.navigate.mock.calls[0];

    // The code screen's half, through the same thunk it calls.
    await act(async () => {
      await signInVendor(first.store.dispatch, params.phone, MOCK_OTP_CODE);
      // The publish waits for the verified state to have been seen.
      await new Promise<void>(resolve => setTimeout(resolve, duration.verifiedHold + 50));
    });
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

    await second.press(COPY.submit);
    expect(second.navigate).toHaveBeenCalledWith(
      'VendorSignInOtp',
      expect.objectContaining({ phone: SEEDED_PHONE }),
    );

    // Everything the device was ever handed, searched for the code.
    expect(written.length).toBeGreaterThan(0);
    expect(JSON.stringify(written)).toContain(SEEDED_PHONE);
    expect(JSON.stringify(written)).not.toContain(MOCK_OTP_CODE);
  });
});
