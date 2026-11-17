/**
 * The vendor's request list, read again when it is shown again (owner
 * decision, 21/10/2026, Phase 3E-15), through the real VendorNavigator and the
 * real mock services.
 *
 * Section 31.2: broadcast leads go stale, and a list that changed only when
 * pulled kept showing ones that may already be gone. Pinned here:
 *
 * - arriving on the tab reads once — the mount's read, not a second
 * - coming back to it, from another tab or from a request's details, reads
 *   exactly once more, whatever else has happened
 * - quietly: no placeholders, no spinner, the chosen filter and the cards kept
 *   until the answer, which then replaces them
 * - never beside a read already out, however often the tab is shown meanwhile
 * - a quiet read that fails keeps the cards and raises the list's own notice,
 *   as a failed pull does — never the error page, never a toast
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { VendorNavigator } from '@/navigation/VendorNavigator';
import { ToastProvider } from '@/shared/components';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { VendorRequestList } from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = VENDOR_COPY.requests;
const DETAILS = VENDOR_COPY.requestDetails;

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const offline = () => new AppError({ kind: 'network', message: 'offline' });

let requests: MockVendorRequestService;

beforeEach(async () => {
  resetServices();
  const currentUser = async () => RAVI;
  const scenarioFor = () => 'mixed' as const;

  const profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  requests = new MockVendorRequestService({ latency: NO_LATENCY, currentUser, scenarioFor });
  registerService('vendorProfile', profiles);
  registerService('vendorRequests', requests);
  registerService(
    'vendorDashboard',
    new MockVendorDashboardService({ latency: NO_LATENCY, currentUser, scenarioFor }),
  );
  registerService('category', {
    listServiceCategories: jest.fn(async () => [{ id: 'cat_electrician', name: 'Electrician' }]),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  setSessionStorage({
    read: async () => ({ token: 'token', user: RAVI }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });
});

type Instance = ReactTestRenderer.ReactTestInstance;

/* Unmounted after every test: switching tabs leaves work scheduled. */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {});
  }
}

/** A promise the test settles when it chooses. */
function held<T>() {
  let land!: (value: T) => void;
  const promise = new Promise<T>(resolve => {
    land = resolve;
  });
  return { promise, land };
}

/** Renders the vendor application and opens the Requests tab. */
async function render() {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: RAVI }));

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer>
              <VendorNavigator />
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);
  await flush();

  const hosts = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);
  const has = (id: string) => hosts(id).length > 0;

  const pressable = (label: string) =>
    renderer.root
      .findAll(node => node.props?.accessibilityLabel === label)
      .filter(node => typeof node.props?.onPress === 'function');

  const press = async (label: string) => {
    const [target] = pressable(label);
    if (!target) {
      throw new Error(`Nothing pressable labelled "${label}"`);
    }
    await act(async () => {
      target.props.onPress();
    });
    await flush();
  };

  const list = (): Instance =>
    renderer.root.findAll(
      node => node.props?.testID === 'vendor-requests-list' && 'data' in (node.props ?? {}),
    )[0];

  const screen = {
    has,
    hosts,
    press,
    list,
    /** The cards the list holds, by reference, read from its data. */
    cards: (): string[] =>
      (list().props.data as Array<{ kind: string; job?: { id: string } }>)
        .filter(line => line.kind === 'request')
        .map(line => String(line.job?.id)),
    selected: (label: string) =>
      pressable(label).some(node => node.props.accessibilityState?.selected === true),
    /** Leaves for another tab and comes back, as a vendor does. */
    leaveAndReturn: async (away = 'Dashboard') => {
      await press(away);
      await press('Requests');
    },
    openCard: async (reference: string) => {
      const [card] = renderer.root.findAll(
        node =>
          node.props?.testID === `vendor-request-${reference}` &&
          node.props?.accessibilityRole === 'button' &&
          typeof node.props?.onPress === 'function',
      );
      await act(async () => {
        card.props.onPress();
      });
      await flush();
    },
    /** The testIDs on the list screen that say they are busy. */
    busy: (): Array<string | undefined> =>
      hosts('vendor-requests')[0]
        .findAll(node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true)
        .map(node => node.props.testID),
  };

  await screen.press('Requests');
  return screen;
}

describe('Vendor requests — shown again (Phase 3E-15)', () => {
  it('reads once on arrival: the mount’s read and no other', async () => {
    const listRequests = jest.spyOn(requests, 'listRequests');
    await render();

    expect(listRequests).toHaveBeenCalledTimes(1);
  });

  it('reads exactly once more each time the tab is shown again', async () => {
    const listRequests = jest.spyOn(requests, 'listRequests');
    const screen = await render();

    await screen.leaveAndReturn();
    expect(listRequests).toHaveBeenCalledTimes(2);

    await screen.leaveAndReturn('Profile');
    expect(listRequests).toHaveBeenCalledTimes(3);
  });

  it('reads once more on coming back from a request’s details', async () => {
    const listRequests = jest.spyOn(requests, 'listRequests');
    const screen = await render();

    await screen.openCard('REQ-31042');
    expect(screen.has('vendor-request-details')).toBe(true);
    await screen.press(DETAILS.back);

    expect(screen.has('vendor-requests')).toBe(true);
    expect(listRequests).toHaveBeenCalledTimes(2);
  });

  it('reads quietly: the filter, the cards, no placeholders and no spinner, until the answer', async () => {
    const screen = await render();
    await screen.press(COPY.filterPending);
    const before = screen.cards();
    expect(before.length).toBeGreaterThan(0);

    const real = await new MockVendorRequestService({
      latency: NO_LATENCY,
      currentUser: async () => RAVI,
      scenarioFor: () => 'mixed',
    }).listRequests();
    const answer = held<VendorRequestList>();
    jest.spyOn(requests, 'listRequests').mockReturnValueOnce(answer.promise);

    await screen.leaveAndReturn();

    expect(screen.selected(COPY.filterPending)).toBe(true);
    expect(screen.cards()).toEqual(before);
    expect(screen.busy()).toEqual([]);
    expect(screen.list().props.refreshing).toBe(false);

    // One request has gone — another professional took it — while the vendor was away.
    await act(async () => {
      answer.land({ ...real, pending: real.pending.slice(1) });
    });
    await flush();

    expect(screen.selected(COPY.filterPending)).toBe(true);
    expect(screen.cards()).toEqual(before.slice(1));
  });

  it('sends no second read while one is still out, however often the tab is shown', async () => {
    const screen = await render();
    const answer = held<VendorRequestList>();
    const listRequests = jest.spyOn(requests, 'listRequests').mockReturnValueOnce(answer.promise);

    await screen.leaveAndReturn();
    await screen.leaveAndReturn();
    await screen.leaveAndReturn('Profile');

    expect(listRequests).toHaveBeenCalledTimes(1);
  });

  it('keeps the cards when a quiet read fails, and raises the list’s own notice', async () => {
    const screen = await render();
    const before = screen.cards();
    jest.spyOn(requests, 'listRequests').mockRejectedValueOnce(offline());

    await screen.leaveAndReturn();

    expect(screen.cards()).toEqual(before);
    expect(screen.has('vendor-requests-error')).toBe(false);
    expect(screen.has('vendor-requests-stale')).toBe(true);
  });
});
