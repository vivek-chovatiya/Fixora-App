/**
 * RootNavigator is what makes "signed in" mean something. Screens never navigate
 * into the application — they change auth state and the tree follows — so these
 * tests cover the switch itself.
 *
 * They render the real navigators. The point is that the customer application is
 * unreachable while unauthenticated, and asserting that against a stub would
 * prove nothing.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { authReducer, sessionAbsent, signedIn, signedOut } from '@/features/auth/state/authSlice';
import type { SessionPayload } from '@/features/auth/types';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ThemeProvider } from '@/shared/theme';

const CUSTOMER_SESSION: SessionPayload = {
  token: 'token_customer',
  user: {
    id: 'usr_1',
    firstName: 'Asha',
    lastName: 'Patel',
    phone: '9876543210',
    role: 'customer',
  },
};

const VENDOR_SESSION: SessionPayload = {
  token: 'token_vendor',
  user: {
    id: 'usr_2',
    firstName: 'Ravi',
    lastName: 'Kumar',
    phone: '9000000001',
    role: 'vendor',
  },
};

async function render() {
  const store = configureStore({ reducer: { auth: authReducer } });

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </Provider>,
    );
  });

  const dispatch = async (action: unknown) => {
    await act(async () => {
      store.dispatch(action as never);
    });
  };

  return { renderer, dispatch, text: () => textOf(renderer.toJSON()) };
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

describe('RootNavigator', () => {
  it('holds on the splash while the stored session is still being read', async () => {
    const { text } = await render();

    expect(text()).toContain('Fixora');
    expect(text()).not.toContain('Sign in');
  });

  it('shows customer sign in once no session is found', async () => {
    const { dispatch, text } = await render();

    await dispatch(sessionAbsent());

    expect(text()).toContain('Sign in');
  });

  it('swaps to the customer application when a session appears', async () => {
    const { dispatch, text } = await render();
    await dispatch(sessionAbsent());

    await dispatch(signedIn(CUSTOMER_SESSION));

    // The sign-in form is gone: the auth stack is unmounted, not merely covered.
    expect(text()).not.toContain('Sign in');
    expect(text()).toContain('Home');
  });

  it('sends a vendor to the vendor application, never the customer one', async () => {
    const { dispatch, text } = await render();
    await dispatch(sessionAbsent());

    await dispatch(signedIn(VENDOR_SESSION));

    expect(text()).toContain('Dashboard');
    expect(text()).not.toContain('Home');
  });

  it('returns to sign in when the session ends', async () => {
    const { dispatch, text } = await render();
    await dispatch(sessionAbsent());
    await dispatch(signedIn(CUSTOMER_SESSION));

    await dispatch(signedOut());

    expect(text()).toContain('Sign in');
    expect(text()).not.toContain('Home');
  });
});
