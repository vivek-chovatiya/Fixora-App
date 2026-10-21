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
import {
  NavigationContainer,
  createNavigationContainerRef,
  type NavigationState,
  type PartialState,
} from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setOnboardingStorage } from '@/core/storage/OnboardingStorage';
import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, sessionAbsent, signedIn, signedOut } from '@/features/auth/state/authSlice';
import type { SessionPayload } from '@/features/auth/types';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { setRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';
import { RootNavigator } from '@/navigation/RootNavigator';
import { registerService } from '@/shared/services/ServiceRegistry';
import type { VendorDashboardService } from '@/shared/services/types/VendorDashboardService';
import type { VendorProfileService } from '@/shared/services/types/VendorProfileService';
import { ToastProvider } from '@/shared/components';
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

/**
 * These tests are about which application is mounted, not about the
 * introduction, so onboarding is answered as already seen. Left unstubbed, the
 * gate inside AuthNavigator would hold the splash and no navigator would appear.
 */
beforeEach(() => {
  /*
    A vendor who has already set up their business, so the vendor application
    opens on its tabs. Whether setup comes first is VendorNavigator's concern
    and is tested there (Phase 3E-1).
  */
  registerService('vendorProfile', {
    getProfile: async () => ({
      vendorId: 'usr_2',
      businessName: 'Kumar Electricals',
      serviceCategoryIds: ['cat_electrical'],
      shopImageUrls: [],
      acceptingRequests: true,
      workingHours: [],
      ownerName: 'Ravi Kumar',
      phone: '9000000001',
      isSetupComplete: true,
    }),
    saveProfile: jest.fn(),
    updateShopImages: jest.fn(),
    setAcceptingRequests: jest.fn(),
    updateWorkingHours: jest.fn(),
  } as VendorProfileService);
  // The Dashboard tab's own data (Phase 3E-2); what it draws is tested there.
  registerService('vendorDashboard', {
    getDashboard: async () => ({
      counts: { pending: 0, active: 0, completed: 0 },
      pending: [],
      active: [],
      recentlyCompleted: [],
    }),
  } as VendorDashboardService);

  setOnboardingStorage({
    hasCompletedOnboarding: jest.fn(async () => true),
    setOnboardingCompleted: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  });
});

async function render() {
  const store = configureStore({ reducer: { auth: authReducer } });
  const navigation = createNavigationContainerRef();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer ref={navigation}>
              <RootNavigator />
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });

  const dispatch = async (action: unknown) => {
    await act(async () => {
      store.dispatch(action as never);
    });
  };

  /**
   * Keyed on the screen's testID rather than its copy: which navigator is
   * mounted is the assertion, and rewording a heading should not fail it.
   */
  const showsAuthEntry = () =>
    renderer.root.findAll(node => node.props.testID === 'auth-entry-screen').length > 0;

  /** Every route name any mounted navigator could navigate to. */
  const routeNames = (): string[] => {
    const names: string[] = [];
    const walk = (state: NavigationState | PartialState<NavigationState> | undefined) => {
      if (!state) {
        return;
      }
      names.push(...(state.routeNames ?? []));
      state.routes.forEach(route => walk(route.state));
    };
    walk(navigation.getRootState());
    return names;
  };

  return {
    renderer,
    dispatch,
    showsAuthEntry,
    routeNames,
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

describe('RootNavigator', () => {
  it('holds on the splash while the stored session is still being read', async () => {
    const { text } = await render();

    expect(text()).toContain('Fixora');
    expect(text()).not.toContain('Sign in');
  });

  it('shows role selection once no session is found', async () => {
    const { dispatch, text, showsAuthEntry } = await render();

    await dispatch(sessionAbsent());

    // The auth stack opens on role selection, which is what makes both
    // applications reachable.
    expect(showsAuthEntry()).toBe(true);
    expect(text()).toContain('Customer');
    expect(text()).toContain('Vendor');
  });

  it('swaps to the customer application when a session appears', async () => {
    const { dispatch, text, showsAuthEntry } = await render();
    await dispatch(sessionAbsent());

    await dispatch(signedIn(CUSTOMER_SESSION));

    // The auth stack is unmounted, not merely covered — an authenticated user is
    // never shown role selection.
    expect(showsAuthEntry()).toBe(false);
    expect(text()).toContain('Home');
  });

  it('sends a vendor to the vendor application, never the customer one', async () => {
    const { dispatch, text, showsAuthEntry } = await render();
    await dispatch(sessionAbsent());

    await dispatch(signedIn(VENDOR_SESSION));

    expect(text()).toContain('Dashboard');
    expect(text()).not.toContain('Home');
    expect(showsAuthEntry()).toBe(false);
  });

  it('decides by the session role, not by anything chosen before signing in', async () => {
    const { dispatch, text, showsAuthEntry } = await render();
    await dispatch(sessionAbsent());

    // Role selection is on screen and its only effect is navigation. What
    // actually decides the application is the role inside the session.
    expect(showsAuthEntry()).toBe(true);

    await dispatch(signedIn(VENDOR_SESSION));

    expect(text()).toContain('Dashboard');
  });

  it('returns to role selection when the session ends', async () => {
    const { dispatch, text, showsAuthEntry } = await render();
    await dispatch(sessionAbsent());
    await dispatch(signedIn(CUSTOMER_SESSION));

    await dispatch(signedOut());

    expect(showsAuthEntry()).toBe(true);
    expect(text()).not.toContain('Home');
  });

  /*
    The whole of Phase 3D-7's logout, through the real navigators: the Profile
    tab, the confirmation, and the tree following the cleared session back to
    role selection — with no screen navigating anywhere itself.
  */
  it('reaches role selection from the Profile tab once Log out is confirmed', async () => {
    const draftClear = jest.fn(async () => undefined);
    setRequestDraftStorage({
      read: async () => null,
      write: async () => true,
      clear: draftClear,
    });
    setSessionStorage({
      read: async () => null,
      write: async () => undefined,
      clear: async () => undefined,
    });

    const { renderer, dispatch, showsAuthEntry } = await render();
    await dispatch(sessionAbsent());
    await dispatch(signedIn(CUSTOMER_SESSION));

    const press = async (label: string) => {
      const [target] = renderer.root.findAll(
        node =>
          node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
      );
      if (!target) {
        throw new Error(`Nothing labelled "${label}"`);
      }
      await act(async () => {
        target.props.onPress();
      });
      await act(async () => {});
    };

    await press('Profile');
    expect(
      renderer.root.findAll(node => node.props.testID === 'customer-profile').length,
    ).toBeGreaterThan(0);

    await press(CUSTOMER_COPY.profile.logout);
    // The dialog's own button, now that it is open: the last one with the label.
    const confirms = renderer.root.findAll(
      node =>
        node.props?.accessibilityLabel === CUSTOMER_COPY.profile.logoutConfirm &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    );
    await act(async () => {
      confirms[confirms.length - 1].props.onPress();
    });
    await act(async () => {});

    expect(draftClear).toHaveBeenCalledTimes(1);
    expect(showsAuthEntry()).toBe(true);
  });

  /*
    The vendor's reviews (Phase 3E-6) exist only in the vendor application. A
    customer — or nobody — has no route to them at all, so no navigate, deep
    link or restored state can open them; the service refuses either anyway.
  */
  it('gives a customer no route to a vendor’s reviews', async () => {
    const { dispatch, routeNames } = await render();
    await dispatch(sessionAbsent());
    expect(routeNames()).not.toContain('VendorReviews');

    await dispatch(signedIn(CUSTOMER_SESSION));

    expect(routeNames()).toContain('RequestReview');
    expect(routeNames()).not.toContain('VendorReviews');
  });

  it('gives a vendor the route to their reviews', async () => {
    const { dispatch, routeNames } = await render();
    await dispatch(sessionAbsent());

    await dispatch(signedIn(VENDOR_SESSION));

    expect(routeNames()).toContain('VendorReviews');
    expect(routeNames()).not.toContain('RequestReview');
  });

  /*
    The vendor's report (section 42) likewise lives only in the vendor
    application: no session and a customer's have no route to it.
  */
  it('gives only a vendor the route to their report', async () => {
    const { dispatch, routeNames } = await render();
    await dispatch(sessionAbsent());
    expect(routeNames()).not.toContain('VendorReports');

    await dispatch(signedIn(CUSTOMER_SESSION));
    expect(routeNames()).not.toContain('VendorReports');

    await dispatch(sessionAbsent());
    await dispatch(signedIn(VENDOR_SESSION));
    expect(routeNames()).toContain('VendorReports');
  });
});
