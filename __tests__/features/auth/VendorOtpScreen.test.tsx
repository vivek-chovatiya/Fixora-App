/**
 * This screen sits on the sharpest boundary in the application: verifying a
 * vendor's phone activates their business and issues a permanent auth code, but
 * it does not sign them in. A vendor holding a verified number and no confirmed
 * auth code must remain unauthenticated.
 *
 * The security block below is the point of this file. The store and session
 * storage are real so "no session was created" is a fact about the system rather
 * than an assumption about the screen.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage, type PersistedSession } from '@/core/storage/SessionStorage';
import { authReducer } from '@/features/auth/state/authSlice';
import { VendorOtpScreen } from '@/features/auth/screens/VendorOtpScreen';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  AuthService,
  OtpChallenge,
  VendorAuthCode,
} from '@/shared/services/types/AuthService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const REGISTRATION_ID = 'reg_test_1';
const VENDOR_PHONE = '9123456780';
const TYPED_CODE = '246810';

/** The permanent credential the vendor will later confirm. */
const ISSUED_CODE: VendorAuthCode = {
  code: 'FX-ABCD-2345',
  issuedAt: new Date().toISOString(),
};

/** No cooldown by default, so resend is reachable without waiting. */
const CHALLENGE: OtpChallenge = {
  maskedDestination: '••••••6780',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  resendAfterSeconds: 0,
};

function stubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  // Mocks rather than plain functions, so a test can assert one was never
  // reached as well as fail loudly if it is.
  const unexpected = (name: string) =>
    jest.fn(() => {
      throw new Error(`${name} must not be called from the vendor verification screen`);
    });

  return {
    verifyVendorOtp: jest.fn(async () => ISSUED_CODE),
    requestVendorOtp: jest.fn(async () => CHALLENGE),
    registerVendor: unexpected('registerVendor'),
    requestCustomerOtp: unexpected('requestCustomerOtp'),
    verifyCustomerOtp: unexpected('verifyCustomerOtp'),
    verifyVendorAuthCode: unexpected('verifyVendorAuthCode'),
    regenerateVendorAuthCode: unexpected('regenerateVendorAuthCode'),
    signInVendor: unexpected('signInVendor'),
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

async function render(service: AuthService, challenge: OtpChallenge = CHALLENGE) {
  registerService('auth', service);
  const storage = memoryStorage();
  setSessionStorage(storage);

  const store = configureStore({ reducer: { auth: authReducer } });
  const goBack = jest.fn();
  const navigate = jest.fn();
  const navigation = { goBack, navigate } as never;
  const route = {
    key: 'VendorOtp',
    name: 'VendorOtp' as const,
    params: { registrationId: REGISTRATION_ID, challenge },
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <VendorOtpScreen navigation={navigation} route={route} />
        </ThemeProvider>
      </Provider>,
    );
  });

  const type = async (value: string) => {
    await act(async () => {
      renderer.root.findByProps({ testID: 'vendor-otp-code' }).props.onChangeText(value);
    });
  };

  const press = async (accessibilityLabel: string) => {
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel }).props.onPress();
    });
  };

  return {
    renderer,
    store,
    storage,
    goBack,
    navigate,
    type,
    press,
    text: () => textOf(renderer.toJSON()),
    verifyButton: () => renderer.root.findByProps({ accessibilityLabel: 'Verify' }).props,
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

describe('VendorOtpScreen — what the vendor sees', () => {
  it('renders the form against the masked destination, never the raw number', async () => {
    const { text, renderer } = await render(stubAuthService());

    expect(text()).toContain(CHALLENGE.maskedDestination);
    expect(text()).not.toContain(VENDOR_PHONE);
    expect(renderer.root.findByProps({ testID: 'vendor-otp-code' }).props.value).toBe('');
  });

  it('does not show the registration handle', async () => {
    const { text } = await render(stubAuthService());

    expect(text()).not.toContain(REGISTRATION_ID);
  });
});

describe('VendorOtpScreen — verification', () => {
  it('rejects an empty code locally', async () => {
    const service = stubAuthService();
    const { press, text } = await render(service);

    await press('Verify');

    expect(service.verifyVendorOtp).not.toHaveBeenCalled();
    expect(text()).toContain('Enter the code we sent you.');
  });

  it('rejects an incomplete code locally', async () => {
    const service = stubAuthService();
    const { type, press, text } = await render(service);

    await type('123');
    await press('Verify');

    expect(service.verifyVendorOtp).not.toHaveBeenCalled();
    expect(text()).toContain('digits');
  });

  it('verifies against the registration id, not the phone number', async () => {
    const service = stubAuthService();
    const { type, press } = await render(service);

    await type(TYPED_CODE);
    await press('Verify');

    expect(service.verifyVendorOtp).toHaveBeenCalledWith(REGISTRATION_ID, TYPED_CODE);
  });

  it('locks the verify button while the check is in flight', async () => {
    let release!: (code: VendorAuthCode) => void;
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(
        () =>
          new Promise<VendorAuthCode>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { type, press, verifyButton } = await render(service);

    await type(TYPED_CODE);
    expect(verifyButton().accessibilityState.busy).toBe(false);

    await press('Verify');
    expect(verifyButton().accessibilityState.busy).toBe(true);
    expect(verifyButton().accessibilityState.disabled).toBe(true);

    await act(async () => {
      release(ISSUED_CODE);
    });
  });

  it('will not verify twice while the first attempt is unanswered', async () => {
    let release!: (code: VendorAuthCode) => void;
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(
        () =>
          new Promise<VendorAuthCode>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { type, press } = await render(service);

    await type(TYPED_CODE);
    await press('Verify');
    await press('Verify');

    expect(service.verifyVendorOtp).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(ISSUED_CODE);
    });
  });

  it('shows a safe message for a wrong code', async () => {
    const failure = new AppError({
      kind: 'validation',
      message: 'expected 123456 but received 246810',
      userMessage: 'That code is not correct. Please check and try again.',
    });
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(async () => {
        throw failure;
      }),
    });
    const { type, press, text } = await render(service);

    await type(TYPED_CODE);
    await press('Verify');

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('expected 123456');
  });

  it('titles an expired code correctly', async () => {
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(async () => {
        throw new AppError({
          kind: 'unauthorized',
          userMessage: 'That code has expired. Request a new one.',
        });
      }),
    });
    const { type, press, text } = await render(service);

    await type(TYPED_CODE);
    await press('Verify');

    expect(text()).toContain('Code expired');
    expect(text()).not.toContain('Session expired');
  });
});

describe('VendorOtpScreen — resend', () => {
  it('re-sends against the same onboarding rather than registering again', async () => {
    const service = stubAuthService();
    const { press } = await render(service);

    await press('Resend code');

    expect(service.requestVendorOtp).toHaveBeenCalledWith(REGISTRATION_ID);
    // Starting a second registration would orphan the first.
    expect(service.registerVendor).not.toHaveBeenCalled();
  });

  it('honours the cooldown the challenge specified', async () => {
    const service = stubAuthService();
    const { press, text } = await render(service, { ...CHALLENGE, resendAfterSeconds: 30 });

    expect(text()).toContain('Resend code in 30s');

    await press('Resend code in 30s');

    expect(service.requestVendorOtp).not.toHaveBeenCalled();
  });

  it('will not send a second request while the first is unanswered', async () => {
    let release!: (challenge: OtpChallenge) => void;
    const service = stubAuthService({
      requestVendorOtp: jest.fn(
        () =>
          new Promise<OtpChallenge>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { press } = await render(service);

    await press('Resend code');
    await press('Resend code');

    expect(service.requestVendorOtp).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(CHALLENGE);
    });
  });
});

describe('VendorOtpScreen — restarting', () => {
  it('goes back to registration rather than rebuilding the form', async () => {
    const { press, goBack, navigate } = await render(stubAuthService());

    await press('Change registration details');

    expect(goBack).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

/**
 * The boundary that makes vendor onboarding safe. Verifying a phone number
 * activates a business; it does not authenticate anyone.
 */
describe('VendorOtpScreen — verification must not authenticate', () => {
  it('creates no session, in Redux or in storage', async () => {
    const service = stubAuthService();
    const { type, press, store, storage, navigate } = await render(service);

    await type(TYPED_CODE);
    await press('Verify');

    // The call succeeded...
    expect(service.verifyVendorOtp).toHaveBeenCalled();

    // ...and produced no session anywhere.
    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.token).toBeNull();
    expect(storage.peek()).toBeNull();
    expect(storage.write).not.toHaveBeenCalled();

    // And no route into the vendor application.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('never asks the service for a session at this step', async () => {
    // signInVendor and verifyVendorAuthCode throw if called: the stub treats
    // them as operations this screen has no business performing.
    const service = stubAuthService();
    const { type, press } = await render(service);

    await type(TYPED_CODE);
    await press('Verify');

    expect(service.verifyVendorAuthCode).not.toHaveBeenCalled();
    expect(service.signInVendor).not.toHaveBeenCalled();
  });

  it('confirms the vendor without revealing the auth code it was given', async () => {
    const { type, press, text } = await render(stubAuthService());

    await type(TYPED_CODE);
    await press('Verify');

    // The handoff happened — the screen knows verification succeeded.
    expect(text()).toContain('Business verified');
    // The display step owns showing the code. This screen must not.
    expect(text()).not.toContain(ISSUED_CODE.code);
  });

  it('keeps the auth code out of Redux and storage', async () => {
    const { type, press, store, storage } = await render(stubAuthService());

    await type(TYPED_CODE);
    await press('Verify');

    expect(JSON.stringify(store.getState())).not.toContain(ISSUED_CODE.code);
    expect(JSON.stringify(storage.peek())).not.toContain(ISSUED_CODE.code);
  });

  it('writes neither the one-time code nor the auth code to logs', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const service = stubAuthService({
      verifyVendorOtp: jest
        .fn()
        .mockRejectedValueOnce(new AppError({ kind: 'validation', message: 'code mismatch' }))
        .mockResolvedValueOnce(ISSUED_CODE),
    });
    const { type, press } = await render(service);

    await type(TYPED_CODE);
    await press('Verify');
    await press('Verify');

    const logged = [...consoleLog.mock.calls, ...consoleError.mock.calls]
      .flat()
      .map(entry => JSON.stringify(entry))
      .join(' ');

    expect(logged).not.toContain(TYPED_CODE);
    expect(logged).not.toContain(ISSUED_CODE.code);
  });
});
