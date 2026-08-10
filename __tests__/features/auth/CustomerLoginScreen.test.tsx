/**
 * The sign-in screen's job is narrow, and these tests pin its edges:
 *
 * - an incomplete number never reaches the network
 * - what does reach the service is normalised, not what was typed
 * - a failure shows the safe message and leaves the form usable
 * - success hands the challenge to verification, along with the number it needs
 *
 * A stub AuthService is registered so the screen is exercised through the same
 * abstraction the real one will arrive behind.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import { CustomerLoginScreen } from '@/features/auth/screens/CustomerLoginScreen';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService } from '@/shared/services/types/AuthService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const CHALLENGE = {
  maskedDestination: '••••••3210',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  resendAfterSeconds: 30,
};

/** Only the operation this screen uses is implemented; the rest must not be called. */
function stubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  const unexpected = (name: string) => () => {
    throw new Error(`${name} must not be called from the sign-in screen`);
  };

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

async function render(service: AuthService) {
  registerService('auth', service);

  const navigate = jest.fn();
  const navigation = { navigate } as never;
  const route = { key: 'CustomerLogin', name: 'CustomerLogin' as const, params: undefined } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <CustomerLoginScreen navigation={navigation} route={route} />
      </ThemeProvider>,
    );
  });

  const type = async (value: string) => {
    const field = renderer.root.findByProps({ testID: 'customer-login-phone' });
    await act(async () => {
      field.props.onChangeText(value);
    });
  };

  const submit = async () => {
    const button = renderer.root.findByProps({ accessibilityLabel: 'Send code' });
    await act(async () => {
      button.props.onPress();
    });
  };

  return { renderer, navigate, type, submit, text: () => textOf(renderer.toJSON()) };
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
});

describe('CustomerLoginScreen', () => {
  it('keeps an incomplete number off the network', async () => {
    const service = stubAuthService();
    const { type, submit, text, navigate } = await render(service);

    await type('123');
    await submit();

    expect(service.requestCustomerOtp).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(text()).toContain('too short');
  });

  it('sends digits, not what the user typed', async () => {
    const service = stubAuthService();
    const { type, submit } = await render(service);

    await type('+91 98765-43210');
    await submit();

    expect(service.requestCustomerOtp).toHaveBeenCalledWith('919876543210');
  });

  it('hands verification the challenge and the number it will need', async () => {
    const { type, submit, navigate } = await render(stubAuthService());

    await type('+91 98765-43210');
    await submit();

    expect(navigate).toHaveBeenCalledWith('CustomerOtp', {
      phone: '919876543210',
      challenge: CHALLENGE,
    });
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
    const { type, submit, text, navigate } = await render(service);

    await type('9876543210');
    await submit();

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('ECONNREFUSED');
    expect(text()).toContain('Send code');
    expect(navigate).not.toHaveBeenCalled();

    await submit();
    expect(service.requestCustomerOtp).toHaveBeenCalledTimes(2);
  });
});
