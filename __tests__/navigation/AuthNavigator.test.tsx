/**
 * The authentication stack's shape, asserted directly.
 *
 * Two things are worth pinning here rather than discovering later. Every screen
 * a user must reach is registered — a route that exists in the type but has no
 * screen fails at runtime, in front of someone. And no recovery route exists,
 * which is deliberate: the backend has no operation that could safely back one.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { authReducer } from '@/features/auth/state/authSlice';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import { configureServices, resetServices } from '@/shared/services/ServiceRegistry';
import { ToastProvider } from '@/shared/components';
import { ThemeProvider } from '@/shared/theme';

/** Every route the stack registers, in order. */
function registeredRoutes(): string[] {
  const element = AuthNavigator() as React.ReactElement<{ children: React.ReactNode }>;

  return React.Children.toArray(element.props.children)
    .map(child => (child as React.ReactElement<{ name: string }>).props.name)
    .filter(Boolean);
}

afterEach(() => {
  resetServices();
});

describe('AuthNavigator', () => {
  it('registers exactly the approved routes, and nothing else', () => {
    // Asserted exactly rather than loosely: an extra route is as much a defect
    // as a missing one — it is a screen someone can reach that nobody agreed to.
    expect(registeredRoutes()).toEqual([
      'AuthEntry',
      'CustomerLogin',
      'CustomerOtp',
      'VendorLogin',
      'VendorRegistration',
      'VendorOtp',
    ]);
  });

  it('has no customer signup route: verifying a phone is what creates the account', () => {
    const routes = registeredRoutes();

    expect(routes).not.toContain('Signup');
    expect(routes).not.toContain('CustomerSignup');
    expect(routes).not.toContain('Register');
  });

  it('opens on role selection, so both applications are reachable', async () => {
    configureServices();
    const store = configureStore({ reducer: { auth: authReducer } });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <Provider store={store}>
          <ThemeProvider>
            <ToastProvider>
              <NavigationContainer>
                <AuthNavigator />
              </NavigationContainer>
            </ToastProvider>
          </ThemeProvider>
        </Provider>,
      );
    });

    expect(renderer.root.findByProps({ testID: 'auth-entry-screen' })).toBeDefined();
  });

  it('has no auth code route: the credential never travels between screens', () => {
    const routes = registeredRoutes();

    // Display and confirmation are states inside VendorOtp. Separate routes
    // would mean handing a standing credential through navigation.
    expect(routes).not.toContain('VendorAuthCode');
    expect(routes).not.toContain('VendorAuthCodeConfirmation');
  });

  it('has no recovery route, because no backend operation can safely back one', () => {
    const routes = registeredRoutes();

    // `regenerateVendorAuthCode` is keyed by a registrationId a returning vendor
    // does not have. Phone-only regeneration would make a lost phone an account
    // takeover, so this stays absent until the backend offers something better.
    expect(routes).not.toContain('VendorRecovery');
    expect(routes).not.toContain('ForgotAuthCode');
    expect(routes).not.toContain('ForgotPassword');
  });
});
