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
import {
  NavigationContainer,
  type NavigationContainerRef,
} from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setOnboardingStorage } from '@/core/storage/OnboardingStorage';
import { authReducer } from '@/features/auth/state/authSlice';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import { configureServices, resetServices } from '@/shared/services/ServiceRegistry';
import { ToastProvider } from '@/shared/components';
import { ThemeProvider } from '@/shared/theme';

type Routes = Record<string, never>;

/**
 * Renders the real stack and reports what it registered.
 *
 * Read from navigation state rather than by inspecting the returned element,
 * which is no longer possible: the navigator asks whether onboarding has been
 * seen, and a component with a hook cannot be called as a plain function. This
 * is the truer question anyway — what React Navigation ended up with, not what
 * the JSX looked like on the way there.
 */
async function renderStack(hasCompletedOnboarding: boolean) {
  setOnboardingStorage({
    hasCompletedOnboarding: jest.fn(async () => hasCompletedOnboarding),
    setOnboardingCompleted: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  });

  configureServices();

  const store = configureStore({ reducer: { auth: authReducer } });
  const navigation = React.createRef<NavigationContainerRef<Routes>>();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer ref={navigation}>
              <AuthNavigator />
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });

  const state = navigation.current?.getRootState();

  return {
    renderer,
    routes: [...(state?.routeNames ?? [])],
    openedOn: state?.routes[state.index]?.name,
    shows: (testID: string) =>
      renderer.root.findAll(node => node.props.testID === testID).length > 0,
  };
}

/** Route names alone, for the shape assertions. */
async function registeredRoutes(): Promise<string[]> {
  return (await renderStack(true)).routes;
}

afterEach(() => {
  resetServices();
});

describe('AuthNavigator', () => {
  it('registers exactly the approved routes, and nothing else', async () => {
    // Asserted exactly rather than loosely: an extra route is as much a defect
    // as a missing one — it is a screen someone can reach that nobody agreed to.
    expect(await registeredRoutes()).toEqual([
      'Onboarding',
      'AuthEntry',
      'CustomerLogin',
      'CustomerOtp',
      'VendorLogin',
      'VendorRegistration',
      'VendorOtp',
    ]);
  });

  it('has no customer signup route: verifying a phone is what creates the account', async () => {
    const routes = await registeredRoutes();

    expect(routes).not.toContain('Signup');
    expect(routes).not.toContain('CustomerSignup');
    expect(routes).not.toContain('Register');
  });

  it('opens on role selection once the introduction has been seen', async () => {
    const { openedOn, shows } = await renderStack(true);

    expect(openedOn).toBe('AuthEntry');
    expect(shows('auth-entry-screen')).toBe(true);
    expect(shows('onboarding-screen')).toBe(false);
  });

  it('opens on the introduction when it has not been seen', async () => {
    const { openedOn, shows } = await renderStack(false);

    expect(openedOn).toBe('Onboarding');
    expect(shows('onboarding-screen')).toBe(true);
    // Role selection is registered either way; it is simply not where the stack
    // opened, so nothing about it has been rendered yet.
    expect(shows('auth-entry-screen')).toBe(false);
  });

  it('has no auth code route: the credential never travels between screens', async () => {
    const routes = await registeredRoutes();

    // Display and confirmation are states inside VendorOtp. Separate routes
    // would mean handing a standing credential through navigation.
    expect(routes).not.toContain('VendorAuthCode');
    expect(routes).not.toContain('VendorAuthCodeConfirmation');
  });

  it('has no recovery route, because no backend operation can safely back one', async () => {
    const routes = await registeredRoutes();

    // `regenerateVendorAuthCode` is keyed by a registrationId a returning vendor
    // does not have. Phone-only regeneration would make a lost phone an account
    // takeover, so this stays absent until the backend offers something better.
    expect(routes).not.toContain('VendorRecovery');
    expect(routes).not.toContain('ForgotAuthCode');
    expect(routes).not.toContain('ForgotPassword');
  });
});
