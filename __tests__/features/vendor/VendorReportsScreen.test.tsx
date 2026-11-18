/**
 * The vendor's basic report (PROJECT_BIBLE.md section 42), through the real
 * VendorNavigator and the real mock report service.
 *
 * Pinned here:
 *
 * - Reports is reached from the Profile tab, and Back returns there; the tab
 *   bar is unchanged and the dashboard offers no way in
 * - the periods are one radio group of three, Today chosen first, the choice
 *   said by state; choosing one asks the service for that key and nothing else
 * - the five figures for each period, each card one block said as one phrase;
 *   the rating to one decimal with "from N ratings", or "No ratings yet"
 * - a quiet period is zeros with a calm line, not an empty or error state
 * - loading, a failed read and its retry — once, however often pressed, and
 *   again after failing at once
 * - a pull reads the chosen period again and keeps it chosen; a failed pull
 *   keeps the figures and says they may be out of date
 * - an older period's answer never appears under a newer choice, whichever
 *   order the answers arrive in, and a newer period's failure never shows the
 *   older period's figures
 * - no other service is asked: the figures are not built from requests,
 *   reviews or the team (while Reports is on screen — the dashboard underneath
 *   reads its own rating and today's figure since Phase 3E-15)
 * - one vendor never sees another's figures, and a route cannot point the
 *   screen at somebody else or choose its period
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  CommonActions,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { VendorStackParamList } from '@/navigation/types';
import { VendorNavigator } from '@/navigation/VendorNavigator';
import { ToastProvider } from '@/shared/components';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorReportService } from '@/shared/services/mock/MockVendorReportService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import {
  registerService,
  resetServices,
  type ServiceKey,
  type ServiceMap,
} from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { VendorReport, VendorReportPeriod } from '@/shared/services/types/VendorReportService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = VENDOR_COPY.reports;
const PROFILE = VENDOR_COPY.profile;

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
  phone: '9000000002',
  role: 'vendor',
};

const COUNT_KEYS = ['total', 'completed', 'rejected', 'cancelled'] as const;
const PERIOD_LABELS: Record<VendorReportPeriod, string> = {
  today: COPY.periodToday,
  week: COPY.periodWeek,
  month: COPY.periodMonth,
};

/** Ravi's four counts per period, as drawn: total, completed, rejected, cancelled. */
const RAVI_COUNTS: Record<VendorReportPeriod, string[]> = {
  today: ['4', '1', '1', '0'],
  week: ['15', '9', '2', '1'],
  month: ['48', '34', '6', '3'],
};

/** Anything that would be money, a rate or a chart — none of it is section 42's. */
const OUT_OF_SCOPE = /₹|rupee|amount|earning|revenue|payment|paid|price|invoice|percent|%|chart|trend|export/i;

/** Services a report must never be built from. Every call to one is recorded, then refused. */
const NEVER_ASKED: ServiceKey[] = ['vendorRequests', 'review', 'vendorTeam'];

const offline = () => new AppError({ kind: 'network', message: 'offline' });

let current: AuthUser;
let reports: MockVendorReportService;
/** The same figures, from a second service nobody spies on. */
let truth: MockVendorReportService;
let touched: string[];
/** The tree being tested, so the registered services can see which screen is up. */
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

/**
 * Whether the Reports screen is on screen.
 *
 * Since Phase 3E-15 the dashboard — the first screen — reads today's figures
 * and the rating as it opens. Those reads are the dashboard's, not this
 * screen's: they must not use up a failure or a held answer a test lined up
 * for Reports, be counted as its reads, or be taken for Reports asking the
 * reviews. So what is asked while Reports is not on screen goes to `truth`,
 * and is not recorded.
 */
function reportsOnScreen(): boolean {
  if (!tree) {
    return false;
  }
  return (
    tree.root.findAll(node => typeof node.type === 'string' && node.props?.testID === 'vendor-reports')
      .length > 0
  );
}

/** A service whose every method records the call — while Reports is on screen — and throws. */
function refusing<K extends ServiceKey>(key: K): ServiceMap[K] {
  return new Proxy(
    {},
    {
      get: (_target, method) => () => {
        if (reportsOnScreen()) {
          touched.push(`${key}.${String(method)}`);
        }
        throw new Error(`${key}.${String(method)} must never be called for a report`);
      },
    },
  ) as ServiceMap[K];
}

beforeEach(async () => {
  resetServices();
  current = RAVI;
  touched = [];
  const currentUser = async () => current;

  const profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  registerService('vendorProfile', profiles);
  registerService('vendorDashboard', new MockVendorDashboardService({ latency: NO_LATENCY, currentUser }));
  registerService('category', {
    listServiceCategories: jest.fn(async () => [{ id: 'cat_electrician', name: 'Electrician' }]),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);
  for (const key of NEVER_ASKED) {
    registerService(key, refusing(key));
  }

  reports = new MockVendorReportService({ latency: NO_LATENCY, currentUser });
  truth = new MockVendorReportService({ latency: NO_LATENCY, currentUser });
  registerService('vendorReports', {
    getReport: period => (reportsOnScreen() ? reports : truth).getReport(period),
    getTodayRequests: () => truth.getTodayRequests(),
  });

  setSessionStorage({
    read: async () => ({ token: 'token', user: current }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  // Both vendors have finished setup: this suite is about what comes after it.
  await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });
  current = MEENA;
  await profiles.saveProfile({ businessName: 'Iyer Interiors', serviceCategoryIds: ['cat_electrician'] });
  current = RAVI;
});

/*
  Unmounted after every test: a tree left loading leaves the placeholders
  animating, and switching tabs leaves work scheduled.
*/
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
  tree = undefined;
  jest.restoreAllMocks();
});

type Instance = ReactTestRenderer.ReactTestInstance;

/** The text drawn inside one rendered element. */
function textOf(node: Instance): string {
  return node.children.map(child => (typeof child === 'string' ? child : textOf(child))).join(' ');
}

/** Whether a node sits inside a part hidden from assistive technology, below `root`. */
function isHidden(node: Instance, root: Instance): boolean {
  for (let at: Instance | null = node.parent; at && at !== root; at = at.parent) {
    if (at.props?.importantForAccessibility === 'no-hide-descendants') {
      return true;
    }
  }
  return false;
}

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {});
  }
}

function held<T>() {
  let land!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    land = resolve;
    fail = reject;
  });
  return { promise, land, fail };
}

/** Renders the vendor application and, unless told otherwise, opens Reports from Profile. */
async function render({ open = true }: { open?: boolean } = {}) {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: current }));
  const navigation = createNavigationContainerRef<VendorStackParamList>();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer ref={navigation}>
              <VendorNavigator />
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);
  tree = renderer;
  await flush();

  /** Host nodes only, so one drawn element is counted once. */
  const hosts = (match: (id: string) => boolean, within: Instance = renderer.root) =>
    within.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props?.testID === 'string' &&
        match(node.props.testID),
    );
  const host = (id: string) => hosts(testID => testID === id)[0];
  const has = (id: string) => hosts(testID => testID === id).length > 0;

  const pressable = (label: string, within: Instance = renderer.root) =>
    within
      .findAll(node => node.props?.accessibilityLabel === label)
      .filter(node => typeof node.props?.onPress === 'function');

  const press = async (label: string, within?: Instance) => {
    const [target] = pressable(label, within);
    if (!target) {
      throw new Error(`Nothing pressable labelled "${label}"`);
    }
    await act(async () => {
      target.props.onPress();
    });
    await flush();
  };

  /** The one accessible block a card is. */
  const block = (id: string) =>
    host(id).findAll(node => typeof node.type === 'string' && node.props?.accessible === true)[0];

  /** The pull on the Reports screen — not the dashboard's, which is mounted underneath. */
  const pullControl = (): Instance | undefined =>
    has('vendor-reports')
      ? host('vendor-reports').findAll(
          node => typeof node.props?.onRefresh === 'function' && 'refreshing' in node.props,
        )[0]
      : undefined;

  const screen = {
    renderer,
    navigation,
    hosts,
    host,
    has,
    pressable,
    press,
    block,
    flush,
    pullControl,
    text: (id: string) => (has(id) ? textOf(host(id)) : ''),
    /** The four counts as drawn, in order. */
    counts: () => COUNT_KEYS.map(key => screen.text(`vendor-reports-${key}-value`)),
    /** What each card says to a screen reader, counts then rating. */
    spoken: () =>
      [...COUNT_KEYS, 'rating'].map(key => String(block(`vendor-reports-${key}`).props.accessibilityLabel)),
    /** The periods whose chips say they are chosen. */
    chosen: (): VendorReportPeriod[] =>
      (Object.keys(PERIOD_LABELS) as VendorReportPeriod[]).filter(
        period => pressable(PERIOD_LABELS[period])[0]?.props.accessibilityState?.selected === true,
      ),
    choose: async (period: VendorReportPeriod) => {
      await screen.press(PERIOD_LABELS[period], host('vendor-reports-periods'));
    },
    pull: async () => {
      const control = pullControl();
      if (!control) {
        throw new Error('Nothing to pull');
      }
      await act(async () => {
        control.props.onRefresh();
      });
      await flush();
    },
    switchTo: async (user: AuthUser) => {
      current = user;
      await act(async () => {
        store.dispatch(signedIn({ token: 'token', user }));
      });
      await flush();
    },
    openReports: async () => {
      await screen.press('Profile');
      await screen.press(PROFILE.reports);
    },
  };

  if (open) {
    await screen.openReports();
  }

  return screen;
}

describe('Vendor reports — getting there', () => {
  it('is opened from the Profile tab, and Back returns to it', async () => {
    const screen = await render({ open: false });

    await screen.press('Profile');
    expect(screen.has('vendor-profile')).toBe(true);
    expect(screen.has('vendor-reports')).toBe(false);

    await screen.press(PROFILE.reports);
    expect(screen.has('vendor-reports')).toBe(true);
    expect(screen.text('vendor-reports-heading')).toBe(COPY.title);

    await screen.press(COPY.back);
    expect(screen.has('vendor-reports')).toBe(false);
    expect(screen.has('vendor-profile')).toBe(true);
  });

  it('adds no tab, and the dashboard offers no way in: the bar is still four', async () => {
    const screen = await render({ open: false });

    for (const tab of ['Dashboard', 'Requests', 'Team', 'Profile']) {
      expect(screen.pressable(tab).length).toBeGreaterThan(0);
    }
    expect(screen.has('vendor-dashboard')).toBe(true);
    expect(screen.pressable(PROFILE.reports)).toHaveLength(0);
  });

  it('says where the Profile button goes', async () => {
    const screen = await render({ open: false });
    await screen.press('Profile');

    const [button] = screen.pressable(PROFILE.reports);
    expect(button.props.accessibilityHint).toBe(PROFILE.reportsHint);
  });
});

describe('Vendor reports — the periods', () => {
  it('offers Today, This week and This month as one radio group, Today chosen', async () => {
    const screen = await render();

    const group = screen.host('vendor-reports-periods');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe(COPY.periodsLabel);

    for (const label of Object.values(PERIOD_LABELS)) {
      const [chip] = screen.pressable(label, group);
      expect(chip.props.accessibilityRole).toBe('radio');
      expect(chip.props.accessibilityHint).toBe(COPY.periodHint);
    }
    expect(screen.chosen()).toEqual(['today']);
    expect(screen.pressable(COPY.periodToday)[0].props.accessibilityState).toEqual({
      selected: true,
      checked: true,
    });
    expect(screen.pressable(COPY.periodWeek)[0].props.accessibilityState).toEqual({
      selected: false,
      checked: false,
    });
  });

  it('asks the service for the chosen key and nothing else — no dates, no vendor', async () => {
    const getReport = jest.spyOn(reports, 'getReport');
    const screen = await render();

    await screen.choose('week');
    await screen.choose('month');

    expect(getReport.mock.calls).toEqual([['today'], ['week'], ['month']]);
  });

  it('moves the choice with the press', async () => {
    const screen = await render();

    await screen.choose('month');

    expect(screen.chosen()).toEqual(['month']);
  });

  it('asks again for nothing when the chosen period is pressed again', async () => {
    const getReport = jest.spyOn(reports, 'getReport');
    const screen = await render();

    await screen.choose('today');

    expect(getReport).toHaveBeenCalledTimes(1);
    expect(screen.chosen()).toEqual(['today']);
  });
});

describe('Vendor reports — the figures', () => {
  it.each(['today', 'week', 'month'] as VendorReportPeriod[])(
    'shows %s’s four counts as the service sent them',
    async period => {
      const screen = await render();

      await screen.choose(period);

      expect(screen.counts()).toEqual(RAVI_COUNTS[period]);
    },
  );

  it('says each card as one phrase that names what it counts', async () => {
    const screen = await render();
    await screen.choose('week');

    expect(screen.spoken()).toEqual([
      'Total requests, 15',
      'Completed requests, 9',
      'Rejected requests, 2',
      'Cancelled requests, 1',
      'Average rating 4.5 out of 5, from 6 ratings',
    ]);
  });

  it('draws the rating to one decimal, with how many ratings it comes from', async () => {
    const screen = await render();
    await screen.choose('month');

    expect(screen.text('vendor-reports-rating-value')).toBe('4.3');
    expect(screen.text('vendor-reports-rating-note')).toBe('from 21 ratings');
    expect(screen.text('vendor-reports-rating-label')).toBe(COPY.rating);
  });

  it('says "No ratings yet" for a period nobody rated — never 0.0', async () => {
    const screen = await render();

    expect(screen.has('vendor-reports-rating-value')).toBe(false);
    expect(screen.text('vendor-reports-rating-note')).toBe(COPY.noRatings);
    expect(screen.block('vendor-reports-rating').props.accessibilityLabel).toBe(COPY.noRatingsSpoken);
    expect(screen.text('vendor-reports')).not.toContain('0.0');
  });

  it('makes each card one stop: nothing inside it can be reached on its own', async () => {
    const screen = await render();
    await screen.choose('week');

    for (const key of [...COUNT_KEYS, 'rating']) {
      const card = screen.host(`vendor-reports-${key}`);
      const reachable = card
        .findAll(node => typeof node.type === 'string' && node.props?.accessible === true)
        .filter(node => !isHidden(node, card));

      expect(reachable).toHaveLength(1);
      expect(reachable[0].props.accessibilityRole).toBe('text');
    }
  });

  it('sizes the cards by the row, two to a row and the rating whole — never by a number', async () => {
    const screen = await render();

    for (const key of COUNT_KEYS) {
      const style = StyleSheet.flatten(screen.host(`vendor-reports-${key}`).props.style);
      expect(style).toMatchObject({ flexGrow: 1, flexBasis: '40%' });
      expect(style.width).toBeUndefined();
    }
    const rating = StyleSheet.flatten(screen.host('vendor-reports-rating').props.style);
    expect(rating.flexBasis).toBe('100%');
    expect(rating.width).toBeUndefined();
  });

  it('shows no quiet line when requests reached the vendor', async () => {
    const screen = await render();

    expect(screen.has('vendor-reports-quiet')).toBe(false);
  });

  it('offers nothing to press but Back and the periods', async () => {
    const screen = await render();

    // What a person can reach: a press handler with a role. (A chip's own component takes
    // `label`, not `accessibilityLabel`, so it is the pressable inside it that is counted.)
    const controls = screen
      .host('vendor-reports')
      .findAll(
        node =>
          typeof node.props?.onPress === 'function' && typeof node.props?.accessibilityRole === 'string',
      )
      .map(node => String(node.props.accessibilityLabel ?? ''));
    expect(new Set(controls)).toEqual(new Set([COPY.back, ...Object.values(PERIOD_LABELS)]));
  });

  it('says nothing about money, rates or charts', async () => {
    const screen = await render();

    for (const period of ['today', 'week', 'month'] as VendorReportPeriod[]) {
      await screen.choose(period);
      expect(screen.text('vendor-reports')).not.toMatch(OUT_OF_SCOPE);
    }
  });
});

describe('Vendor reports — a quiet period', () => {
  it('shows zeros and a calm line under them, not an empty or error state', async () => {
    current = MEENA;
    const screen = await render();

    expect(screen.counts()).toEqual(['0', '0', '0', '0']);
    expect(screen.spoken()[1]).toBe('Completed requests, 0');
    expect(screen.text('vendor-reports-rating-note')).toBe(COPY.noRatings);
    expect(screen.text('vendor-reports-quiet')).toBe(COPY.noRequests);
    expect(screen.has('vendor-reports-error')).toBe(false);
    expect(screen.has('vendor-reports-stale')).toBe(false);
  });

  it('is quiet in every period, and can still be pulled', async () => {
    current = MEENA;
    const getReport = jest.spyOn(reports, 'getReport');
    const screen = await render();

    for (const period of ['week', 'month'] as VendorReportPeriod[]) {
      await screen.choose(period);
      expect(screen.counts()).toEqual(['0', '0', '0', '0']);
      expect(screen.has('vendor-reports-quiet')).toBe(true);
    }

    await screen.pull();
    expect(getReport).toHaveBeenLastCalledWith('month');
    expect(screen.has('vendor-reports-quiet')).toBe(true);
  });
});

describe('Vendor reports — loading', () => {
  it('shows placeholders, named and busy, with no pull over them, until the figures arrive', async () => {
    const answer = held<VendorReport>();
    jest.spyOn(reports, 'getReport').mockReturnValueOnce(answer.promise);
    const screen = await render();

    const loading = screen.host('vendor-reports-loading');
    expect(loading.props.accessibilityRole).toBe('progressbar');
    expect(loading.props.accessibilityLabel).toBe(COPY.loading);
    expect(loading.props.accessibilityState).toEqual({ busy: true });
    expect(screen.has('vendor-reports-figures')).toBe(false);
    expect(screen.has('vendor-reports-error')).toBe(false);
    expect(screen.pullControl()).toBeUndefined();

    await act(async () => {
      answer.land(await truth.getReport('today'));
    });
    await screen.flush();

    expect(screen.has('vendor-reports-loading')).toBe(false);
    expect(screen.counts()).toEqual(RAVI_COUNTS.today);
  });

  it('shows placeholders again while a newly chosen period loads', async () => {
    const screen = await render();
    const answer = held<VendorReport>();
    jest.spyOn(reports, 'getReport').mockReturnValueOnce(answer.promise);

    await screen.choose('week');

    expect(screen.has('vendor-reports-loading')).toBe(true);
    expect(screen.has('vendor-reports-figures')).toBe(false);
    expect(screen.chosen()).toEqual(['week']);

    await act(async () => {
      answer.land(await truth.getReport('week'));
    });
    await screen.flush();
    expect(screen.counts()).toEqual(RAVI_COUNTS.week);
  });
});

describe('Vendor reports — a failed read', () => {
  it('says it failed, with a way to try again and no pull over it', async () => {
    jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());
    const screen = await render();

    expect(screen.has('vendor-reports-error')).toBe(true);
    expect(screen.text('vendor-reports-error')).toContain(COPY.failedTitle);
    expect(screen.text('vendor-reports-error')).not.toContain('offline');
    expect(screen.has('vendor-reports-figures')).toBe(false);
    expect(screen.has('vendor-reports-loading')).toBe(false);
    expect(screen.pullControl()).toBeUndefined();
    // The periods stay: another one can still be chosen.
    expect(screen.chosen()).toEqual(['today']);
  });

  it('reads the chosen period again when Try again is pressed', async () => {
    const getReport = jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press('Try again');

    expect(getReport.mock.calls).toEqual([['today'], ['today']]);
    expect(screen.has('vendor-reports-error')).toBe(false);
    expect(screen.counts()).toEqual(RAVI_COUNTS.today);
  });

  it('still tries again after failing at once, twice', async () => {
    const getReport = jest
      .spyOn(reports, 'getReport')
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press('Try again');
    expect(screen.has('vendor-reports-error')).toBe(true);
    await screen.press('Try again');
    expect(screen.has('vendor-reports-error')).toBe(true);
    await screen.press('Try again');

    expect(getReport).toHaveBeenCalledTimes(4);
    expect(screen.counts()).toEqual(RAVI_COUNTS.today);
  });

  it('tries again once, however often Try again is pressed', async () => {
    const getReport = jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());
    const screen = await render();
    expect(getReport).toHaveBeenCalledTimes(1);

    const [retry] = screen.pressable('Try again');
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        retry.props.onPress();
      }
    });
    await screen.flush();

    expect(getReport).toHaveBeenCalledTimes(2);
    expect(screen.counts()).toEqual(RAVI_COUNTS.today);
  });

  it('reads another period normally after one failed', async () => {
    jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.choose('week');

    expect(screen.has('vendor-reports-error')).toBe(false);
    expect(screen.counts()).toEqual(RAVI_COUNTS.week);
  });

  it('shows the failure, and no figures, when the session is not a vendor’s', async () => {
    jest
      .spyOn(reports, 'getReport')
      .mockRejectedValueOnce(new AppError({ kind: 'unauthorized', message: 'no vendor session' }));
    const screen = await render();

    expect(screen.has('vendor-reports-error')).toBe(true);
    expect(screen.has('vendor-reports-figures')).toBe(false);
  });
});

describe('Vendor reports — no reports to give (code review, 17/11/2026)', () => {
  /** What the live service answers: the backend has no report endpoint. */
  const notAvailable = () =>
    new AppError({ kind: 'forbidden', code: 'REPORTS_NOT_SUPPORTED', message: 'no report endpoint' });

  it('says calmly that reports are not available yet — no figures, no fault, no retry, no periods', async () => {
    jest.spyOn(reports, 'getReport').mockRejectedValue(notAvailable());
    const screen = await render();

    expect(screen.has('vendor-reports-unavailable')).toBe(true);
    expect(screen.text('vendor-reports-unavailable')).toContain(COPY.unavailableTitle);
    expect(screen.text('vendor-reports-unavailable')).toContain(COPY.unavailableMessage);
    expect(screen.has('vendor-reports-error')).toBe(false);
    expect(screen.has('vendor-reports-figures')).toBe(false);
    expect(screen.has('vendor-reports-periods')).toBe(false);
    expect(screen.pressable('Try again')).toHaveLength(0);
    expect(screen.pullControl()).toBeUndefined();
    // Still on the screen, with the way back.
    expect(screen.text('vendor-reports-heading')).toBe(COPY.title);
  });
});

describe('Vendor reports — pull to refresh', () => {
  it('reads the chosen period again, keeps it chosen and keeps the figures', async () => {
    const getReport = jest.spyOn(reports, 'getReport');
    const screen = await render();
    await screen.choose('week');

    await screen.pull();

    expect(getReport.mock.calls).toEqual([['today'], ['week'], ['week']]);
    expect(screen.chosen()).toEqual(['week']);
    expect(screen.counts()).toEqual(RAVI_COUNTS.week);
    expect(screen.has('vendor-reports-stale')).toBe(false);
  });

  it('sends one read for two pulls in a row', async () => {
    const getReport = jest.spyOn(reports, 'getReport');
    const screen = await render();

    const control = screen.pullControl();
    await act(async () => {
      control?.props.onRefresh();
      control?.props.onRefresh();
    });
    await screen.flush();

    expect(getReport).toHaveBeenCalledTimes(2);
  });

  it('keeps the figures and says they may be out of date when a pull fails', async () => {
    const screen = await render();
    await screen.choose('month');
    jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());

    await screen.pull();

    expect(screen.counts()).toEqual(RAVI_COUNTS.month);
    expect(screen.chosen()).toEqual(['month']);
    expect(screen.has('vendor-reports-error')).toBe(false);
    expect(screen.text('vendor-reports-stale')).toContain(COPY.staleTitle);
    expect(screen.text('vendor-reports-stale')).toContain(COPY.staleMessage);
    expect(screen.text('vendor-reports-stale')).not.toContain('offline');
  });

  it('clears the notice once the figures have been read again', async () => {
    const screen = await render();
    jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());
    await screen.pull();
    expect(screen.has('vendor-reports-stale')).toBe(true);

    await screen.press(COPY.staleRetry, screen.host('vendor-reports-stale'));

    expect(screen.has('vendor-reports-stale')).toBe(false);
    expect(screen.counts()).toEqual(RAVI_COUNTS.today);
  });

  it('drops the notice with the period it was about', async () => {
    const screen = await render();
    jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());
    await screen.pull();
    expect(screen.has('vendor-reports-stale')).toBe(true);

    await screen.choose('week');

    expect(screen.has('vendor-reports-stale')).toBe(false);
    expect(screen.counts()).toEqual(RAVI_COUNTS.week);
  });
});

describe('Vendor reports — an older answer never stands in for a newer choice', () => {
  it('ignores the old period’s answer when it lands after the choice changed', async () => {
    const today = held<VendorReport>();
    const week = held<VendorReport>();
    jest
      .spyOn(reports, 'getReport')
      .mockReturnValueOnce(today.promise)
      .mockReturnValueOnce(week.promise);
    const screen = await render();

    await screen.choose('week');
    await act(async () => {
      today.land(await truth.getReport('today'));
    });
    await screen.flush();

    expect(screen.chosen()).toEqual(['week']);
    expect(screen.has('vendor-reports-loading')).toBe(true);
    expect(screen.has('vendor-reports-figures')).toBe(false);

    await act(async () => {
      week.land(await truth.getReport('week'));
    });
    await screen.flush();

    expect(screen.counts()).toEqual(RAVI_COUNTS.week);
  });

  it('keeps the newest choice when the answers arrive out of order', async () => {
    const screen = await render();
    const week = held<VendorReport>();
    const month = held<VendorReport>();
    jest
      .spyOn(reports, 'getReport')
      .mockReturnValueOnce(week.promise)
      .mockReturnValueOnce(month.promise);

    await screen.choose('week');
    await screen.choose('month');
    await act(async () => {
      month.land(await truth.getReport('month'));
    });
    await screen.flush();
    expect(screen.counts()).toEqual(RAVI_COUNTS.month);

    await act(async () => {
      week.land(await truth.getReport('week'));
    });
    await screen.flush();

    expect(screen.chosen()).toEqual(['month']);
    expect(screen.counts()).toEqual(RAVI_COUNTS.month);
  });

  it('never shows the old period’s figures beside the new period’s failure', async () => {
    const screen = await render();
    expect(screen.counts()).toEqual(RAVI_COUNTS.today);
    jest.spyOn(reports, 'getReport').mockRejectedValueOnce(offline());

    await screen.choose('week');

    expect(screen.chosen()).toEqual(['week']);
    expect(screen.has('vendor-reports-error')).toBe(true);
    expect(screen.has('vendor-reports-figures')).toBe(false);
    // A failed first read of a period is an error, not a stale report of another.
    expect(screen.has('vendor-reports-stale')).toBe(false);
  });

  it('ignores an old failure that lands after the choice changed', async () => {
    const today = held<VendorReport>();
    jest.spyOn(reports, 'getReport').mockReturnValueOnce(today.promise);
    const screen = await render();

    await screen.choose('week');
    await act(async () => {
      today.fail(offline());
    });
    await screen.flush();

    expect(screen.has('vendor-reports-error')).toBe(false);
    expect(screen.counts()).toEqual(RAVI_COUNTS.week);
  });

  it('ignores a pull’s answer when the choice changed while it was out', async () => {
    const screen = await render();
    const pulled = held<VendorReport>();
    jest.spyOn(reports, 'getReport').mockReturnValueOnce(pulled.promise);

    const control = screen.pullControl();
    await act(async () => {
      control?.props.onRefresh();
    });
    await screen.choose('month');
    await act(async () => {
      pulled.land(await truth.getReport('today'));
    });
    await screen.flush();

    expect(screen.chosen()).toEqual(['month']);
    expect(screen.counts()).toEqual(RAVI_COUNTS.month);
  });
});

describe('Vendor reports — built from nothing else', () => {
  it('never asks the request list, the reviews or the team', async () => {
    const screen = await render();

    for (const period of ['week', 'month', 'today'] as VendorReportPeriod[]) {
      await screen.choose(period);
    }
    await screen.pull();

    expect(touched).toEqual([]);
    expect(screen.counts()).toEqual(RAVI_COUNTS.today);
  });
});

describe('Vendor reports — whose figures', () => {
  it('shows each vendor their own, and never the last vendor’s', async () => {
    const screen = await render();
    await screen.choose('month');
    expect(screen.counts()).toEqual(RAVI_COUNTS.month);

    await screen.switchTo(MEENA);
    await screen.openReports();
    expect(screen.chosen()).toEqual(['today']);
    await screen.choose('month');
    expect(screen.counts()).toEqual(['0', '0', '0', '0']);
    expect(screen.text('vendor-reports')).not.toContain('48');

    await screen.switchTo(RAVI);
    await screen.openReports();
    expect(screen.counts()).toEqual(RAVI_COUNTS.today);
  });

  it('ignores anything a route tries to say about whose figures or which period', async () => {
    current = MEENA;
    const getReport = jest.spyOn(reports, 'getReport');
    const screen = await render({ open: false });

    // A hand-built route naming another vendor and a period: the session and the screen decide.
    await act(async () => {
      screen.navigation.dispatch(
        CommonActions.navigate({ name: 'VendorReports', params: { vendorId: RAVI.id, period: 'month' } }),
      );
    });
    await screen.flush();

    expect(screen.has('vendor-reports')).toBe(true);
    expect(getReport.mock.calls).toEqual([['today']]);
    expect(screen.chosen()).toEqual(['today']);
    expect(screen.counts()).toEqual(['0', '0', '0', '0']);
  });
});
