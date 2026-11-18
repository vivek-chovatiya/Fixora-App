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
 *
 * Since Phase 3E-15 (owner approval, 21/10/2026):
 *
 * - section 30's Today's Requests and Rating, each from the service that
 *   already had it (`getReport('today')`, `getVendorReviews()`), drawn as given:
 *   the rating as stars, average and "N reviews", or "No reviews yet" — never
 *   "0.0" — and a tap on it opens Reviews
 * - each loads and fails on its own: its own placeholder, its own small failure
 *   and its own Try again, which reads that figure once however often it is
 *   pressed; the work and the other figure are never held back or blanked
 * - a pull reads everything on the page, the bell's count included; a failed
 *   one keeps what is on screen and says so once, for the page
 * - showing the tab again reads quietly — once, not on arrival, never beside a
 *   read already out, with no placeholders and no spinner — and a quiet read
 *   that fails keeps what is on screen
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { VendorNavigator } from '@/navigation/VendorNavigator';
import { ToastProvider } from '@/shared/components';
import { MockReviewService } from '@/shared/services/mock/MockReviewService';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorReportService } from '@/shared/services/mock/MockVendorReportService';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import type { MockDashboardScenario } from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { NotificationService, UnreadLowerBound } from '@/shared/services/types/NotificationService';
import type { RequestService } from '@/shared/services/types/RequestService';
import type { VendorReviews } from '@/shared/services/types/ReviewService';
import type { VendorDashboard } from '@/shared/services/types/VendorDashboardService';
import type { VendorReport } from '@/shared/services/types/VendorReportService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider, spacing } from '@/shared/theme';
import { typographyVariants } from '@/shared/theme/typography';

const COPY = VENDOR_COPY.dashboard;
const JOB = VENDOR_COPY.job;
const REVIEWS = VENDOR_COPY.reviews;
const BELL = NOTIFICATIONS_COPY.bell;

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
/** Section 30's Today's Requests comes from here (Phase 3E-15). */
let reports: MockVendorReportService;
/** And its Rating from here. */
let reviews: MockReviewService;
/** The bell's count: a number the suite can count reads of. */
let unreadCount: jest.Mock<Promise<number | UnreadLowerBound>, []>;

/** Unmounted after every test: a tree left loading keeps its placeholders animating. */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

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

  reports = new MockVendorReportService({ latency: NO_LATENCY, currentUser: async () => current });
  registerService('vendorReports', reports);
  reviews = new MockReviewService({
    // The vendor's side never reads a customer's request.
    requests: {
      getRequest: jest.fn(() => {
        throw new Error('getRequest must never be called for a vendor’s reviews');
      }),
    } as Pick<RequestService, 'getRequest'>,
    latency: NO_LATENCY,
    currentUser: async () => current,
  });
  registerService('review', reviews);
  unreadCount = jest.fn(async (): Promise<number | UnreadLowerBound> => 3);
  registerService('notification', { getUnreadCount: unreadCount } as unknown as NotificationService);

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
  mounted.push(renderer);
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

  /** The dashboard's own pull — not the Requests list's, once that tab has been opened. */
  const pullControl = () =>
    hosts(testID => testID === 'vendor-dashboard')[0].findAll(
      node => typeof node.props?.onRefresh === 'function' && 'refreshing' in node.props,
    )[0];

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
    pullControl,
    pull: async () => {
      await act(async () => {
        pullControl().props.onRefresh();
      });
      await flush();
    },
    /** Leaves for another tab and comes back, as a vendor does. */
    leaveAndReturn: async (away = 'Requests') => {
      await press(away);
      await press('Dashboard');
    },
    /**
     * The one node a figure is to a screen reader: the card itself when it is
     * a button (the rating), otherwise the one accessible block inside it.
     */
    figure: (id: string) => {
      const [card] = hosts(testID => testID === id);
      if (!card) {
        return undefined;
      }
      return card.props.accessibilityRole === 'button'
        ? card
        : card.findAll(node => typeof node.type === 'string' && node.props?.accessible === true)[0];
    },
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

    // Waiting for the vendor: the area where a held job names the customer (21/10/2026).
    const spoken = screen
      .labelled(
        `Switchboard repair. ${JOB.statusLabel}: ${JOB.statusBroadcast}. ${JOB.areaLabel}: Koramangala. ${JOB.priorityLabel}: Emergency. ${JOB.raisedLabel} 12 min ago. ${JOB.referencePrefix} REQ-31042`,
      );
    expect(spoken.length).toBeGreaterThan(0);
  });

  /*
    Owner decision, 21/10/2026: a request waiting for the vendor shows its area
    and never its customer's name — drawn or said. Work the vendor holds still
    names the customer.
  */
  it('never draws or says a waiting request’s customer, and still names the customer of held work', async () => {
    const screen = await render();

    const root = screen.renderer.root;
    const everything = [
      screen.text(),
      ...root
        .findAll(node => typeof node.type === 'string')
        .map(node => node.props?.accessibilityLabel)
        .filter((value): value is string => typeof value === 'string'),
    ].join('\n');

    for (const name of [
      'Asha Patel',
      'Rahul Menon',
      'Venkata Subrahmanya Lakshmi Narasimhamurthy-Ramachandran',
      'Neha Sharma',
    ]) {
      expect(everything).not.toContain(name);
    }
    expect(everything).toContain(`${JOB.areaLabel}: HSR Layout`);
    expect(everything).toContain(`${JOB.customerLabel}: Imran Sheikh, BTM Layout`);
    expect(everything).toContain(`${JOB.customerLabel}: Karthik Iyer, HSR Layout`);
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

    // Waiting, with no area either: neither line, and nothing said in their place.
    expect(screen.text()).toContain('Light fitting replacement');
    expect(screen.text()).not.toContain('Neha Sharma');
    expect(screen.text()).toContain(JOB.statusNew);
    expect(
      screen.labelled(
        `Light fitting replacement. ${JOB.statusLabel}: ${JOB.statusNew}. ${JOB.priorityLabel}: Low. ${JOB.raisedLabel} 9 hr ago. ${JOB.referencePrefix} REQ-30987`,
      ).length,
    ).toBeGreaterThan(0);
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

/** A promise the test settles when it chooses. */
function held<T>() {
  let land!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    land = resolve;
    fail = reject;
  });
  return { promise, land, fail };
}

const offline = () => new AppError({ kind: 'network', message: 'offline' });

/** Ravi's real figures for today, from a service nobody spies on. */
const todayFor = (user: AuthUser) =>
  new MockVendorReportService({ currentUser: async () => user }).getReport('today');

const workOf = (pending: number): VendorDashboard => ({
  counts: { pending, active: 0, completed: 0 },
  pending: [],
  active: [],
  recentlyCompleted: [],
});

describe('Vendor dashboard — today and rating (section 30, Phase 3E-15)', () => {
  it('shows today’s requests from today’s report, said as what it counts', async () => {
    const getReport = jest.spyOn(reports, 'getReport');
    const screen = await render();

    expect(getReport.mock.calls).toEqual([['today']]);
    expect(screen.textIn('dashboard-today-value').trim()).toBe('4');
    expect(screen.textIn('dashboard-today-label').trim()).toBe(COPY.todayLabel);
    expect(screen.figure('dashboard-today')?.props.accessibilityLabel).toBe("Today's requests, 4");
    expect(screen.figure('dashboard-today')?.props.accessibilityRole).toBe('text');
  });

  it('shows the rating as stars, average and how many reviews, said as one sentence', async () => {
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews');
    const screen = await render();

    expect(getVendorReviews).toHaveBeenCalledTimes(1);
    expect(screen.textIn('dashboard-rating-value').trim()).toBe('4.3');
    expect(screen.textIn('dashboard-rating-label').trim()).toBe('4 reviews');
    const rating = screen.figure('dashboard-rating');
    expect(rating?.props.accessibilityLabel).toBe('Rating 4.3 out of 5, based on 4 reviews.');
    expect(rating?.props.accessibilityHint).toBe(COPY.ratingHint);
    // The shared stars, four filled, inside the card's hidden part: the rating is said once.
    const [card] = screen.hosts(id => id === 'dashboard-rating');
    const stars = card.findAll(
      node =>
        typeof node.type === 'string' && node.props?.accessibilityLabel === 'Rating: 4 out of 5 stars',
    );
    expect(stars).toHaveLength(1);
    expect(
      card.findAll(node => node.props?.importantForAccessibility === 'no-hide-descendants').length,
    ).toBeGreaterThan(0);
  });

  it('says "No reviews yet" for a vendor nobody has reviewed — never 0.0', async () => {
    current = MEENA;
    const screen = await render();

    expect(screen.has('dashboard-rating-value')).toBe(false);
    expect(screen.textIn('dashboard-rating-note').trim()).toBe(REVIEWS.figureNone);
    expect(screen.figure('dashboard-rating')?.props.accessibilityLabel).toBe(REVIEWS.figureNoneSpoken);
    expect(screen.textIn('dashboard-rating')).not.toMatch(/0\.0/);
    // Zero is a figure for today, though.
    expect(screen.textIn('dashboard-today-value').trim()).toBe('0');
  });

  it('opens the existing Reviews screen from the rating, whose Back comes back here', async () => {
    const screen = await render();
    expect(screen.has('vendor-reviews')).toBe(false);

    await screen.press('Rating 4.3 out of 5, based on 4 reviews.');
    expect(screen.has('vendor-reviews')).toBe(true);

    await screen.press(REVIEWS.back);
    expect(screen.has('vendor-reviews')).toBe(false);
    expect(screen.has('vendor-dashboard')).toBe(true);
  });

  it('holds each figure’s place with its own named placeholder, the rest already drawn', async () => {
    const report = held<VendorReport>();
    const answer = held<VendorReviews>();
    jest.spyOn(reports, 'getReport').mockReturnValueOnce(report.promise);
    jest.spyOn(reviews, 'getVendorReviews').mockReturnValueOnce(answer.promise);
    const screen = await render();

    for (const [id, label] of [
      ['dashboard-today-loading', COPY.todayLoading],
      ['dashboard-rating-loading', COPY.ratingLoading],
    ]) {
      const [placeholder] = screen.hosts(testID => testID === id);
      expect(placeholder.props.accessibilityLabel).toBe(label);
      expect(placeholder.props.accessibilityState).toEqual({ busy: true });
      // The figure card's shape from the theme, not a height of its own: a
      // glyph-sized disc, an h1 line and a caption line inside the same frame.
      const bars = placeholder.findAll(
        node => typeof node.type !== 'string' && typeof node.props?.height === 'number',
      );
      expect(bars.map(bar => bar.props.height)).toEqual([
        spacing.xxxl,
        typographyVariants.h1.lineHeight,
        typographyVariants.caption.lineHeight,
      ]);
    }
    // Not waiting for them: the work is drawn.
    expect(count(screen, 'pending')).toBe('4');

    const figures = await todayFor(RAVI);
    await act(async () => {
      report.land(figures);
    });
    await screen.flush();

    expect(screen.has('dashboard-today-loading')).toBe(false);
    expect(screen.textIn('dashboard-today-value').trim()).toBe('4');
    // The rating is still on its own wait.
    expect(screen.has('dashboard-rating-loading')).toBe(true);
  });

  it('shows a failed rating in its own place with its own Try again, and keeps everything else', async () => {
    jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());
    const screen = await render();

    expect(screen.has('dashboard-rating-error')).toBe(true);
    expect(screen.textIn('dashboard-rating-error')).toContain(COPY.ratingFailedTitle);
    expect(screen.textIn('dashboard-rating-error')).toContain(offline().userMessage);
    // Never the service's own words.
    expect(screen.textIn('dashboard-rating-error')).not.toContain('offline');
    // Said as one passage: what failed, then why.
    expect(
      screen.labelled(`${COPY.ratingFailedTitle}. ${offline().userMessage}`).length,
    ).toBeGreaterThan(0);
    const [retry] = screen.pressable(COPY.ratingRetrySpoken);
    expect(retry.props.accessibilityHint).toBe(COPY.ratingRetryHint);

    expect(screen.textIn('dashboard-today-value').trim()).toBe('4');
    expect(count(screen, 'pending')).toBe('4');
    expect(screen.has('dashboard-error')).toBe(false);
    expect(screen.has('dashboard-stale')).toBe(false);
  });

  it('shows a failed today’s figure in its own place, and keeps the rating and the work', async () => {
    jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());
    const screen = await render();

    expect(screen.has('dashboard-today-error')).toBe(true);
    expect(screen.textIn('dashboard-today-error')).toContain(COPY.todayFailedTitle);
    // Counted, never printed: a failed match prints the tree, which needs a navigator.
    expect(screen.pressable(COPY.todayRetrySpoken).length).toBeGreaterThan(0);
    expect(screen.textIn('dashboard-rating-value').trim()).toBe('4.3');
    expect(count(screen, 'active')).toBe('2');
  });

  it('keeps both figures when the work fails', async () => {
    jest.spyOn(dashboards, 'getDashboard').mockRejectedValueOnce(offline());
    const screen = await render();

    expect(screen.has('dashboard-error')).toBe(true);
    expect(screen.textIn('dashboard-today-value').trim()).toBe('4');
    expect(screen.textIn('dashboard-rating-value').trim()).toBe('4.3');
  });

  it('keeps the work when both figures fail, with no page error', async () => {
    jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());
    jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());
    const screen = await render();

    expect(screen.has('dashboard-today-error')).toBe(true);
    expect(screen.has('dashboard-rating-error')).toBe(true);
    expect(count(screen, 'pending')).toBe('4');
    expect(screen.has('dashboard-error')).toBe(false);
  });

  it('reads the rating again once, however often its Try again is pressed — and nothing else', async () => {
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());
    const getReport = jest.spyOn(reports, 'getReport');
    const getDashboard = jest.spyOn(dashboards, 'getDashboard');
    const screen = await render();
    expect(getVendorReviews).toHaveBeenCalledTimes(1);

    const [retry] = screen.pressable(COPY.ratingRetrySpoken);
    await act(async () => {
      retry.props.onPress();
      retry.props.onPress();
      retry.props.onPress();
    });
    await screen.flush();

    expect(getVendorReviews).toHaveBeenCalledTimes(2);
    expect(getReport).toHaveBeenCalledTimes(1);
    expect(getDashboard).toHaveBeenCalledTimes(1);
    expect(screen.textIn('dashboard-rating-value').trim()).toBe('4.3');
    expect(screen.has('dashboard-rating-error')).toBe(false);
  });

  it('can try today’s figure again after a second failure', async () => {
    const getReport = jest
      .spyOn(reports, 'getReport')
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press(COPY.todayRetrySpoken);
    expect(screen.has('dashboard-today-error')).toBe(true);

    await screen.press(COPY.todayRetrySpoken);
    expect(getReport).toHaveBeenCalledTimes(3);
    expect(screen.textIn('dashboard-today-value').trim()).toBe('4');
  });

  it('offers no retry for a refusal, which would only fail again', async () => {
    jest
      .spyOn(reviews, 'getVendorReviews')
      .mockRejectedValueOnce(new AppError({ kind: 'unauthorized', message: 'no session' }));
    const screen = await render();

    expect(screen.has('dashboard-rating-error')).toBe(true);
    expect(screen.pressable(COPY.ratingRetrySpoken)).toHaveLength(0);
  });
});

describe('Vendor dashboard — pull to refresh (Phase 3E-15)', () => {
  it('reads everything on the page again: the work, both figures and the bell', async () => {
    const getDashboard = jest.spyOn(dashboards, 'getDashboard');
    const getReport = jest.spyOn(reports, 'getReport');
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews');
    const screen = await render();
    expect(unreadCount).toHaveBeenCalledTimes(1);

    await screen.pull();

    expect(getDashboard).toHaveBeenCalledTimes(2);
    expect(getReport).toHaveBeenCalledTimes(2);
    expect(getVendorReviews).toHaveBeenCalledTimes(2);
    expect(unreadCount).toHaveBeenCalledTimes(2);
  });

  it('shows the badge the pull found, without waiting for the next visit', async () => {
    const screen = await render();
    expect(screen.labelled(BELL.unreadSpoken(3)).length).toBeGreaterThan(0);

    unreadCount.mockResolvedValue(5);
    await screen.pull();

    expect(screen.labelled(BELL.unreadSpoken(5)).length).toBeGreaterThan(0);
  });

  it('says "at least" on the bell when the inbox was too long to count whole', async () => {
    unreadCount.mockResolvedValue({ atLeast: 4 });
    const screen = await render();

    expect(screen.labelled(BELL.unreadAtLeastSpoken(4)).length).toBeGreaterThan(0);
    expect(screen.labelled(BELL.unreadSpoken(4))).toHaveLength(0);
  });

  it('keeps a figure whose pull failed and says, once, that the page may be out of date', async () => {
    const screen = await render();
    jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());

    await screen.pull();

    expect(screen.textIn('dashboard-rating-value').trim()).toBe('4.3');
    expect(screen.has('dashboard-rating-error')).toBe(false);
    expect(screen.hosts(id => id === 'dashboard-stale')).toHaveLength(1);
    expect(screen.textIn('dashboard-stale')).toContain(COPY.staleMessage);

    // Its Try again is the pull, by hand; a good read clears it.
    await screen.press(COPY.staleRetry);
    expect(screen.has('dashboard-stale')).toBe(false);
  });

  it('keeps the work when its pull fails, and says so — a failed pull here used to say nothing', async () => {
    const screen = await render();
    jest.spyOn(dashboards, 'getDashboard').mockRejectedValueOnce(offline());

    await screen.pull();

    expect(count(screen, 'pending')).toBe('4');
    expect(screen.has('dashboard-error')).toBe(false);
    expect(screen.has('dashboard-stale')).toBe(true);
  });

  it('reads a figure that had failed from its placeholder, never an empty card', async () => {
    jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());
    const screen = await render();
    const answer = held<VendorReviews>();
    jest.spyOn(reviews, 'getVendorReviews').mockReturnValueOnce(answer.promise);

    await screen.pull();

    expect(screen.has('dashboard-rating-loading')).toBe(true);
    expect(screen.has('dashboard-rating-error')).toBe(false);
    await act(async () => {
      answer.land({ averageRating: 4.8, totalReviews: 12, ratingBreakdown: [], reviews: [] });
    });
    await screen.flush();
    expect(screen.textIn('dashboard-rating-value').trim()).toBe('4.8');
  });
});

describe('Vendor dashboard — shown again (Phase 3E-15)', () => {
  it('reads nothing more on arrival than its first read', async () => {
    const getDashboard = jest.spyOn(dashboards, 'getDashboard');
    const getReport = jest.spyOn(reports, 'getReport');
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews');
    await render();

    expect(getDashboard).toHaveBeenCalledTimes(1);
    expect(getReport).toHaveBeenCalledTimes(1);
    expect(getVendorReviews).toHaveBeenCalledTimes(1);
  });

  it('reads the work and both figures again, exactly once, each time the tab is shown again', async () => {
    const getDashboard = jest.spyOn(dashboards, 'getDashboard');
    const getReport = jest.spyOn(reports, 'getReport');
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews');
    const screen = await render();

    await screen.leaveAndReturn();

    expect(getDashboard).toHaveBeenCalledTimes(2);
    expect(getReport.mock.calls).toEqual([['today'], ['today']]);
    expect(getVendorReviews).toHaveBeenCalledTimes(2);

    // Team, not Profile: Profile reads the rating itself as it opens (Phase 3E-15).
    await screen.leaveAndReturn('Team');

    expect(getDashboard).toHaveBeenCalledTimes(3);
    expect(getReport).toHaveBeenCalledTimes(3);
    expect(getVendorReviews).toHaveBeenCalledTimes(3);
  });

  it('reads quietly: no placeholders, no spinner, what is on screen kept until the answer', async () => {
    const screen = await render();
    const figures = await todayFor(RAVI);
    const work = held<VendorDashboard>();
    const report = held<VendorReport>();
    jest.spyOn(dashboards, 'getDashboard').mockReturnValueOnce(work.promise);
    jest.spyOn(reports, 'getReport').mockReturnValueOnce(report.promise);

    await screen.leaveAndReturn();

    expect(screen.has('dashboard-loading')).toBe(false);
    expect(screen.has('dashboard-today-loading')).toBe(false);
    expect(screen.pullControl().props.refreshing).toBe(false);
    expect(count(screen, 'pending')).toBe('4');
    expect(screen.textIn('dashboard-today-value').trim()).toBe('4');

    await act(async () => {
      work.land(workOf(1));
      report.land({ ...figures, totalRequests: 9 });
    });
    await screen.flush();

    expect(count(screen, 'pending')).toBe('1');
    expect(screen.textIn('dashboard-today-value').trim()).toBe('9');
  });

  it('sends no second read when the tab is shown again while one is still out', async () => {
    const screen = await render();
    const work = held<VendorDashboard>();
    const getDashboard = jest.spyOn(dashboards, 'getDashboard').mockReturnValueOnce(work.promise);

    await screen.leaveAndReturn();
    await screen.leaveAndReturn();
    await screen.leaveAndReturn('Profile');

    expect(getDashboard).toHaveBeenCalledTimes(1);

    await act(async () => {
      work.land(workOf(2));
    });
    await screen.flush();
    expect(count(screen, 'pending')).toBe('2');
  });

  it('lets a figure’s Try again go ahead while a quiet read is out, and drops the quiet answer', async () => {
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());
    const screen = await render();
    expect(screen.has('dashboard-rating-error')).toBe(true);
    const quiet = held<VendorReviews>();
    getVendorReviews.mockReturnValueOnce(quiet.promise);

    await screen.leaveAndReturn();
    // The quiet read is out, and the failure it has not answered yet is still there.
    expect(getVendorReviews).toHaveBeenCalledTimes(2);
    expect(screen.has('dashboard-rating-error')).toBe(true);

    await screen.press(COPY.ratingRetrySpoken);

    // Not swallowed: the press read at once.
    expect(getVendorReviews).toHaveBeenCalledTimes(3);
    expect(screen.textIn('dashboard-rating-value').trim()).toBe('4.3');

    await act(async () => {
      quiet.land({ averageRating: 1, totalReviews: 1, ratingBreakdown: [], reviews: [] });
    });
    await screen.flush();
    expect(screen.textIn('dashboard-rating-value').trim()).toBe('4.3');
  });

  it('keeps everything when a quiet read fails, and says the page may be out of date', async () => {
    const screen = await render();
    jest.spyOn(dashboards, 'getDashboard').mockRejectedValueOnce(offline());
    jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());

    await screen.leaveAndReturn();

    expect(count(screen, 'pending')).toBe('4');
    expect(screen.textIn('dashboard-today-value').trim()).toBe('4');
    expect(screen.has('dashboard-error')).toBe(false);
    expect(screen.has('dashboard-today-error')).toBe(false);
    // One notice for the page, not one per failure.
    expect(screen.hosts(id => id === 'dashboard-stale')).toHaveLength(1);
  });
});
