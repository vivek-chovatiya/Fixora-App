/**
 * The vendor's request list and the read-only request it opens
 * (PROJECT_BIBLE.md sections 31 and 32, Phase 3E-3), through the real
 * VendorNavigator and the real mock services.
 *
 * Pinned here:
 *
 * - the Requests tab is the list, and the dashboard's "See all" lands on it
 * - All is the work, grouped and counted; Pending, Active, Completed and
 *   Rejected are that group alone — and changing the filter asks the service
 *   for nothing (declined requests themselves: `VendorRequestAnswers.test.tsx`)
 * - an empty list and an empty filter each say which they are
 * - a failed first load says so and retries — again after a failure that came
 *   back at once, and once however often it is pressed
 * - a failed pull keeps the list and says it may be out of date
 * - a card opens its request by reference
 * - nothing anywhere changes a request except Accept and Reject on one that is
 *   waiting (Phase 3E-4 — `VendorRequestAnswers.test.tsx`) and the next work
 *   step on accepted work (Phase 3E-5 — `VendorWorkStatus.test.tsx`)
 * - another vendor on the same device sees their own requests, never these
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { getClipboard, setClipboard } from '@/core/clipboard/Clipboard';
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
import type {
  VendorRequestDetails,
  VendorRequestList,
} from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = VENDOR_COPY.requests;
const DETAILS = VENDOR_COPY.requestDetails;
const JOB = VENDOR_COPY.job;
const DASHBOARD = VENDOR_COPY.dashboard;

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

/** The fixture whose every field is long. */
const LONG_ID = 'REQ-2026-BLR-EAST-0031021';
const LONG_CUSTOMER = 'Venkata Subrahmanya Lakshmi Narasimhamurthy-Ramachandran';
const LONG_LOCALITY = 'Hoysala Nagar, Indiranagar 2nd Stage Extension';
const LONG_SERVICE = 'Full house wiring inspection before tenancy handover';

/**
 * What a card for the first waiting request says, whole — the area where a
 * held job names the customer (owner decision, 21/10/2026).
 */
const FIRST_CARD = `Switchboard repair. ${JOB.statusLabel}: ${JOB.statusBroadcast}. ${JOB.areaLabel}: Koramangala. ${JOB.priorityLabel}: Emergency. ${JOB.raisedLabel} 12 min ago. ${JOB.referencePrefix} REQ-31042`;

/** The customers of the four waiting requests: never on their cards. */
const WAITING_CUSTOMERS = ['Asha Patel', 'Rahul Menon', LONG_CUSTOMER, 'Neha Sharma'];

/** Anything that would cancel, reassign or reach the customer. None may exist yet. */
const MUTATION = /decline|cancel|reassign|call|chat|message|pay/i;

const ANSWER = VENDOR_COPY.answer;
/** The two answers a waiting request is offered, as a screen reader hears them. */
const answersFor = (service: string, reference: string) => [
  ANSWER.acceptSpoken(service, `${JOB.referencePrefix} ${reference}`),
  ANSWER.rejectSpoken(service, `${JOB.referencePrefix} ${reference}`),
];

const offline = () => new AppError({ kind: 'network', message: 'offline' });

let scenarios: Record<string, MockDashboardScenario>;
let current: AuthUser;
let requests: MockVendorRequestService;

beforeEach(async () => {
  resetServices();
  current = RAVI;
  scenarios = { [RAVI.id]: 'mixed', [MEENA.id]: 'empty' };
  const scenarioFor = (vendorId: string) => scenarios[vendorId] ?? 'empty';
  const currentUser = async () => current;

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

type Instance = ReactTestRenderer.ReactTestInstance;

/*
  Unmounted after every test. Switching tabs leaves the tab view with work
  still scheduled, and a tree left mounted runs it after Jest has torn the
  environment down.
*/
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

/** The text drawn inside one rendered element. */
function textOf(node: Instance): string {
  return node.children.map(child => (typeof child === 'string' ? child : textOf(child))).join(' ');
}

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {});
  }
}

/** Everything a subtree draws or says, as text — for what must never be in it. */
function everythingIn(root: Instance): string {
  return [
    textOf(root),
    ...root
      .findAll(node => typeof node.type === 'string')
      .flatMap(node => [node.props?.accessibilityLabel, node.props?.accessibilityHint])
      .filter((value): value is string => typeof value === 'string'),
  ].join('\n');
}

/** Renders the vendor application and, unless told otherwise, opens the Requests tab. */
async function render({ open = true }: { open?: boolean } = {}) {
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

  const labelled = (label: string, within: Instance = renderer.root) =>
    within.findAll(node => node.props?.accessibilityLabel === label);
  const pressable = (label: string, within: Instance = renderer.root) =>
    labelled(label, within).filter(node => typeof node.props?.onPress === 'function');

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

  const list = () =>
    renderer.root.findAll(
      node => node.props?.testID === 'vendor-requests-list' && 'data' in (node.props ?? {}),
    )[0];

  const choose = (filter: string) => press(filterLabel(filter));

  const lines = (): Array<{ kind: string; title?: string; count?: number; job?: { id: string } }> =>
    list().props.data;

  const switchTo = async (user: AuthUser) => {
    current = user;
    await act(async () => {
      store.dispatch(signedIn({ token: 'token', user }));
    });
    await flush();
  };

  const screen = {
    renderer,
    hosts,
    host,
    has,
    labelled,
    pressable,
    press,
    list,
    choose,
    switchTo,
    flush,
    text: (id: string) => (has(id) ? textOf(host(id)) : ''),
    /*
      What the list holds, read from its data: a FlatList mounts only its first
      screenful in the test renderer, so the tree is not the whole list.
    */
    cards: () =>
      lines()
        .filter(line => line.kind === 'request')
        .map(line => `vendor-request-${line.job?.id}`),
    headings: () =>
      lines()
        .filter(line => line.kind === 'heading')
        .map(line => COPY.groupSpoken(String(line.title), Number(line.count))),
    /** Presses a request card by its reference. */
    openCard: async (reference: string) => {
      const [card] = renderer.root.findAll(
        node =>
          node.props?.testID === `vendor-request-${reference}` &&
          // The button itself, not the card component around it, whose own
          // `onPress` expects to be handed the reference.
          node.props?.accessibilityRole === 'button' &&
          typeof node.props?.onPress === 'function',
      );
      if (!card) {
        throw new Error(`No card for ${reference} on screen`);
      }
      await act(async () => {
        card.props.onPress();
      });
      await flush();
    },
    selected: (filter: string) =>
      pressable(filterLabel(filter)).some(node => node.props.accessibilityState?.selected === true),
    pull: async () => {
      await act(async () => {
        list().props.onRefresh();
      });
      await flush();
    },
    /** Every label on anything pressable inside one screen. */
    actions: (id: string) =>
      host(id)
        .findAll(node => typeof node.props?.onPress === 'function')
        .map(node => String(node.props.accessibilityLabel ?? '')),
    /**
     * The testID of every native view on the list screen that says it is busy
     * — the other tabs stay mounted, so only this screen's subtree is read.
     *
     * Ids, not the nodes: a failed match on a test instance makes jest print it,
     * and printing one walks the whole fiber tree — the run never finishes.
     */
    busy: (): Array<string | undefined> =>
      host('vendor-requests')
        .findAll(
          node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true,
        )
        .map(node => node.props.testID),
  };

  if (open) {
    await screen.press('Requests');
  }

  return screen;
}

function filterLabel(filter: string): string {
  const labels: Record<string, string> = {
    all: COPY.filterAll,
    pending: COPY.filterPending,
    active: COPY.filterActive,
    completed: COPY.filterCompleted,
    rejected: COPY.filterRejected,
  };
  return labels[filter];
}

const ids = (...references: string[]) => references.map(reference => `vendor-request-${reference}`);

describe('Vendor requests — the list', () => {
  it('is what the Requests tab opens', async () => {
    const screen = await render();

    expect(screen.has('vendor-requests')).toBe(true);
    expect(screen.text('vendor-requests-heading')).toBe(COPY.title);
  });

  it('is where the dashboard’s "See all" leads, opening on All', async () => {
    const screen = await render({ open: false });
    expect(screen.has('vendor-requests')).toBe(false);

    await screen.press(DASHBOARD.seeAllPendingSpoken);

    expect(screen.has('vendor-requests')).toBe(true);
    expect(screen.selected('all')).toBe(true);
  });

  it('holds the place of the requests while they load, and names the wait once', async () => {
    let finish!: (list: VendorRequestList) => void;
    jest
      .spyOn(requests, 'listRequests')
      .mockImplementationOnce(() => new Promise<VendorRequestList>(resolve => (finish = resolve)));
    const screen = await render();

    // One region says the wait once, named and busy — not the list itself.
    const region = screen.host('vendor-requests-loading');
    expect(region.props.accessibilityLabel).toBe(COPY.loadingLabel);
    expect(region.props.accessibilityState).toEqual({ busy: true });
    expect(screen.busy()).toEqual(['vendor-requests-loading']);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.list().props.accessibilityRole).toBeUndefined();
    expect(screen.cards()).toHaveLength(0);
    // The filters are there from the start; they need nothing from the service.
    expect(screen.has('vendor-requests-filters')).toBe(true);

    await act(async () => {
      finish({ pending: [], active: [], completed: [], rejected: [] });
    });
    await screen.flush();

    // Empty, in its own words, under a list that is still no stop of its own.
    expect(screen.text('vendor-requests-empty')).toContain(COPY.emptyAllTitle);
    expect(screen.has('vendor-requests-loading')).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });

  it('replaces the busy region once the requests land, and leaves the list unnamed', async () => {
    // The list used to be named on every render — "Loading your requests",
    // then "Your requests" — so loaded, TalkBack stopped on it to say what the
    // heading had just said. Now the wait is its own region, and it is gone,
    // not updated, when the requests arrive.
    let release!: () => void;
    const real = requests.listRequests.bind(requests);
    jest
      .spyOn(requests, 'listRequests')
      .mockImplementationOnce(() =>
        new Promise<void>(resolve => (release = resolve)).then(() => real()),
      );
    const screen = await render();

    const waiting = screen.host('vendor-requests-loading');
    expect(waiting.props.accessibilityState).toEqual({ busy: true });

    await act(async () => {
      release();
    });
    await screen.flush();

    expect(screen.cards().length).toBeGreaterThan(0);
    // Not hidden or emptied: no longer in the tree at all, so its busy cannot outlive it.
    expect(screen.has('vendor-requests-loading')).toBe(false);
    expect(screen.list() === waiting).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.list().props.accessibilityRole).toBeUndefined();
    // Nothing anywhere on the loaded screen still says busy.
    expect(screen.busy()).toEqual([]);
  });

  it('shows everything under All, grouped and counted, pending first', async () => {
    const screen = await render();

    expect(screen.selected('all')).toBe(true);
    expect(screen.headings()).toEqual([
      COPY.groupSpoken(COPY.groupPending, 4),
      COPY.groupSpoken(COPY.groupActive, 2),
      COPY.groupSpoken(COPY.groupCompleted, 5),
    ]);
    expect(screen.cards()).toHaveLength(11);
    expect(screen.cards().slice(0, 5)).toEqual(
      ids('REQ-31042', 'REQ-31038', LONG_ID, 'REQ-30987', 'REQ-30954'),
    );
  });

  it('announces a group heading as a heading, with how many are under it', async () => {
    const screen = await render();

    const heading = screen.host('vendor-requests-group-pending');
    expect(heading.props.accessibilityRole).toBe('header');
    expect(heading.props.accessibilityLabel).toBe(COPY.groupSpoken(COPY.groupPending, 4));
  });

  it('leaves an empty group out of All', async () => {
    scenarios[RAVI.id] = 'pendingOnly';
    const screen = await render();

    expect(screen.headings()).toEqual([COPY.groupSpoken(COPY.groupPending, 4)]);
    expect(screen.cards()).toHaveLength(4);
  });
});

describe('Vendor requests — filters', () => {
  it.each([
    ['pending', ids('REQ-31042', 'REQ-31038', LONG_ID, 'REQ-30987')],
    ['active', ids('REQ-30954', 'REQ-30961')],
    ['completed', ids('REQ-30912', 'REQ-30876', 'REQ-30833', 'REQ-30790', 'REQ-30744')],
    // Nothing declined yet: the fixtures hold no history.
    ['rejected', []],
  ])('shows only the %s requests, with no group heading', async (filter, expected) => {
    const screen = await render();

    await screen.choose(filter);

    expect(screen.cards()).toEqual(expected);
    expect(screen.headings()).toEqual([]);
    expect(screen.selected(filter)).toBe(true);
    expect(screen.selected('all')).toBe(false);
  });

  it('returns to everything when All is chosen again', async () => {
    const screen = await render();

    await screen.choose('completed');
    await screen.choose('all');

    expect(screen.cards()).toHaveLength(11);
    expect(screen.headings()).toHaveLength(3);
  });

  it('asks the service for nothing when the filter changes', async () => {
    const listRequests = jest.spyOn(requests, 'listRequests');
    const screen = await render();
    expect(listRequests).toHaveBeenCalledTimes(1);

    await screen.choose('pending');
    await screen.choose('active');
    await screen.choose('completed');
    await screen.choose('rejected');
    await screen.choose('all');

    expect(listRequests).toHaveBeenCalledTimes(1);
  });

  it('says the filters are alternatives, and which one is chosen', async () => {
    const screen = await render();

    const group = screen.host('vendor-requests-filters');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe(COPY.filtersLabel);

    const [pending] = screen.pressable(COPY.filterPending);
    expect(pending.props.accessibilityRole).toBe('radio');
    expect(pending.props.accessibilityState).toEqual({ selected: false, checked: false });

    await screen.choose('pending');
    expect(screen.pressable(COPY.filterPending)[0].props.accessibilityState).toEqual({
      selected: true,
      checked: true,
    });
  });

  it('puts all five on one row that scrolls sideways, with no scroll indicator (T134)', async () => {
    const screen = await render();

    const group = screen.host('vendor-requests-filters');
    expect(group.props.horizontal).toBe(true);
    expect(group.props.showsHorizontalScrollIndicator).toBe(false);
    // Every chip is in that one row, in order.
    expect(
      group
        .findAll(node => node.props?.accessibilityRole === 'radio' && typeof node.props?.onPress === 'function')
        .map(node => node.props.accessibilityLabel),
    ).toEqual([COPY.filterAll, COPY.filterPending, COPY.filterActive, COPY.filterCompleted, COPY.filterRejected]);
  });
});

describe('Vendor requests — empty', () => {
  it('says there are no requests yet for a vendor with none', async () => {
    current = MEENA;
    const screen = await render();

    expect(screen.cards()).toHaveLength(0);
    expect(screen.headings()).toEqual([]);
    expect(screen.text('vendor-requests-empty')).toContain(COPY.emptyAllTitle);
    expect(screen.text('vendor-requests-empty')).toContain(COPY.emptyAllMessage);
    expect(screen.has('vendor-requests-error')).toBe(false);
  });

  it.each([
    ['pending', COPY.emptyPendingTitle],
    ['active', COPY.emptyActiveTitle],
  ])('says which view is empty when the %s filter matches nothing', async (filter, title) => {
    scenarios[RAVI.id] = 'completedOnly';
    const screen = await render();

    await screen.choose(filter);

    expect(screen.cards()).toHaveLength(0);
    expect(screen.text('vendor-requests-empty')).toContain(title);
    // Not the wording for a vendor with nothing at all.
    expect(screen.text('vendor-requests-empty')).not.toContain(COPY.emptyAllTitle);
  });

  it('says there is no completed work when only that is empty', async () => {
    scenarios[RAVI.id] = 'pendingOnly';
    const screen = await render();

    await screen.choose('completed');

    expect(screen.text('vendor-requests-empty')).toContain(COPY.emptyCompletedTitle);
  });

  it('says nothing has been declined under Rejected, in its own words', async () => {
    const screen = await render();

    await screen.choose('rejected');

    expect(screen.cards()).toHaveLength(0);
    expect(screen.headings()).toEqual([]);
    expect(screen.text('vendor-requests-empty')).toContain(COPY.emptyRejectedTitle);
    expect(screen.text('vendor-requests-empty')).toContain("You haven't declined any requests.");
    expect(screen.text('vendor-requests-empty')).not.toContain(COPY.emptyAllTitle);
    expect(screen.has('vendor-requests-error')).toBe(false);
  });
});

describe('Vendor requests — failure and retry', () => {
  it('says the requests could not be loaded, and keeps the heading and the filters', async () => {
    jest.spyOn(requests, 'listRequests').mockRejectedValueOnce(offline());
    const screen = await render();

    expect(screen.has('vendor-requests-error')).toBe(true);
    expect(screen.text('vendor-requests-error')).toContain(COPY.failedTitle);
    // Never the service's own words.
    expect(screen.text('vendor-requests')).not.toContain('offline');
    expect(screen.has('vendor-requests-filters')).toBe(true);
    expect(screen.has('vendor-requests-stale')).toBe(false);
    // No pull over a failure with nothing behind it: the retry is right there.
    expect(screen.list().props.onRefresh).toBeUndefined();
    // Its own words, under a list that is still no stop of its own.
    expect(screen.has('vendor-requests-loading')).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });

  it('loads the list when Try again is pressed', async () => {
    jest.spyOn(requests, 'listRequests').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press('Try again');

    expect(screen.has('vendor-requests-error')).toBe(false);
    expect(screen.cards()).toHaveLength(11);
  });

  it('can be retried again after a retry that failed at once', async () => {
    const listRequests = jest
      .spyOn(requests, 'listRequests')
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press('Try again');
    expect(screen.has('vendor-requests-error')).toBe(true);
    await screen.press('Try again');
    expect(screen.has('vendor-requests-error')).toBe(true);
    await screen.press('Try again');

    expect(listRequests).toHaveBeenCalledTimes(4);
    expect(screen.has('vendor-requests-error')).toBe(false);
    expect(screen.cards()).toHaveLength(11);
  });

  it('retries once, however often Try again is pressed', async () => {
    const listRequests = jest.spyOn(requests, 'listRequests').mockRejectedValueOnce(offline());
    const screen = await render();
    expect(listRequests).toHaveBeenCalledTimes(1);

    const [retry] = screen.pressable('Try again');
    await act(async () => {
      retry.props.onPress();
      retry.props.onPress();
      retry.props.onPress();
    });
    await screen.flush();

    expect(listRequests).toHaveBeenCalledTimes(2);
    expect(screen.cards()).toHaveLength(11);
  });
});

describe('Vendor requests — pull to refresh', () => {
  it('reads the list again and keeps it on screen', async () => {
    const listRequests = jest.spyOn(requests, 'listRequests');
    const screen = await render();

    await screen.pull();

    expect(listRequests).toHaveBeenCalledTimes(2);
    expect(screen.cards()).toHaveLength(11);
    expect(screen.has('vendor-requests-stale')).toBe(false);
  });

  it('sends one request for two pulls in a row', async () => {
    const listRequests = jest.spyOn(requests, 'listRequests');
    const screen = await render();

    await act(async () => {
      screen.list().props.onRefresh();
      screen.list().props.onRefresh();
    });
    await screen.flush();

    expect(listRequests).toHaveBeenCalledTimes(2);
  });

  it('keeps the list and says it may be out of date when a pull fails', async () => {
    const screen = await render();
    jest.spyOn(requests, 'listRequests').mockRejectedValueOnce(offline());

    await screen.pull();

    expect(screen.cards()).toHaveLength(11);
    expect(screen.has('vendor-requests-error')).toBe(false);
    expect(screen.has('vendor-requests-stale')).toBe(true);
    expect(screen.text('vendor-requests-stale')).toContain(COPY.staleTitle);
    expect(screen.text('vendor-requests-stale')).toContain(COPY.staleMessage);
    expect(screen.text('vendor-requests-stale')).not.toContain('offline');
  });

  it('clears the notice once the list has been read again', async () => {
    const screen = await render();
    jest.spyOn(requests, 'listRequests').mockRejectedValueOnce(offline());
    await screen.pull();
    expect(screen.has('vendor-requests-stale')).toBe(true);

    await screen.press(COPY.staleRetry, screen.host('vendor-requests-stale'));

    expect(screen.has('vendor-requests-stale')).toBe(false);
    expect(screen.cards()).toHaveLength(11);
  });

  it('keeps working after a pull that failed at once', async () => {
    const screen = await render();
    const listRequests = jest
      .spyOn(requests, 'listRequests')
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline());

    await screen.pull();
    await screen.pull();
    expect(screen.has('vendor-requests-stale')).toBe(true);
    await screen.pull();

    expect(listRequests).toHaveBeenCalledTimes(3);
    expect(screen.has('vendor-requests-stale')).toBe(false);
  });
});

describe('Vendor requests — a card', () => {
  it('is a button that says the whole request and where it leads', async () => {
    const screen = await render();

    const button = screen
      .pressable(FIRST_CARD)
      .find(node => node.props.accessibilityRole === 'button');
    expect(button).toBeDefined();
    expect(button?.props.accessibilityHint).toBe(JOB.openHint);
  });

  it('says a long service, a long area and a long reference in full, and keeps them to their lines on screen', async () => {
    const screen = await render();

    const spoken = `${LONG_SERVICE}. ${JOB.statusLabel}: ${JOB.statusBroadcast}. ${JOB.areaLabel}: ${LONG_LOCALITY}. ${JOB.priorityLabel}: High. ${JOB.raisedLabel} 3 hr ago. ${JOB.referencePrefix} ${LONG_ID}`;
    expect(screen.pressable(spoken).length).toBeGreaterThan(0);

    const card = screen.host(`vendor-request-${LONG_ID}`);
    const lines = (text: string) =>
      card.findAll(node => typeof node.type === 'string' && textOf(node) === text)[0]?.props
        .numberOfLines;
    expect(lines(LONG_SERVICE)).toBe(2);
    expect(lines(LONG_LOCALITY)).toBe(1);
    expect(lines(`${JOB.referencePrefix} ${LONG_ID}`)).toBe(1);
  });

  it('says a long name in full and keeps it to a line, once the vendor holds the work', async () => {
    // Accepted before the list is read: the name is the vendor's to see now.
    await requests.acceptRequest(LONG_ID);
    const screen = await render();

    const spoken = `${LONG_SERVICE}. ${JOB.statusLabel}: ${JOB.statusAccepted}. ${JOB.customerLabel}: ${LONG_CUSTOMER}, ${LONG_LOCALITY}. ${JOB.priorityLabel}: High. ${JOB.raisedLabel} 3 hr ago. ${JOB.referencePrefix} ${LONG_ID}`;
    expect(screen.pressable(spoken).length).toBeGreaterThan(0);

    const card = screen.host(`vendor-request-${LONG_ID}`);
    const nameLine = card.findAll(
      node => typeof node.type === 'string' && textOf(node) === LONG_CUSTOMER,
    )[0];
    expect(nameLine?.props.numberOfLines).toBe(1);
  });

  /*
    Owner decision, 21/10/2026: before the vendor holds the work — waiting, or
    declined — a card shows the area, never the customer's name, in what is
    drawn and in what is said.
  */
  it('never draws or says the customer’s name on a waiting card', async () => {
    const screen = await render();
    await screen.choose('pending');

    const drawn = everythingIn(screen.host('vendor-requests'));
    for (const name of WAITING_CUSTOMERS) {
      expect(drawn).not.toContain(name);
    }
    expect(drawn).toContain(`${JOB.areaLabel}: Koramangala`);
  });

  it('never draws or says the customer’s name on a declined card', async () => {
    await requests.rejectRequest('REQ-31042');
    await requests.rejectRequest('REQ-31038');
    const screen = await render();
    await screen.choose('rejected');

    expect(screen.cards()).toEqual(['vendor-request-REQ-31038', 'vendor-request-REQ-31042']);
    const drawn = everythingIn(screen.host('vendor-requests'));
    expect(drawn).not.toContain('Asha Patel');
    expect(drawn).not.toContain('Rahul Menon');
    expect(drawn).toContain(`${JOB.areaLabel}: HSR Layout`);
  });

  it('draws no name on a waiting or declined card even when a record carries one', async () => {
    const real = await requests.listRequests();
    jest.spyOn(requests, 'listRequests').mockResolvedValue({
      ...real,
      pending: [{ ...real.pending[0], customerName: 'Zara Hidden' }],
      rejected: [
        {
          ...real.pending[1],
          id: 'REQ-99010',
          status: 'REJECTED',
          rejectedAt: new Date().toISOString(),
          customerName: 'Yusuf Hidden',
        },
      ],
    });
    const screen = await render();

    await screen.choose('pending');
    expect(everythingIn(screen.host('vendor-requests'))).not.toContain('Zara Hidden');
    await screen.choose('rejected');
    expect(screen.cards()).toEqual(['vendor-request-REQ-99010']);
    expect(everythingIn(screen.host('vendor-requests'))).not.toContain('Yusuf Hidden');
  });

  it('still names the customer on work the vendor holds', async () => {
    const screen = await render();
    await screen.choose('active');

    const drawn = everythingIn(screen.host('vendor-requests'));
    expect(drawn).toContain('Imran Sheikh');
    expect(drawn).toContain(`${JOB.customerLabel}: Imran Sheikh, BTM Layout`);
  });

  it('offers each request only the step it is ready for, and nothing else that changes one', async () => {
    const screen = await render();

    const labels = screen.actions('vendor-requests').filter(Boolean);
    const answers = new Set([
      ...answersFor('Switchboard repair', 'REQ-31042'),
      ...answersFor('Ceiling fan installation', 'REQ-31038'),
      ...answersFor(LONG_SERVICE, LONG_ID),
      ...answersFor('Light fitting replacement', 'REQ-30987'),
      // Work under way (3E-5): the one in progress can be completed, the accepted one started.
      VENDOR_COPY.work.completeSpoken('Inverter installation', `${JOB.referencePrefix} REQ-30954`),
      VENDOR_COPY.work.startSpoken('MCB replacement', `${JOB.referencePrefix} REQ-30961`),
    ]);
    // A card's label is the request read out — it may well say "Accepted".
    const isCard = (label: string) => label.includes(`. ${JOB.referencePrefix} REQ-`);

    // Apart from the cards, the four waiting requests' answers and the two work
    // steps, the only things to press are the five filters.
    const others = labels.filter(label => !isCard(label) && !answers.has(label));
    expect([...new Set(others)]).toEqual([
      COPY.filterAll,
      COPY.filterPending,
      COPY.filterActive,
      COPY.filterCompleted,
      COPY.filterRejected,
    ]);
    // Each waiting request's pair is there (a button is several nodes, so as a set).
    expect(new Set(labels.filter(label => answers.has(label)))).toEqual(answers);
    expect(labels.filter(label => !isCard(label)).join(' | ')).not.toMatch(MUTATION);
    expect(labels.some(isCard)).toBe(true);
  });

  it('opens the request by its reference when pressed', async () => {
    const getRequest = jest.spyOn(requests, 'getRequest');
    const screen = await render();

    await screen.press(FIRST_CARD);

    expect(screen.has('vendor-request-details')).toBe(true);
    expect(getRequest).toHaveBeenCalledTimes(1);
    expect(getRequest).toHaveBeenCalledWith('REQ-31042');
  });
});

describe('Vendor request details', () => {
  async function open(label = FIRST_CARD) {
    const screen = await render();
    await screen.press(label);
    return screen;
  }

  it('copies the reference — exactly it — from a button named for it, and says so (T135)', async () => {
    const original = getClipboard();
    const copied: string[] = [];
    setClipboard({
      copy: async value => {
        copied.push(value);
      },
    });

    try {
      const screen = await open();
      const label = DETAILS.copyReference('REQ-31042');

      const [button] = screen.pressable(label);
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityHint).toBe(DETAILS.copyReferenceHint);
      expect(screen.has('vendor-request-reference-copy-copied')).toBe(false);

      await screen.press(label);

      expect(copied).toEqual(['REQ-31042']);
      expect(screen.text('vendor-request-reference-copy-copied')).toBe(DETAILS.copied);
    } finally {
      setClipboard(original);
    }
  });

  it('says in a toast when the reference could not be copied, never "Copied"', async () => {
    const original = getClipboard();
    setClipboard({
      copy: async () => {
        throw new Error('clipboard unavailable');
      },
    });

    try {
      const screen = await open();

      await screen.press(DETAILS.copyReference('REQ-31042'));

      expect(screen.text('toast')).toContain(DETAILS.copyFailed);
      expect(screen.has('vendor-request-reference-copy-copied')).toBe(false);
    } finally {
      setClipboard(original);
    }
  });

  it('shows the request: service, status, urgency, reference, category, area, origin and description', async () => {
    const screen = await open();

    expect(screen.text('vendor-request-service')).toBe('Switchboard repair');
    expect(screen.host('vendor-request-heading').props.accessibilityLabel).toBe(
      `Switchboard repair. ${DETAILS.statusLabel}: ${JOB.statusBroadcast}. ${DETAILS.priorityLabel}: Emergency`,
    );
    const summary = screen.text('vendor-request-summary');
    expect(summary).toContain('REQ-31042');
    expect(summary).toContain('Electrician');
    expect(summary).toContain('12 min ago');
    expect(summary).toContain(DETAILS.originBroadcast);
    // Waiting for this vendor: the area, and nobody's name (owner decision, 21/10/2026).
    expect(screen.text('vendor-request-location')).toContain('Koramangala');
    expect(screen.has('vendor-request-customer')).toBe(false);
    expect(screen.text('vendor-request-details')).not.toContain('Asha Patel');
    expect(screen.text('vendor-request-description')).toContain('switchboard is sparking');
  });

  it('holds the place of the request while it loads', async () => {
    let finish!: (request: VendorRequestDetails) => void;
    const screen = await render();
    jest
      .spyOn(requests, 'getRequest')
      .mockImplementationOnce(() => new Promise<VendorRequestDetails>(resolve => (finish = resolve)));

    await screen.press(FIRST_CARD);

    expect(screen.has('vendor-request-loading')).toBe(true);
    expect(screen.host('vendor-request-loading').props.accessibilityLabel).toBe(DETAILS.loading);

    await act(async () => {
      finish({
        id: 'REQ-31042',
        serviceName: 'Switchboard repair',
        customerName: 'Asha Patel',
        priority: 'EMERGENCY',
        status: 'PENDING_VENDOR',
        createdAt: new Date().toISOString(),
      });
    });
    await screen.flush();

    expect(screen.has('vendor-request-loading')).toBe(false);
    expect(screen.text('vendor-request-service')).toBe('Switchboard repair');
  });

  it('says the customer chose this vendor when the request was directed', async () => {
    const screen = await render();
    await screen.choose('pending');
    await screen.openCard('REQ-31038');

    expect(screen.text('vendor-request-origin')).toContain(DETAILS.originDirected);
  });

  it('shows when finished work was completed, and no origin for it', async () => {
    const screen = await render();
    await screen.choose('completed');
    await screen.openCard('REQ-30912');

    expect(screen.text('vendor-request-completed')).toContain('1 day ago');
    expect(screen.has('vendor-request-origin')).toBe(false);
    expect(screen.text('vendor-request-status')).toContain(JOB.statusCompleted);
  });

  it('says so when the customer added no description, and leaves out what is not known', async () => {
    const screen = await render();
    await screen.choose('pending');
    await screen.openCard('REQ-30987');

    expect(screen.text('vendor-request-description')).toContain(DETAILS.descriptionMissing);
    // No locality, no category and no dispatch on this one: no empty rows for them.
    expect(screen.has('vendor-request-area')).toBe(false);
    expect(screen.text('vendor-request-summary')).not.toContain(DETAILS.categoryLabel);
    expect(screen.has('vendor-request-origin')).toBe(false);
  });

  it('shows long fields whole, wrapped rather than cut', async () => {
    const screen = await render();
    await screen.openCard(LONG_ID);

    expect(screen.text('vendor-request-service')).toBe(LONG_SERVICE);
    expect(screen.host('vendor-request-service').props.numberOfLines).toBeUndefined();
    expect(screen.text('vendor-request-reference')).toContain(LONG_ID);
    // Waiting: the long area is shown whole, the long name not at all (21/10/2026).
    expect(screen.text('vendor-request-area')).toContain(LONG_LOCALITY);
    expect(screen.text('vendor-request-details')).not.toContain(LONG_CUSTOMER);
  });

  it('says a status it does not recognise is unavailable, and never draws the raw value', async () => {
    const screen = await render();
    jest.spyOn(requests, 'getRequest').mockResolvedValueOnce({
      id: 'REQ-31042',
      serviceName: 'Switchboard repair',
      customerName: 'Asha Patel',
      priority: 'SOMETHING_NEW',
      status: 'AWAITING_PARTS',
      createdAt: new Date().toISOString(),
    });

    await screen.press(FIRST_CARD);

    expect(screen.text('vendor-request-status')).toContain(JOB.statusUnknown);
    expect(screen.text('vendor-request-details').toLowerCase()).not.toContain('awaiting');
    // A priority it has never seen is still shown, tidied, as the shared helper does.
    expect(screen.text('vendor-request-priority')).toBe('Something new');
  });

  /*
    Opened from the push its cancelling sends, a cancelled request read "Status
    unavailable" (device test, 28/11/2026). It says Cancelled, offers nothing,
    and shows nothing of the customer: the vendor never held the work.
  */
  it('says a cancelled request is cancelled, with no action and no customer', async () => {
    const screen = await render();
    jest.spyOn(requests, 'getRequest').mockResolvedValueOnce({
      id: 'REQ-31043',
      serviceName: 'Fan installation',
      customerName: 'Asha Patel',
      priority: 'MEDIUM',
      status: 'CANCELLED',
      dispatch: 'directed',
      createdAt: new Date().toISOString(),
    });

    await screen.press(FIRST_CARD);

    expect(screen.text('vendor-request-status')).toContain(JOB.statusCancelled);
    expect(screen.text('vendor-request-status')).not.toContain(JOB.statusUnknown);
    // No answer, no work step, no payment, no customer card.
    expect(screen.has('vendor-request-answer')).toBe(false);
    expect(screen.has('vendor-request-work')).toBe(false);
    expect(screen.has('vendor-request-payment')).toBe(false);
    expect(screen.has('vendor-request-customer')).toBe(false);
    expect(screen.text('vendor-request-details')).not.toContain('Asha Patel');
  });

  it('says calmly that a request is not available, with no retry that cannot help', async () => {
    const screen = await render();
    jest
      .spyOn(requests, 'getRequest')
      .mockRejectedValueOnce(new AppError({ kind: 'notFound', message: 'gone' }));

    await screen.press(FIRST_CARD);

    expect(screen.has('vendor-request-not-found')).toBe(true);
    expect(screen.text('vendor-request-not-found')).toContain(DETAILS.notFoundTitle);
    expect(screen.has('vendor-request-error')).toBe(false);
    expect(screen.pressable('Try again', screen.host('vendor-request-details'))).toHaveLength(0);
  });

  it('says a failed load failed, and loads on Try again — even after failing twice', async () => {
    const screen = await render();
    const getRequest = jest
      .spyOn(requests, 'getRequest')
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline());

    await screen.press(FIRST_CARD);
    expect(screen.text('vendor-request-error')).toContain(DETAILS.failedTitle);

    const details = () => screen.host('vendor-request-details');
    await screen.press('Try again', details());
    expect(screen.has('vendor-request-error')).toBe(true);
    await screen.press('Try again', details());

    expect(getRequest).toHaveBeenCalledTimes(3);
    expect(screen.has('vendor-request-error')).toBe(false);
    expect(screen.text('vendor-request-service')).toBe('Switchboard repair');
  });

  it('has a way back, the reference’s copy and nothing else to press once a request is finished', async () => {
    const screen = await render();
    await screen.choose('completed');
    await screen.openCard('REQ-30912');

    // Copying the reference changes nothing about the request (T135).
    expect([...new Set(screen.actions('vendor-request-details'))]).toEqual([
      DETAILS.back,
      DETAILS.copyReference('REQ-30912'),
    ]);
  });

  it('offers a waiting request’s two answers beside the way back, and nothing else', async () => {
    const screen = await open();

    expect([...new Set(screen.actions('vendor-request-details'))]).toEqual([
      DETAILS.back,
      ...answersFor('Switchboard repair', 'REQ-31042'),
      DETAILS.copyReference('REQ-31042'),
    ]);
  });

  it('goes back to the list', async () => {
    const screen = await open();

    await screen.press(DETAILS.back);

    expect(screen.has('vendor-request-details')).toBe(false);
    expect(screen.has('vendor-requests')).toBe(true);
  });
});

describe('Vendor requests — whose requests', () => {
  it('shows another vendor their own list, and the first theirs again', async () => {
    const screen = await render();
    expect(screen.cards()).toHaveLength(11);

    await screen.switchTo(MEENA);
    await screen.press('Requests');

    expect(screen.cards()).toHaveLength(0);
    expect(screen.text('vendor-requests-empty')).toContain(COPY.emptyAllTitle);
    expect(screen.text('vendor-requests')).not.toContain('Switchboard repair');

    await screen.switchTo(RAVI);
    await screen.press('Requests');

    expect(screen.cards()).toHaveLength(11);
    expect(screen.text('vendor-requests')).toContain('Switchboard repair');
  });
});
