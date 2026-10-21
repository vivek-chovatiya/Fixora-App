/**
 * The vendor dashboard (PROJECT_BIBLE.md section 30, Phase 3E-2), through the
 * real VendorNavigator and the real mock services.
 *
 * Pinned here:
 *
 * - it is where a set-up vendor lands, and it greets the right person and
 *   business
 * - while the work loads its place is held, and the greeting and the business
 *   are already there
 * - the three counts and the three previews are the service's, drawn as given
 * - an empty group says so, and offers no "See all" to an empty list
 * - a failed load says so where the work would be, and Try again reloads it —
 *   once, however often it is pressed
 * - "See all" opens the existing Requests tab; the business card opens Profile
 * - nothing on it accepts, rejects or changes a request
 * - another vendor on the same device sees their own dashboard, never this one
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
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
import type { MockDashboardScenario } from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { VendorDashboard } from '@/shared/services/types/VendorDashboardService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = VENDOR_COPY.dashboard;
const JOB = VENDOR_COPY.job;

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const MEENA: AuthUser = {
  id: 'usr_vendor_2',
  firstName: 'Meena',
  lastName: 'Iyer',
  email: 'meena.iyer@example.com',
  phone: '9000000002',
  role: 'vendor',
};

const CATEGORIES = [
  { id: 'cat_electrician', name: 'Electrician' },
  { id: 'cat_plumber', name: 'Plumber' },
];

/** Eighty characters: the longest business name the profile accepts. */
const LONG_NAME = 'Kumar & Sons Electrical Contractors and Appliance Repair Specialists, Bengaluru'.padEnd(
  80,
  '.',
);

/** Which fixture each vendor gets in this suite. Ravi has work; Meena has none. */
let scenarios: Record<string, MockDashboardScenario>;
let current: AuthUser;
let profiles: MockVendorProfileService;
let dashboards: MockVendorDashboardService;

beforeEach(async () => {
  resetServices();
  current = RAVI;
  scenarios = { [RAVI.id]: 'mixed', [MEENA.id]: 'empty' };

  profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser: async () => current });
  dashboards = new MockVendorDashboardService({
    latency: NO_LATENCY,
    currentUser: async () => current,
    scenarioFor: vendorId => scenarios[vendorId] ?? 'empty',
  });
  registerService('vendorProfile', profiles);
  registerService('vendorDashboard', dashboards);
  // Where "See all" leads since Phase 3E-3; the list itself has its own suite.
  registerService(
    'vendorRequests',
    new MockVendorRequestService({
      latency: NO_LATENCY,
      currentUser: async () => current,
      scenarioFor: vendorId => scenarios[vendorId] ?? 'empty',
    }),
  );
  registerService('category', {
    listServiceCategories: jest.fn(async () => CATEGORIES),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  setSessionStorage({
    read: async () => ({ token: 'token', user: current }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  // Both vendors have finished setup: this suite is about what comes after it.
  await profiles.saveProfile({
    businessName: 'Kumar Electricals',
    serviceCategoryIds: ['cat_electrician', 'cat_plumber'],
    serviceArea: { description: 'Koramangala and HSR Layout' },
  });
  current = MEENA;
  await profiles.saveProfile({ businessName: 'Iyer Interiors', serviceCategoryIds: ['cat_plumber'] });
  current = RAVI;
});

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

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {});
  }
}

async function render({ settle = true }: { settle?: boolean } = {}) {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: current }));

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
  if (settle) {
    await flush();
  }

  const all = (id: string) => renderer.root.findAll(node => node.props?.testID === id);
  const has = (id: string) => all(id).length > 0;

  /** Host nodes only, so one drawn element is counted once. */
  const hosts = (match: (id: string) => boolean) =>
    renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props?.testID === 'string' &&
        match(node.props.testID),
    );

  const labelled = (label: string) =>
    renderer.root.findAll(node => node.props?.accessibilityLabel === label);

  const pressable = (label: string) =>
    labelled(label).filter(node => typeof node.props?.onPress === 'function');

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

  const switchTo = async (user: AuthUser) => {
    current = user;
    await act(async () => {
      store.dispatch(signedIn({ token: 'token', user }));
    });
    await flush();
  };

  const textIn = (id: string) => {
    const [node] = hosts(testID => testID === id);
    return node ? textOf(renderer.toJSON()) && textOfInstance(node) : '';
  };

  return {
    renderer,
    has,
    hosts,
    labelled,
    pressable,
    press,
    switchTo,
    textIn,
    flush,
    text: () => textOf(renderer.toJSON()),
    jobCards: (section: string) => hosts(id => id.startsWith(`dashboard-${section}-job-`)),
  };
}

/** The text drawn inside one rendered element. */
function textOfInstance(node: ReactTestRenderer.ReactTestInstance): string {
  return node.children
    .map(child => (typeof child === 'string' ? child : textOfInstance(child)))
    .join(' ');
}

const count = (screen: Awaited<ReturnType<typeof render>>, id: string) =>
  screen.textIn(`dashboard-stat-${id}-count`).trim();

describe('Vendor dashboard — landing and identity', () => {
  it('is where a set-up vendor lands, with no setup in the way', async () => {
    const screen = await render();

    expect(screen.has('vendor-dashboard')).toBe(true);
    expect(screen.has('vendor-profile-setup')).toBe(false);
  });

  it('greets the owner by first name, as one phrase', async () => {
    const screen = await render();

    const greeting = screen.hosts(id => id === 'dashboard-greeting')[0];
    expect(greeting.props.accessibilityLabel).toMatch(/^Good (morning|afternoon|evening), Ravi$/);
  });

  it('shows the business from the profile: name, services by name, and area', async () => {
    const screen = await render();

    const card = screen.pressable(
      'Kumar Electricals. Services: Electrician, Plumber. Service area: Koramangala and HSR Layout',
    );
    expect(card.length).toBeGreaterThan(0);
    expect(card[0].props.accessibilityHint).toBe(COPY.businessHint);
  });

  it('leaves out services and area the profile does not have, rather than showing blanks', async () => {
    current = MEENA;
    const screen = await render();

    expect(screen.pressable('Iyer Interiors. Services: Plumber').length).toBeGreaterThan(0);
    expect(screen.text()).not.toContain(COPY.businessAreaLabel);
  });

  it('keeps a very long business name whole for a screen reader and to two lines on screen', async () => {
    await profiles.saveProfile({ businessName: LONG_NAME, serviceCategoryIds: ['cat_electrician'] });
    const screen = await render();

    const [name] = screen.hosts(id => id === 'dashboard-business-name');
    expect(textOfInstance(name)).toBe(LONG_NAME);
    expect(name.props.numberOfLines).toBe(2);
    expect(screen.pressable(`${LONG_NAME}. Services: Electrician`).length).toBeGreaterThan(0);
  });
});

describe('Vendor dashboard — loading', () => {
  it('holds the place of the work while it loads, with the vendor already on screen', async () => {
    let finish!: (dashboard: VendorDashboard) => void;
    jest
      .spyOn(dashboards, 'getDashboard')
      .mockImplementationOnce(() => new Promise<VendorDashboard>(resolve => (finish = resolve)));

    const screen = await render();

    expect(screen.has('dashboard-loading')).toBe(true);
    expect(screen.labelled(COPY.loading).length).toBeGreaterThan(0);
    // Not blank: the greeting and the business need nothing from this call.
    expect(screen.has('dashboard-greeting')).toBe(true);
    expect(screen.has('dashboard-business')).toBe(true);
    expect(screen.has('dashboard-overview')).toBe(false);

    await act(async () => {
      finish({
        counts: { pending: 1, active: 0, completed: 0 },
        pending: [],
        active: [],
        recentlyCompleted: [],
      });
    });
    await screen.flush();

    expect(screen.has('dashboard-loading')).toBe(false);
    expect(screen.has('dashboard-overview')).toBe(true);
  });

  it('asks the service for a short preview, not a page', async () => {
    const getDashboard = jest.spyOn(dashboards, 'getDashboard');
    await render();

    expect(getDashboard).toHaveBeenCalledTimes(1);
    expect(getDashboard).toHaveBeenCalledWith(3);
  });
});

describe('Vendor dashboard — a vendor with work', () => {
  it('shows the whole count of each group', async () => {
    const screen = await render();

    expect(count(screen, 'pending')).toBe('4');
    expect(count(screen, 'active')).toBe('2');
    expect(count(screen, 'completed')).toBe('5');
  });

  it('says what each number counts to a screen reader', async () => {
    const screen = await render();

    expect(screen.labelled(COPY.pendingSpoken(4)).length).toBeGreaterThan(0);
    expect(screen.labelled(COPY.activeSpoken(2)).length).toBeGreaterThan(0);
    expect(screen.labelled(COPY.completedSpoken(5)).length).toBeGreaterThan(0);
  });

  it('previews the waiting requests, named by how they arrived', async () => {
    const screen = await render();

    expect(screen.jobCards('pending')).toHaveLength(3);
    const text = screen.text();
    expect(text).toContain('Switchboard repair');
    expect(text).toContain(JOB.statusBroadcast);
    expect(text).toContain(JOB.statusDirected);
    // The fourth waiting request is counted but not previewed.
    expect(text).not.toContain('Light fitting replacement');
  });

  it('previews the work under way, telling accepted from in progress', async () => {
    const screen = await render();

    expect(screen.jobCards('active')).toHaveLength(2);
    expect(screen.text()).toContain(JOB.statusInProgress);
    expect(screen.text()).toContain(JOB.statusAccepted);
  });

  it('previews the latest finished work, dated by when it finished', async () => {
    const screen = await render();

    expect(screen.jobCards('completed')).toHaveLength(3);
    expect(screen.text()).toContain('Geyser wiring');
    expect(screen.text()).toContain(`${JOB.completedLabel} 1 day ago`);
  });

  it('reads a whole job as one sentence, with its urgency in words', async () => {
    const screen = await render();

    const spoken = screen
      .labelled(
        `Switchboard repair. ${JOB.statusLabel}: ${JOB.statusBroadcast}. ${JOB.customerLabel}: Asha Patel, Koramangala. ${JOB.priorityLabel}: Emergency. ${JOB.raisedLabel} 12 min ago. ${JOB.referencePrefix} REQ-31042`,
      );
    expect(spoken.length).toBeGreaterThan(0);
  });

  it('copes with a job the backend gave no locality for', async () => {
    scenarios[RAVI.id] = 'pendingOnly';
    jest
      .spyOn(dashboards, 'getDashboard')
      .mockImplementationOnce(async () => {
        const all = await new MockVendorDashboardService({
          latency: NO_LATENCY,
          currentUser: async () => current,
          scenarioFor: () => 'pendingOnly',
        }).getDashboard(50);
        return { ...all, pending: all.pending.slice(3) };
      });
    const screen = await render();

    expect(screen.text()).toContain('Neha Sharma');
    expect(screen.text()).not.toContain('Neha Sharma ·');
    expect(screen.text()).toContain(JOB.statusNew);
  });

  it('offers nothing that accepts, rejects or changes a request', async () => {
    const screen = await render();

    const dashboard = screen.renderer.root.findAll(node => node.props?.testID === 'vendor-dashboard')[0];
    const labels = dashboard
      .findAll(node => typeof node.props?.onPress === 'function')
      .map(node => String(node.props.accessibilityLabel ?? ''));

    expect(labels.join(' | ')).not.toMatch(/accept|reject|start|complete work/i);
    // The job cards themselves are not buttons.
    for (const card of screen.jobCards('pending')) {
      expect(card.props.onPress).toBeUndefined();
    }
  });
});

describe('Vendor dashboard — empty', () => {
  it('shows zeros and an empty state for every group when there is no work', async () => {
    current = MEENA;
    const screen = await render();

    expect(count(screen, 'pending')).toBe('0');
    expect(count(screen, 'active')).toBe('0');
    expect(count(screen, 'completed')).toBe('0');
    expect(screen.has('dashboard-pending-empty')).toBe(true);
    expect(screen.has('dashboard-active-empty')).toBe(true);
    expect(screen.has('dashboard-completed-empty')).toBe(true);
    expect(screen.text()).toContain(COPY.pendingEmptyTitle);
    expect(screen.text()).toContain(COPY.pendingEmptyMessage);
    expect(screen.has('dashboard-error')).toBe(false);
  });

  it('offers no "See all" into a group with nothing in it', async () => {
    current = MEENA;
    const screen = await render();

    expect(screen.pressable(COPY.seeAllPendingSpoken)).toHaveLength(0);
    expect(screen.pressable(COPY.seeAllActiveSpoken)).toHaveLength(0);
    expect(screen.pressable(COPY.seeAllCompletedSpoken)).toHaveLength(0);
  });

  it.each<[MockDashboardScenario, string, string[]]>([
    ['pendingOnly', 'pending', ['active', 'completed']],
    ['activeOnly', 'active', ['pending', 'completed']],
    ['completedOnly', 'completed', ['pending', 'active']],
  ])('draws a dashboard with %s: that group filled, the others empty', async (scenario, filled, empty) => {
    scenarios[RAVI.id] = scenario;
    const screen = await render();

    expect(screen.jobCards(filled).length).toBeGreaterThan(0);
    expect(screen.has(`dashboard-${filled}-empty`)).toBe(false);
    for (const group of empty) {
      expect(screen.has(`dashboard-${group}-empty`)).toBe(true);
      expect(screen.jobCards(group)).toHaveLength(0);
    }
  });
});

describe('Vendor dashboard — failure and retry', () => {
  it('says the work could not be loaded, where the work would be, and keeps the rest', async () => {
    jest
      .spyOn(dashboards, 'getDashboard')
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'offline' }));
    const screen = await render();

    expect(screen.has('dashboard-error')).toBe(true);
    expect(screen.text()).toContain(COPY.failedTitle);
    // Never the service's own words.
    expect(screen.text()).not.toContain('offline');
    expect(screen.has('dashboard-business')).toBe(true);
    expect(screen.has('dashboard-overview')).toBe(false);
  });

  it('loads the dashboard when Try again is pressed', async () => {
    jest
      .spyOn(dashboards, 'getDashboard')
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'offline' }));
    const screen = await render();

    await screen.press('Try again');

    expect(screen.has('dashboard-error')).toBe(false);
    expect(count(screen, 'pending')).toBe('4');
  });

  it('retries once, however often Try again is pressed', async () => {
    const getDashboard = jest
      .spyOn(dashboards, 'getDashboard')
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'offline' }));
    const screen = await render();
    expect(getDashboard).toHaveBeenCalledTimes(1);

    const [retry] = screen.pressable('Try again');
    await act(async () => {
      retry.props.onPress();
      retry.props.onPress();
      retry.props.onPress();
    });
    await screen.flush();

    expect(getDashboard).toHaveBeenCalledTimes(2);
    expect(count(screen, 'pending')).toBe('4');
  });

  it('can be retried again after a second failure', async () => {
    const getDashboard = jest
      .spyOn(dashboards, 'getDashboard')
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'offline' }))
      .mockRejectedValueOnce(new AppError({ kind: 'server', message: 'down' }));
    const screen = await render();

    await screen.press('Try again');
    expect(screen.has('dashboard-error')).toBe(true);

    await screen.press('Try again');
    expect(getDashboard).toHaveBeenCalledTimes(3);
    expect(screen.has('dashboard-error')).toBe(false);
  });
});

describe('Vendor dashboard — where it leads', () => {
  it.each([COPY.seeAllPendingSpoken, COPY.seeAllActiveSpoken, COPY.seeAllCompletedSpoken])(
    'opens the existing Requests tab from "%s"',
    async label => {
      const screen = await render();
      expect(screen.has('vendor-requests')).toBe(false);

      await screen.press(label);

      // The request list (Phase 3E-3), in the tab that was already there.
      expect(screen.has('vendor-requests')).toBe(true);
    },
  );

  it('opens the Profile tab from the business card', async () => {
    const screen = await render();
    expect(screen.has('vendor-profile')).toBe(false);

    await screen.press(
      'Kumar Electricals. Services: Electrician, Plumber. Service area: Koramangala and HSR Layout',
    );

    expect(screen.has('vendor-profile')).toBe(true);
  });
});

describe('Vendor dashboard — whose dashboard', () => {
  it('shows another vendor their own dashboard, and the first theirs again', async () => {
    const screen = await render();
    expect(count(screen, 'pending')).toBe('4');
    expect(screen.text()).toContain('Switchboard repair');

    await screen.switchTo(MEENA);

    expect(count(screen, 'pending')).toBe('0');
    expect(screen.text()).not.toContain('Switchboard repair');
    expect(screen.text()).not.toContain('Kumar Electricals');
    expect(screen.pressable('Iyer Interiors. Services: Plumber').length).toBeGreaterThan(0);

    await screen.switchTo(RAVI);

    expect(count(screen, 'pending')).toBe('4');
    expect(screen.text()).toContain('Switchboard repair');
    expect(screen.text()).not.toContain('Iyer Interiors');
  });
});
