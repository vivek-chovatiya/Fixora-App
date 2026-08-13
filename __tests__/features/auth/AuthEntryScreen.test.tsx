/**
 * Role selection is the one screen in authentication that must do as little as
 * possible. It picks a route.
 *
 * The block below exists because "this screen does nothing" is the sort of claim
 * that quietly stops being true: a tap here must never authenticate, never reach
 * a service, never touch Redux, and never leave a trace on the device. The
 * authenticated role comes from the session, and a tap by an unauthenticated
 * user is not evidence of anything.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage, type PersistedSession } from '@/core/storage/SessionStorage';
import { AuthEntryScreen } from '@/features/auth/screens/AuthEntryScreen';
import { authReducer } from '@/features/auth/state/authSlice';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService } from '@/shared/services/types/AuthService';
import { ThemeProvider } from '@/shared/theme';

/**
 * Every operation throws. If role selection reaches the auth service at all, the
 * test fails loudly rather than quietly passing.
 */
function forbiddenAuthService(): AuthService {
  const forbidden = (name: string) =>
    jest.fn(() => {
      throw new Error(`${name} must not be called from role selection`);
    });

  return {
    requestCustomerOtp: forbidden('requestCustomerOtp'),
    verifyCustomerOtp: forbidden('verifyCustomerOtp'),
    registerVendor: forbidden('registerVendor'),
    requestVendorOtp: forbidden('requestVendorOtp'),
    verifyVendorOtp: forbidden('verifyVendorOtp'),
    verifyVendorAuthCode: forbidden('verifyVendorAuthCode'),
    regenerateVendorAuthCode: forbidden('regenerateVendorAuthCode'),
    signInVendor: forbidden('signInVendor'),
    signOut: forbidden('signOut'),
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

async function render() {
  const service = forbiddenAuthService();
  registerService('auth', service);

  const storage = memoryStorage();
  setSessionStorage(storage);

  const store = configureStore({ reducer: { auth: authReducer } });
  const navigate = jest.fn();
  const goBack = jest.fn();
  const addListener = jest.fn();
  const setOptions = jest.fn();
  const navigation = { navigate, goBack, addListener, setOptions } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <AuthEntryScreen navigation={navigation} route={{} as never} />
        </ThemeProvider>
      </Provider>,
    );
  });

  const press = async (accessibilityLabel: string) => {
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel }).props.onPress();
    });
  };

  return {
    renderer,
    service,
    store,
    storage,
    navigate,
    addListener,
    press,
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

describe('AuthEntryScreen', () => {
  it('offers both applications, each with a name and an explanation', async () => {
    const { renderer, text } = await render();

    expect(renderer.root.findByProps({ testID: 'auth-entry-customer' })).toBeDefined();
    expect(renderer.root.findByProps({ testID: 'auth-entry-vendor' })).toBeDefined();

    // Each option is readable as text, so the icon is never the only thing
    // carrying its meaning.
    expect(text()).toContain('Customer');
    expect(text()).toContain('Find and request local services.');
    expect(text()).toContain('Vendor');
    expect(text()).toContain('Manage your service business and jobs.');
  });

  it('presents both options as buttons with labels and hints', async () => {
    const { renderer } = await render();

    ['Customer', 'Vendor'].forEach(label => {
      // The pressable itself, not the Card wrapper that forwards the label.
      const [option] = renderer.root.findAll(
        node =>
          node.props.accessibilityLabel === label && node.props.accessibilityRole === 'button',
      );

      expect(option).toBeDefined();
      expect(option.props.accessibilityHint).toEqual(expect.any(String));
      expect(option.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: false }),
      );
    });
  });

  it('sends a customer to customer sign in', async () => {
    const { press, navigate } = await render();

    await press('Customer');

    expect(navigate).toHaveBeenCalledWith('CustomerLogin');
  });

  it('sends a vendor to vendor sign in', async () => {
    const { press, navigate } = await render();

    await press('Vendor');

    expect(navigate).toHaveBeenCalledWith('VendorLogin');
  });

  it('leaves registration to vendor sign in rather than offering a second path', async () => {
    const { press, navigate } = await render();

    await press('Vendor');

    expect(navigate).not.toHaveBeenCalledWith('VendorRegistration');
  });

  it('does not guard back navigation', async () => {
    const { addListener } = await render();

    // The onboarding guard works by intercepting `beforeRemove`. This screen
    // registers nothing, so moving around the auth stack behaves normally.
    expect(addListener).not.toHaveBeenCalled();
  });
});

describe('AuthEntryScreen — choosing a role is not authenticating', () => {
  it('reaches no service, either way', async () => {
    const { press, service } = await render();

    await press('Customer');
    await press('Vendor');

    Object.values(service).forEach(operation => {
      expect(operation).not.toHaveBeenCalled();
    });
  });

  it('creates no session and writes nothing to storage', async () => {
    const { press, store, storage } = await render();

    const before = store.getState().auth;

    await press('Customer');
    await press('Vendor');

    // Byte-identical auth state: no role, no status change, nothing recorded.
    expect(store.getState().auth).toEqual(before);
    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(store.getState().auth.user).toBeNull();
    expect(storage.write).not.toHaveBeenCalled();
    expect(storage.peek()).toBeNull();
  });

  it('leaves no trace of the choice anywhere it could later be trusted', async () => {
    const { press, store, navigate } = await render();

    await press('Vendor');

    const state = JSON.stringify(store.getState());
    expect(state).not.toContain('vendor');
    expect(state).not.toContain('customer');
    // The route is the only output. No role rides along as a param.
    expect(navigate).toHaveBeenCalledWith('VendorLogin');
    expect(navigate.mock.calls[0]).toHaveLength(1);
  });
});
