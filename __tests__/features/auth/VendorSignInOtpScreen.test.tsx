/**
 * Returning-vendor sign in, step two: the one-time code (owner decision
 * 28/11/2026, phase5-contract.md sections 1.1 and 2).
 *
 * The mistakes these tests guard against:
 * - verifying with anything but `verifyVendorSignInOtp(phone, code)` — the
 *   customer's and registration's methods, and the retired auth-code ones, all
 *   throw on the stub, so reaching one fails the test;
 * - the resend going anywhere but `requestVendorSignInOtp(phone)`, or the line
 *   naming where the code went not following the replacement challenge;
 * - the WhatsApp wording appearing for a challenge that did not say
 *   `WHATSAPP` (the channel is the backend's answer, never the app's guess), or
 *   failing to appear for one that did;
 * - a failure showing anything but the app's sentence for its code;
 * - the screen routing itself instead of letting auth state do it;
 * - a number with no vendor account left with no way on: the backend refuses
 *   its code as a wrong one and has no "not registered" answer, so the way to
 *   register must be there for everyone, from the first frame, without a
 *   service call deciding it.
 *
 * The store is real: whether verification produced a vendor session is the
 * whole point of the screen.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage, type PersistedSession } from '@/core/storage/SessionStorage';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { authReducer } from '@/features/auth/state/authSlice';
import { setRememberedVendorStorage } from '@/features/auth/state/rememberedVendorStorage';
import { VendorSignInOtpScreen } from '@/features/auth/screens/VendorSignInOtpScreen';
import type { SessionPayload } from '@/features/auth/types';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService, OtpChallenge } from '@/shared/services/types/AuthService';
import { Toast, ToastProvider } from '@/shared/components';
import { duration, ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = AUTH_COPY.vendorSignInOtp;

const PHONE = '9000000001';
const TYPED_CODE = '246810';
const MASKED = '••••••0001';

/** No cooldown by default, so resend is reachable without waiting a real minute. */
const CHALLENGE: OtpChallenge = {
  maskedDestination: MASKED,
  expiresAt: '2026-11-28T10:05:00.000Z',
  resendAfterSeconds: 0,
  deliveryChannel: 'NONE',
};

const WHATSAPP_CHALLENGE: OtpChallenge = { ...CHALLENGE, deliveryChannel: 'WHATSAPP' };

const SENT_PLAIN = `We sent a code to ${MASKED}`;
const SENT_WHATSAPP = `We sent a code on WhatsApp to ${MASKED}`;

const SESSION: SessionPayload = {
  token: 'token_vendor',
  user: {
    id: 'usr_vendor_1',
    firstName: 'Ravi',
    lastName: 'Kumar',
    phone: PHONE,
    role: 'vendor',
  },
};

/** Every method this screen must never reach, including the ones retired with the auth code. */
const FORBIDDEN = [
  'requestCustomerOtp',
  'verifyCustomerOtp',
  'registerVendor',
  'requestVendorOtp',
  'verifyVendorOtp',
  'signOut',
  'signInVendor',
  'verifyVendorAuthCode',
  'regenerateVendorAuthCode',
] as const;

type StubbedAuthService = AuthService & Record<(typeof FORBIDDEN)[number], jest.Mock>;

function stubAuthService(overrides: Partial<AuthService> = {}): StubbedAuthService {
  const unexpected = (name: string) =>
    jest.fn(() => {
      throw new Error(`${name} must not be called from the vendor code screen`);
    });

  const forbidden = Object.fromEntries(FORBIDDEN.map(name => [name, unexpected(name)]));

  return {
    ...forbidden,
    requestVendorSignInOtp: jest.fn(async () => CHALLENGE),
    verifyVendorSignInOtp: jest.fn(async () => SESSION),
    ...overrides,
  } as unknown as StubbedAuthService;
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

function memoryRemembered() {
  const given: unknown[] = [];
  const storage = {
    read: jest.fn(async () => null),
    remember: jest.fn(async (next: string) => {
      given.push(next);
      return true;
    }),
    forget: jest.fn(async () => undefined),
  };
  return { storage, given };
}

async function render(service: AuthService, challenge: OtpChallenge = CHALLENGE) {
  registerService('auth', service);

  const storage = memoryStorage();
  setSessionStorage(storage);

  const remembered = memoryRemembered();
  setRememberedVendorStorage(remembered.storage);

  const store = configureStore({ reducer: { auth: authReducer } });
  const goBack = jest.fn();
  const navigate = jest.fn();
  const navigation = { goBack, navigate } as never;
  const route = {
    key: 'VendorSignInOtp',
    name: 'VendorSignInOtp' as const,
    params: { phone: PHONE, challenge },
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <VendorSignInOtpScreen navigation={navigation} route={route} />
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);

  const press = async (accessibilityLabel: string) => {
    const button = renderer.root.findByProps({ accessibilityLabel });
    await act(async () => {
      button.props.onPress();
    });
  };

  const type = async (value: string) => {
    const field = renderer.root.findByProps({ testID: 'vendor-signin-otp-code' });
    await act(async () => {
      field.props.onChangeText(value);
    });
  };

  /** The host text input, not the wrappers that forward the same testID to it. */
  const codeField = () => {
    const [field] = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID === 'vendor-signin-otp-code' &&
        typeof node.props.onChangeText === 'function',
    );
    return field.props;
  };

  /** The line naming where the code went, as rendered. */
  const destinationLine = () => {
    const [line] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props.testID === 'vendor-signin-otp-destination',
    );
    return flatText(line);
  };

  /** Lets the scheduled session publish fire (the verified state is held first). */
  const settlePublish = async () => {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, duration.verifiedHold + 50));
    });
  };

  return {
    renderer,
    store,
    storage,
    remembered,
    goBack,
    navigate,
    type,
    press,
    codeField,
    destinationLine,
    settlePublish,
    isToastShowing: () => renderer.root.findAllByType(Toast).some(node => node.props.isVisible),
    text: () => textOf(renderer.toJSON()),
  };
}

/** Flattens every string in the rendered tree so copy can be asserted on. */
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

/** The strings under a test-instance node. */
function flatText(node: ReactTestRenderer.ReactTestInstance | undefined): string {
  if (!node) {
    return '';
  }
  return node.children
    .map(child => (typeof child === 'string' ? child : flatText(child)))
    .join('');
}

/**
 * Every screen a test rendered, unmounted after it — a toast's dismiss timer
 * and the resend countdown would otherwise outlive the test.
 */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
  jest.restoreAllMocks();
});

describe('VendorSignInOtpScreen — what the vendor sees', () => {
  it('continues vendor sign in, with its heading from central copy', async () => {
    const { renderer, text } = await render(stubAuthService());

    expect(renderer.root.findAllByProps({ testID: 'vendor-signin-otp-bar-mark' }).length)
      .toBeGreaterThan(0);
    expect(text()).toContain(COPY.title);
    expect(renderer.root.findAllByProps({ testID: 'vendor-signin-otp-cityscape' }).length)
      .toBeGreaterThan(0);
  });

  it('labels the field and every action for assistive technology', async () => {
    const { codeField, renderer } = await render(stubAuthService());

    expect(codeField().accessibilityLabel).toBe(COPY.codeLabel);
    expect(codeField().accessibilityHint).toBe(COPY.codeHint);
    expect(renderer.root.findByProps({ accessibilityLabel: COPY.resend }).props.accessibilityRole)
      .toBe('button');
    expect(
      renderer.root.findByProps({ accessibilityLabel: COPY.changeAction }).props.accessibilityRole,
    ).toBe('button');
  });

  it('shows the masked destination, never the number, and no code of its own', async () => {
    const { text, codeField } = await render(stubAuthService());

    expect(text()).toContain(MASKED);
    expect(text()).not.toContain(PHONE);
    expect(codeField().value).toBe('');
    expect(text()).not.toMatch(/\b\d{6}\b/);
  });

  it('says nothing about an auth code', async () => {
    const { text } = await render(stubAuthService());

    expect(text().toLowerCase()).not.toContain('authentication code');
    expect(text().toLowerCase()).not.toContain('auth code');
  });
});

describe('VendorSignInOtpScreen — where the code went', () => {
  it('says WhatsApp when the challenge says WHATSAPP', async () => {
    const { destinationLine, text } = await render(stubAuthService(), WHATSAPP_CHALLENGE);

    expect(destinationLine()).toBe(SENT_WHATSAPP);
    expect(text()).toContain(SENT_WHATSAPP);
  });

  it('keeps the plain sentence, and no WhatsApp anywhere, when it says NONE', async () => {
    const { destinationLine, renderer } = await render(stubAuthService(), CHALLENGE);

    expect(destinationLine()).toBe(SENT_PLAIN);
    // Anywhere in the tree, accessibility labels and hints included.
    expect(JSON.stringify(renderer.toJSON())).not.toContain('WhatsApp');
  });

  it('keeps the plain sentence for a channel the app does not know', async () => {
    const unknownChannel = { ...CHALLENGE, deliveryChannel: 'SMS' } as unknown as OtpChallenge;
    const { destinationLine, renderer } = await render(stubAuthService(), unknownChannel);

    expect(destinationLine()).toBe(SENT_PLAIN);
    expect(JSON.stringify(renderer.toJSON())).not.toContain('WhatsApp');
  });

  it('follows the replacement: a resend on WhatsApp switches the line, and back again', async () => {
    const service = stubAuthService({
      requestVendorSignInOtp: jest
        .fn()
        .mockResolvedValueOnce(WHATSAPP_CHALLENGE)
        .mockResolvedValueOnce(CHALLENGE),
    });
    const { press, destinationLine, renderer } = await render(service, CHALLENGE);
    expect(destinationLine()).toBe(SENT_PLAIN);

    await press(COPY.resend);
    expect(destinationLine()).toBe(SENT_WHATSAPP);

    await press(COPY.resend);
    expect(destinationLine()).toBe(SENT_PLAIN);
    expect(JSON.stringify(renderer.toJSON())).not.toContain('WhatsApp');
  });
});

describe('VendorSignInOtpScreen — verification', () => {
  it('does not reach the service until the code is complete', async () => {
    const service = stubAuthService();
    const { type } = await render(service);

    await type('12345');

    expect(service.verifyVendorSignInOtp).not.toHaveBeenCalled();
  });

  it('verifies on the last digit with the phone and the code, and only those', async () => {
    const service = stubAuthService();
    const { type } = await render(service);

    await type(TYPED_CODE);

    expect(jest.mocked(service.verifyVendorSignInOtp).mock.calls).toEqual([[PHONE, TYPED_CODE]]);
  });

  it('never reaches the customer’s, registration’s or a retired method', async () => {
    const service = stubAuthService();
    const { type, press, settlePublish } = await render(service);

    await press(COPY.resend);
    await type(TYPED_CODE);
    await settlePublish();

    for (const name of FORBIDDEN) {
      expect(service[name]).not.toHaveBeenCalled();
    }
  });

  it('signs the vendor in through auth state, not by navigating, and remembers the number', async () => {
    const service = stubAuthService();
    const { type, store, storage, remembered, navigate, goBack, settlePublish } =
      await render(service);

    await type(TYPED_CODE);

    // The verified state is on screen first; the tree swaps after it.
    expect(store.getState().auth.status).not.toBe('authenticated');
    await settlePublish();

    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('vendor');
    expect(storage.peek()).toEqual(SESSION);
    // The thunk remembers the number the code was sent to — and only that.
    expect(remembered.given).toEqual([PHONE]);
    expect(navigate).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
  });

  it('refuses a wrong code in the app’s words and stays on the screen', async () => {
    const service = stubAuthService({
      verifyVendorSignInOtp: jest.fn(async () => {
        throw new AppError({
          kind: 'validation',
          code: 'OTP_INVALID',
          statusCode: 400,
          message: `no code issued for ${PHONE}`,
        });
      }),
    });
    const { type, text, store, renderer, codeField } = await render(service);

    await type(TYPED_CODE);

    expect(text()).toContain('That code is not correct. Please check and try again.');
    expect(text()).not.toContain('no code issued');
    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(renderer.root.findAllByProps({ testID: 'vendor-signin-otp-screen' }).length)
      .toBeGreaterThan(0);
    // The typed code stays, to be edited rather than retyped.
    expect(codeField().value).toBe(TYPED_CODE);
  });

  it('says a suspended account is not active', async () => {
    const service = stubAuthService({
      verifyVendorSignInOtp: jest.fn(async () => {
        throw new AppError({ kind: 'forbidden', code: 'ACCOUNT_SUSPENDED', statusCode: 403 });
      }),
    });
    const { type, text, store } = await render(service);

    await type(TYPED_CODE);

    expect(text()).toContain('This account is not active right now, so you cannot sign in with it.');
    expect(store.getState().auth.status).not.toBe('authenticated');
  });

  it('verifies again once a rejected code has been edited', async () => {
    const service = stubAuthService({
      verifyVendorSignInOtp: jest
        .fn()
        .mockRejectedValueOnce(new AppError({ kind: 'validation', code: 'OTP_INVALID' }))
        .mockResolvedValueOnce(SESSION),
    });
    const { type, settlePublish, store } = await render(service);

    await type(TYPED_CODE);
    await type(TYPED_CODE.slice(0, 5));
    await type('246811');

    expect(jest.mocked(service.verifyVendorSignInOtp).mock.calls).toEqual([
      [PHONE, TYPED_CODE],
      [PHONE, '246811'],
    ]);
    await settlePublish();
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('locks the field while the check is in flight', async () => {
    let release!: (session: SessionPayload) => void;
    const service = stubAuthService({
      verifyVendorSignInOtp: jest.fn(
        () =>
          new Promise<SessionPayload>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { type, codeField } = await render(service);

    expect(codeField().editable).toBe(true);
    await type(TYPED_CODE);
    expect(codeField().editable).toBe(false);

    await act(async () => {
      release(SESSION);
    });
  });
});

describe('VendorSignInOtpScreen — resend', () => {
  it('asks the vendor sign-in service for another code, with the number alone', async () => {
    const service = stubAuthService();
    const { press } = await render(service);

    await press(COPY.resend);

    expect(jest.mocked(service.requestVendorSignInOtp).mock.calls).toEqual([[PHONE]]);
  });

  it('names the destination the replacement went to', async () => {
    const service = stubAuthService({
      requestVendorSignInOtp: jest.fn(async () => ({
        ...CHALLENGE,
        maskedDestination: '••••••9999',
      })),
    });
    const { press, destinationLine } = await render(service);

    await press(COPY.resend);

    expect(destinationLine()).toBe('We sent a code to ••••••9999');
  });

  it('says a code that could not be sent can be asked for again at once', async () => {
    const service = stubAuthService({
      requestVendorSignInOtp: jest
        .fn()
        .mockRejectedValueOnce(
          new AppError({ kind: 'server', code: 'OTP_DELIVERY_FAILED', statusCode: 503 }),
        )
        .mockResolvedValueOnce(WHATSAPP_CHALLENGE),
    });
    const { press, text, destinationLine } = await render(service);

    await press(COPY.resend);

    expect(text()).toContain('We could not send your code just now. Please try again.');
    // The failed request changed nothing about where the last code went.
    expect(destinationLine()).toBe(SENT_PLAIN);

    // Retryable, and the button is there to retry with.
    await press(COPY.resend);
    expect(service.requestVendorSignInOtp).toHaveBeenCalledTimes(2);
    expect(destinationLine()).toBe(SENT_WHATSAPP);
  });

  it('drops the previous failure once a replacement code has been sent', async () => {
    const service = stubAuthService({
      verifyVendorSignInOtp: jest.fn(async () => {
        throw new AppError({ kind: 'validation', code: 'OTP_INVALID' });
      }),
    });
    const { type, press, isToastShowing, codeField } = await render(service);

    await type(TYPED_CODE);
    expect(isToastShowing()).toBe(true);

    await press(COPY.resend);

    expect(isToastShowing()).toBe(false);
    expect(codeField().value).toBe(TYPED_CODE);
  });
});

describe('VendorSignInOtpScreen — the code never leaks', () => {
  it('is written neither to the device nor to Redux nor to the remembered number', async () => {
    const { type, storage, store, remembered, settlePublish } = await render(stubAuthService());

    await type(TYPED_CODE);
    await settlePublish();

    expect(storage.write).toHaveBeenCalled();
    expect(JSON.stringify(storage.peek())).not.toContain(TYPED_CODE);
    expect(JSON.stringify(store.getState())).not.toContain(TYPED_CODE);
    expect(JSON.stringify(remembered.given)).not.toContain(TYPED_CODE);
  });

  it('is not written to logs, even when verification fails', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    const service = stubAuthService({
      verifyVendorSignInOtp: jest.fn(async () => {
        throw new AppError({ kind: 'validation', code: 'OTP_INVALID', message: 'mismatch' });
      }),
    });
    const { type } = await render(service);

    await type(TYPED_CODE);

    const logged = spies
      .flatMap(spy => spy.mock.calls)
      .flat()
      .map(entry => JSON.stringify(entry))
      .join(' ');
    expect(logged).not.toContain(TYPED_CODE);
  });
});

describe('VendorSignInOtpScreen — a number with no vendor account', () => {
  /** The button's own node, which carries its role and state. */
  const registerButton = (renderer: ReactTestRenderer.ReactTestRenderer) =>
    renderer.root.findByProps({ accessibilityLabel: COPY.registerAction }).props;

  it('offers registration to everyone, from the first frame, before any answer', async () => {
    const service = stubAuthService();
    const { text, renderer } = await render(service);

    expect(text()).toContain(COPY.registerPrompt);
    expect(registerButton(renderer).accessibilityRole).toBe('button');
    // Shown without asking anybody whether the number is a vendor's.
    expect(service.requestVendorSignInOtp).not.toHaveBeenCalled();
    expect(service.verifyVendorSignInOtp).not.toHaveBeenCalled();
  });

  it('goes to registration, calling no service on the way', async () => {
    const service = stubAuthService();
    const { press, navigate, goBack } = await render(service);

    await press(COPY.registerAction);

    expect(navigate.mock.calls).toEqual([['VendorRegistration']]);
    expect(goBack).not.toHaveBeenCalled();
    expect(service.requestVendorSignInOtp).not.toHaveBeenCalled();
    expect(service.verifyVendorSignInOtp).not.toHaveBeenCalled();
    for (const name of FORBIDDEN) {
      expect(service[name]).not.toHaveBeenCalled();
    }
  });

  it('is still there after a refusal, which reads as a wrong code and nothing more', async () => {
    const service = stubAuthService({
      verifyVendorSignInOtp: jest.fn(async () => {
        throw new AppError({ kind: 'validation', code: 'OTP_INVALID', statusCode: 400 });
      }),
    });
    const { type, text, renderer } = await render(service);

    await type(TYPED_CODE);

    expect(text()).toContain('That code is not correct. Please check and try again.');
    expect(text()).not.toMatch(/not registered|no account|not found/i);
    expect(registerButton(renderer).accessibilityState.disabled).toBe(false);
  });

  it('is held while a code is being checked, so a tap cannot leave mid-request', async () => {
    let release!: (session: SessionPayload) => void;
    const service = stubAuthService({
      verifyVendorSignInOtp: jest.fn(
        () =>
          new Promise<SessionPayload>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { type, renderer } = await render(service);

    expect(registerButton(renderer).accessibilityState.disabled).toBe(false);
    await type(TYPED_CODE);
    expect(registerButton(renderer).accessibilityState.disabled).toBe(true);

    await act(async () => {
      release(SESSION);
    });
  });
});

describe('VendorSignInOtpScreen — changing the number', () => {
  it('"Change phone number" goes back rather than rebuilding sign in', async () => {
    const { press, goBack, navigate } = await render(stubAuthService());

    await press(COPY.changeAction);

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('the bar’s back control goes back too', async () => {
    const { press, goBack } = await render(stubAuthService());

    await press(AUTH_COPY.common.back);

    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
