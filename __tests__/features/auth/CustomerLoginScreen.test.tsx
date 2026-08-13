/**
 * The sign-in screen's job is narrow, and these tests pin its edges:
 *
 * - an incomplete number never reaches the network
 * - what does reach the service is normalised, not what was typed
 * - a failure shows the safe message and leaves the form usable
 * - success hands the challenge to verification, along with the number it needs
 * - requesting a code is not signing in: no session, no Redux, no storage
 *
 * A stub AuthService is registered so the screen is exercised through the same
 * abstraction the real one will arrive behind.
 *
 * Copy is asserted through AUTH_COPY rather than repeated as literals. The point
 * of these tests is that the screen renders centralised content, not that a
 * particular sentence was chosen — rewording should not fail a test.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage, type PersistedSession } from '@/core/storage/SessionStorage';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { CustomerLoginScreen } from '@/features/auth/screens/CustomerLoginScreen';
import { authReducer } from '@/features/auth/state/authSlice';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService } from '@/shared/services/types/AuthService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = AUTH_COPY.customerLogin;

const CHALLENGE = {
  maskedDestination: '••••••3210',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  resendAfterSeconds: 30,
};

/** Only the operation this screen uses is implemented; the rest must not be called. */
function stubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  const unexpected = (name: string) =>
    jest.fn(() => {
      throw new Error(`${name} must not be called from the sign-in screen`);
    });

  return {
    requestCustomerOtp: jest.fn(async () => CHALLENGE),
    verifyCustomerOtp: unexpected('verifyCustomerOtp'),
    registerVendor: unexpected('registerVendor'),
    requestVendorOtp: unexpected('requestVendorOtp'),
    verifyVendorOtp: unexpected('verifyVendorOtp'),
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

async function render(service: AuthService = stubAuthService()) {
  registerService('auth', service);

  const storage = memoryStorage();
  setSessionStorage(storage);

  const store = configureStore({ reducer: { auth: authReducer } });
  const navigate = jest.fn();
  const navigation = { navigate } as never;
  const route = { key: 'CustomerLogin', name: 'CustomerLogin' as const, params: undefined } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <CustomerLoginScreen navigation={navigation} route={route} />
        </ThemeProvider>
      </Provider>,
    );
  });

  /**
   * The host text input, not the ControlledInput or PhoneInput wrappers that
   * forward the same testID down to it. Those carry the handler too, but only
   * the host element carries the resolved accessibility and editable props.
   */
  const phoneField = () => {
    const [field] = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID === 'customer-login-phone' &&
        typeof node.props.onChangeText === 'function',
    );
    return field;
  };

  const submitButton = () => renderer.root.findByProps({ accessibilityLabel: COPY.submit });

  const type = async (value: string) => {
    await act(async () => {
      phoneField().props.onChangeText(value);
    });
  };

  const submit = async () => {
    await act(async () => {
      submitButton().props.onPress();
    });
  };

  return {
    renderer,
    service,
    store,
    storage,
    navigate,
    phoneField,
    submitButton,
    type,
    submit,
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

afterEach(() => {
  resetServices();
  jest.restoreAllMocks();
});

describe('CustomerLoginScreen', () => {
  it('renders the brand, the heading and its explanation from central copy', async () => {
    const { renderer, text } = await render();

    expect(renderer.root.findByProps({ testID: 'customer-login-screen' })).toBeDefined();
    expect(text()).toContain(AUTH_COPY.brand.wordmark);
    expect(text()).toContain(COPY.title);
    expect(text()).toContain(COPY.subtitle);
  });

  it('asks for a phone number and offers one way to continue', async () => {
    const { phoneField, submitButton, text } = await render();

    expect(phoneField()).toBeDefined();
    expect(text()).toContain(COPY.phoneLabel);
    expect(submitButton()).toBeDefined();

    // Nothing this screen deliberately excludes has crept back in.
    expect(text()).not.toMatch(/password|sign up|register|forgot/i);
  });

  it('labels the field and the action for assistive technology', async () => {
    const { phoneField, submitButton } = await render();

    expect(phoneField().props.accessibilityLabel).toBe(COPY.phoneLabel);

    const button = submitButton();
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityHint).toBe(COPY.submitHint);
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false, busy: false }),
    );
  });

  it('keeps an incomplete number off the network', async () => {
    const { service, type, submit, text, navigate } = await render();

    await type('123');
    await submit();

    expect(service.requestCustomerOtp).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(text()).toContain('too short');
  });

  it('sends digits, not what the user typed', async () => {
    const { service, type, submit } = await render();

    await type('+91 98765-43210');
    await submit();

    expect(service.requestCustomerOtp).toHaveBeenCalledWith('919876543210');
  });

  it('hands verification the challenge and the number it will need', async () => {
    const { type, submit, navigate } = await render();

    await type('+91 98765-43210');
    await submit();

    expect(navigate).toHaveBeenCalledWith('CustomerOtp', {
      phone: '919876543210',
      challenge: CHALLENGE,
    });
    // The only route out of this screen. No signup, no role, no vendor branch.
    expect(navigate.mock.calls).toHaveLength(1);
  });

  it('shows the safe message on failure and leaves the form ready to retry', async () => {
    const failure = new AppError({
      kind: 'network',
      message: 'connect ECONNREFUSED 127.0.0.1:443',
    });
    const service = stubAuthService({
      requestCustomerOtp: jest.fn(async () => {
        throw failure;
      }),
    });
    const { type, submit, text, navigate, phoneField, submitButton } = await render(service);

    await type('9876543210');
    await submit();

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('ECONNREFUSED');
    expect(navigate).not.toHaveBeenCalled();

    // The number survives the failure, and the same button is the retry.
    expect(phoneField().props.value).toBe('9876543210');
    expect(submitButton().props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
    expect(phoneField().props.editable).toBe(true);

    await submit();
    expect(service.requestCustomerOtp).toHaveBeenCalledTimes(2);
  });

  it('takes one request per attempt, however many times the button is pressed', async () => {
    let release!: (challenge: typeof CHALLENGE) => void;
    const service = stubAuthService({
      requestCustomerOtp: jest.fn(
        () =>
          new Promise<typeof CHALLENGE>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { type, submit, phoneField, submitButton } = await render(service);

    await type('9876543210');
    await submit();

    // In flight: the action reads as busy and the number is held, not editable.
    expect(submitButton().props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true, busy: true }),
    );
    expect(phoneField().props.editable).toBe(false);
    expect(phoneField().props.value).toBe('9876543210');

    await submit();
    await submit();
    expect(service.requestCustomerOtp).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(CHALLENGE);
    });
  });
});

describe('CustomerLoginScreen — requesting a code is not signing in', () => {
  it('creates no session, writes no auth state and stores nothing', async () => {
    const { type, submit, store, storage } = await render();

    const before = store.getState().auth;

    await type('9876543210');
    await submit();

    expect(store.getState().auth).toEqual(before);
    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(store.getState().auth.user).toBeNull();
    expect(storage.write).not.toHaveBeenCalled();
    expect(storage.peek()).toBeNull();
  });

  it('never displays or logs a code, and never logs the number', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
    ];

    const { type, submit, text } = await render();

    await type('+91 98765-43210');
    await submit();

    // The screen requests a code; it is never told one and never shows one.
    expect(text()).not.toMatch(/\d{4,}/);

    const logged = spies.flatMap(spy => spy.mock.calls).map(call => JSON.stringify(call));
    logged.forEach(entry => {
      expect(entry).not.toContain('919876543210');
      expect(entry).not.toContain('9876543210');
    });
  });
});
