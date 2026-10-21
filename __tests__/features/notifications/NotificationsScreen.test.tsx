/**
 * The notifications inbox (PROJECT_BIBLE.md sections 57 and 80), for both
 * roles, through the real CustomerNavigator and VendorNavigator and the real
 * mock notification service.
 *
 * Pinned here:
 *
 * - the bell on Home and on the Dashboard opens the inbox, and Back returns;
 *   it shows the unread count ("9+" above nine), none at zero, and none when
 *   the count cannot be read — never an error; its spoken name has the number
 * - the count is read on arrival, again on every return, and again once a
 *   mark lands — so the badge is right after coming back
 * - each row: unread said first and drawn three ways; the body cut on screen
 *   and whole when spoken; a row that can do nothing is not a button
 * - pressing marks read at once and opens a request link in the role's own
 *   details route, by reference only; an unknown link or none opens nothing;
 *   a failed mark puts the row back and says so; two taps send one mark
 * - "Mark all as read": busy while out, five presses one call, nothing changes
 *   on failure, disabled once nothing is unread
 * - loading, empty, a failed first read and its retry, a failed pull, the
 *   next page on scroll and its own failure and retry
 * - one role never reaches the other's routes, and one account never sees
 *   another's notifications
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  NavigationContainer,
  createNavigationContainerRef,
  type NavigationState,
  type PartialState,
} from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { AppConfig } from '@/core/config/AppConfig';
import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { setRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { CustomerNavigator } from '@/navigation/CustomerNavigator';
import { VendorNavigator } from '@/navigation/VendorNavigator';
import { ToastProvider } from '@/shared/components';
import { MockNotificationService } from '@/shared/services/mock/MockNotificationService';
import { MockRequestService } from '@/shared/services/mock/MockRequestService';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { AppNotification } from '@/shared/services/types/NotificationService';
import type { Page } from '@/shared/types/pagination';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = NOTIFICATIONS_COPY.inbox;
const BELL = NOTIFICATIONS_COPY.bell;

const ASHA: AuthUser = {
  id: 'usr_customer_1',
  firstName: 'Asha',
  lastName: 'Patel',
  phone: '9876543210',
  role: 'customer',
};

const VENKATA: AuthUser = {
  id: 'usr_customer_2',
  firstName: 'Venkata Subrahmanya Lakshmi',
  lastName: 'Narasimhamurthy-Ramachandran',
  phone: '9876543211',
  role: 'customer',
};

const NAMELESS: AuthUser = {
  id: 'usr_customer_3',
  firstName: '',
  lastName: '',
  phone: '9876543212',
  role: 'customer',
};

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

/** Asha's fixtures, by what each one is for here. */
const ASHA_ACCEPTED = 'ntf_c1_01'; // unread, opens REQ-24063
const ASHA_LONG = 'ntf_c1_02'; // unread, long, opens REQ-24081
const ASHA_READ_LINKED = 'ntf_c1_03'; // read, opens REQ-24081
const ASHA_UNKNOWN_LINK = 'ntf_c1_06'; // unread, fixora://addresses

/** Ravi's. */
const RAVI_NEW_REQUEST = 'ntf_v1_01'; // unread, opens REQ-31042
const RAVI_TAKEN = 'ntf_v1_03'; // unread, no link
const RAVI_REVIEW = 'ntf_v1_06'; // unread, fixora://reviews
const RAVI_WELCOME = 'ntf_v1_08'; // read, no link

const offline = () => new AppError({ kind: 'network', message: 'offline' });

let current: AuthUser;
let notifications: MockNotificationService;

beforeEach(async () => {
  resetServices();
  current = ASHA;
  const currentUser = async () => current;

  notifications = new MockNotificationService({ latency: NO_LATENCY, currentUser });
  registerService('notification', notifications);

  registerService('category', {
    listServiceCategories: jest.fn(async () => [{ id: 'cat_electrician', name: 'Electrician' }]),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  // The customer's side: Home's recent requests, and the details a link opens.
  registerService('request', new MockRequestService({ latency: NO_LATENCY }));
  setRequestDraftStorage({
    read: async () => null,
    write: async () => true,
    clear: async () => undefined,
  });

  // The vendor's side: setup done, the dashboard, and the details a link opens.
  const profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  registerService('vendorProfile', profiles);
  registerService('vendorDashboard', new MockVendorDashboardService({ latency: NO_LATENCY, currentUser }));
  registerService('vendorRequests', new MockVendorRequestService({ latency: NO_LATENCY, currentUser }));

  setSessionStorage({
    read: async () => ({ token: 'token', user: current }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  current = RAVI;
  await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });
  current = MEENA;
  await profiles.saveProfile({ businessName: 'Iyer Interiors', serviceCategoryIds: ['cat_electrician'] });
  current = ASHA;
});

/*
  Unmounted after every test: a tree left loading leaves the placeholders
  animating, and a mounted bell would go on listening.
*/
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

type Instance = ReactTestRenderer.ReactTestInstance;

/** The text drawn inside one rendered element. */
function textOf(node: Instance): string {
  return node.children.map(child => (typeof child === 'string' ? child : textOf(child))).join(' ');
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

/** Renders the signed-in account's application and, unless told otherwise, opens the inbox. */
async function render(user: AuthUser, { open = true }: { open?: boolean } = {}) {
  current = user;
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user }));
  const navigation = createNavigationContainerRef();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer ref={navigation}>
              {user.role === 'vendor' ? <VendorNavigator /> : <CustomerNavigator />}
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);
  await flush();

  const bellID = user.role === 'vendor' ? 'dashboard-notifications' : 'home-notifications';
  const homeID = user.role === 'vendor' ? 'vendor-dashboard' : 'customer-home';

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

  const list = () =>
    renderer.root.findAll(
      node => node.props?.testID === 'notifications-list' && 'data' in (node.props ?? {}),
    )[0];

  /** A notification's card as a button, or undefined when it is not one. */
  const card = (id: string) =>
    renderer.root.findAll(
      node =>
        node.props?.testID === `notification-${id}` &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    )[0] as Instance | undefined;

  /**
   * The bell, as the button it is — not the component wrapping it, which has
   * the same testID and its own `onPress`.
   */
  const bell = () =>
    renderer.root.findAll(
      node =>
        node.props?.testID === bellID &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    )[0];

  /** Toasts and other announcements whose words begin with `start`. */
  const said = (start: string) =>
    renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props?.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith(start),
    );

  const screen = {
    renderer,
    navigation,
    store,
    hosts,
    host,
    has,
    pressable,
    press,
    list,
    card,
    bell,
    said,
    flush,
    text: (id: string) => (has(id) ? textOf(host(id)) : ''),
    /** What the list holds, read from its data — a FlatList mounts only its first screenful. */
    listed: (): AppNotification[] => list().props.data as AppNotification[],
    /** The placeholders in the loading region, which is not the list. */
    placeholders: (): number =>
      has('notifications-loading') ? host('notifications-loading').children.length : 0,
    /**
     * The testID of every native view on the inbox that says it is busy — Home
     * is still mounted underneath, so only the inbox's own subtree is read.
     *
     * Ids, not the nodes: a failed match on a test instance makes jest print it,
     * and printing one walks the whole fiber tree — the run never finishes.
     */
    busy: (): Array<string | undefined> =>
      host('notifications')
        .findAll(
          node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true,
        )
        .map(node => node.props.testID),
    isUnread: (id: string) => has(`notification-${id}-unread`),
    onInbox: () => has('notifications'),
    onHome: () => navigation.getCurrentRoute()?.name === (user.role === 'vendor' ? 'Dashboard' : 'Home'),
    badge: () => (has(`${bellID}-badge`) ? textOf(host(`${bellID}-badge`)) : null),
    homeID,
    openInbox: async () => {
      await act(async () => {
        screen.bell().props.onPress();
      });
      await flush();
    },
    back: () => screen.press(COPY.back),
    pressCard: async (id: string) => {
      const target = screen.card(id);
      if (!target) {
        throw new Error(`Notification ${id} is not a button`);
      }
      await act(async () => {
        target.props.onPress();
      });
      await flush();
    },
    markAll: () => pressable(COPY.markAll)[0],
    endReached: async () => {
      await act(async () => {
        list().props.onEndReached();
      });
      await flush();
    },
    pull: async () => {
      await act(async () => {
        list().props.onRefresh();
      });
      await flush();
    },
    /** Every route name any mounted navigator could navigate to. */
    routeNames: (): string[] => {
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
    },
  };

  if (open) {
    await screen.openInbox();
  }

  return screen;
}

describe('Notifications — the bell', () => {
  it('sits on Home with the unread count, said in words', async () => {
    const screen = await render(ASHA, { open: false });

    expect(screen.has('customer-home')).toBe(true);
    expect(screen.badge()).toBe('6');
    expect(screen.bell().props.accessibilityLabel).toBe('Notifications, 6 unread');
    expect(screen.bell().props.accessibilityHint).toBe(BELL.hint);
    expect(screen.bell().props.accessibilityRole).toBe('button');
  });

  it('sits on the Dashboard with the vendor’s own count', async () => {
    const screen = await render(RAVI, { open: false });

    expect(screen.has('vendor-dashboard')).toBe(true);
    expect(screen.badge()).toBe('5');
    expect(screen.bell().props.accessibilityLabel).toBe('Notifications, 5 unread');
  });

  it('draws "9+" above nine, and says the exact number', async () => {
    const screen = await render(VENKATA, { open: false });

    expect(screen.badge()).toBe('9+');
    expect(screen.bell().props.accessibilityLabel).toBe('Notifications, 22 unread');
  });

  it('draws no badge with nothing unread', async () => {
    const screen = await render(NAMELESS, { open: false });

    expect(screen.badge()).toBeNull();
    expect(screen.bell().props.accessibilityLabel).toBe('Notifications');
  });

  it('draws no badge — and no error — when the count cannot be read', async () => {
    jest.spyOn(notifications, 'getUnreadCount').mockRejectedValue(offline());
    const screen = await render(ASHA, { open: false });

    expect(screen.badge()).toBeNull();
    expect(screen.bell().props.accessibilityLabel).toBe('Notifications');
    // Home is otherwise as it was: nothing about the failure appears on it.
    expect(screen.said('No internet connection')).toHaveLength(0);
    expect(screen.hosts(id => id.endsWith('-error'))).toHaveLength(0);
    expect(screen.pressable('Try again')).toHaveLength(0);
  });

  it('is a touch target of at least 44dp', async () => {
    const screen = await render(ASHA, { open: false });

    const style = StyleSheet.flatten(screen.bell().props.style({ pressed: false }));
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
  });

  it('reads the count once on arrival, and again on every return', async () => {
    const count = jest.spyOn(notifications, 'getUnreadCount');
    const screen = await render(ASHA, { open: false });
    expect(count).toHaveBeenCalledTimes(1);

    await screen.openInbox();
    await screen.back();

    expect(screen.onHome()).toBe(true);
    expect(count).toHaveBeenCalledTimes(2);
  });
});

describe('Notifications — getting there and back', () => {
  it('opens from Home’s bell, and Back returns to Home', async () => {
    const screen = await render(ASHA);

    expect(screen.onInbox()).toBe(true);
    expect(screen.text('notifications-heading')).toBe(COPY.title);
    expect(screen.navigation.getCurrentRoute()?.name).toBe('Notifications');

    await screen.back();
    expect(screen.onInbox()).toBe(false);
    expect(screen.onHome()).toBe(true);
  });

  it('opens from the Dashboard’s bell, and Back returns to the Dashboard', async () => {
    const screen = await render(RAVI);

    expect(screen.onInbox()).toBe(true);
    await screen.back();
    expect(screen.onHome()).toBe(true);
  });

  it('carries nothing in the route', async () => {
    const screen = await render(ASHA);

    expect(screen.navigation.getCurrentRoute()?.params).toBeUndefined();
  });

  it('gives each role its own inbox route and its own request route, never the other’s', async () => {
    const customer = await render(ASHA, { open: false });
    expect(customer.routeNames()).toEqual(expect.arrayContaining(['Notifications', 'RequestDetails']));
    expect(customer.routeNames()).not.toContain('VendorRequestDetails');

    const vendor = await render(RAVI, { open: false });
    const names = vendor.routeNames();
    expect(names).toEqual(expect.arrayContaining(['Notifications', 'VendorRequestDetails']));
    expect(names).not.toContain('RequestDetails');
  });
});

describe('Notifications — the list', () => {
  it('lists the first page, newest first, in the service’s order', async () => {
    const screen = await render(ASHA);
    const first = await notifications.list({
      page: AppConfig.pagination.initialPage,
      pageSize: AppConfig.pagination.defaultPageSize,
    });

    expect(screen.listed().map(item => item.id)).toEqual(first.items.map(item => item.id));
    expect(screen.listed()).toHaveLength(AppConfig.pagination.defaultPageSize);
  });

  it('says an unread notification as one block, "Unread" first, and draws it three ways', async () => {
    const screen = await render(ASHA);

    const label = String(screen.card(ASHA_ACCEPTED)?.props.accessibilityLabel);
    expect(label).toBe(
      'Unread. Request accepted. Bright Spark Electrical Services and Repairs accepted your ' +
        'Fan Repair request REQ-24063. 4 min ago.',
    );
    expect(screen.isUnread(ASHA_ACCEPTED)).toBe(true);
    // The dot is decoration: the words above already say it.
    const content = screen.host(`notification-${ASHA_ACCEPTED}-content`);
    expect(content.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('draws a read notification quietly and says nothing about it being read', async () => {
    const screen = await render(ASHA);

    expect(screen.isUnread(ASHA_READ_LINKED)).toBe(false);
    const label = String(screen.card(ASHA_READ_LINKED)?.props.accessibilityLabel);
    expect(label.startsWith('Request received.')).toBe(true);
    expect(label).not.toMatch(/unread/i);
  });

  it('cuts a long body to two lines on screen and says all of it', async () => {
    const screen = await render(ASHA);
    const long = screen.listed().find(item => item.id === ASHA_LONG) as AppNotification;

    expect(screen.host(`notification-${ASHA_LONG}-body`).props.numberOfLines).toBe(2);
    expect(screen.host(`notification-${ASHA_LONG}-title`).props.numberOfLines).toBeUndefined();
    expect(String(screen.card(ASHA_LONG)?.props.accessibilityLabel)).toContain(long.body);
  });

  it('hints at what pressing does', async () => {
    const screen = await render(RAVI);

    expect(screen.card(RAVI_NEW_REQUEST)?.props.accessibilityHint).toBe(COPY.openRequestHint);
    expect(screen.card(RAVI_TAKEN)?.props.accessibilityHint).toBe(COPY.markReadHint);
    expect(screen.card(RAVI_REVIEW)?.props.accessibilityHint).toBe(COPY.markReadHint);
  });

  it('does not make a read notification with nothing to open into a button', async () => {
    const screen = await render(RAVI);

    expect(screen.card(RAVI_WELCOME)).toBeUndefined();
    // It still speaks, as one block.
    const content = screen.host(`notification-${RAVI_WELCOME}-content`);
    expect(content.props.accessible).toBe(true);
    expect(String(content.props.accessibilityLabel).startsWith('Your business is on Fixora.')).toBe(true);
  });
});

describe('Notifications — pressing one', () => {
  it('marks an unread one read and opens the customer’s request, by reference only', async () => {
    const mark = jest.spyOn(notifications, 'markAsRead');
    const screen = await render(ASHA);

    await screen.pressCard(ASHA_ACCEPTED);

    expect(mark).toHaveBeenCalledTimes(1);
    expect(mark).toHaveBeenCalledWith(ASHA_ACCEPTED);
    const route = screen.navigation.getCurrentRoute();
    expect(route?.name).toBe('RequestDetails');
    expect(route?.params).toEqual({ requestId: 'REQ-24063' });
    expect(Object.keys(route?.params ?? {})).toEqual(['requestId']);

    await screen.back();
    expect(screen.onInbox()).toBe(true);
    expect(screen.isUnread(ASHA_ACCEPTED)).toBe(false);
  });

  it('opens the vendor’s own request details, never the customer’s route', async () => {
    const mark = jest.spyOn(notifications, 'markAsRead');
    const screen = await render(RAVI);

    await screen.pressCard(RAVI_NEW_REQUEST);

    expect(mark).toHaveBeenCalledWith(RAVI_NEW_REQUEST);
    const route = screen.navigation.getCurrentRoute();
    expect(route?.name).toBe('VendorRequestDetails');
    expect(route?.params).toEqual({ requestId: 'REQ-31042' });
    expect(screen.has('vendor-request-details')).toBe(true);
  });

  it('opens a read one without marking it again', async () => {
    const mark = jest.spyOn(notifications, 'markAsRead');
    const screen = await render(ASHA);

    await screen.pressCard(ASHA_READ_LINKED);

    expect(mark).not.toHaveBeenCalled();
    expect(screen.navigation.getCurrentRoute()?.params).toEqual({ requestId: 'REQ-24081' });
  });

  it('marks one with a link it does not understand as read, and opens nothing', async () => {
    const mark = jest.spyOn(notifications, 'markAsRead');
    const screen = await render(ASHA);

    await screen.pressCard(ASHA_UNKNOWN_LINK);

    expect(mark).toHaveBeenCalledWith(ASHA_UNKNOWN_LINK);
    expect(screen.navigation.getCurrentRoute()?.name).toBe('Notifications');
    expect(screen.isUnread(ASHA_UNKNOWN_LINK)).toBe(false);
    // Read, with nothing to open: no longer a button.
    expect(screen.card(ASHA_UNKNOWN_LINK)).toBeUndefined();
  });

  it('marks one with no link as read, and opens nothing', async () => {
    const screen = await render(RAVI);

    await screen.pressCard(RAVI_TAKEN);

    expect(screen.navigation.getCurrentRoute()?.name).toBe('Notifications');
    expect(screen.isUnread(RAVI_TAKEN)).toBe(false);
    expect(await notifications.getUnreadCount()).toBe(4);
  });

  it('marks it read at once, before the service answers', async () => {
    const answer = held<void>();
    jest.spyOn(notifications, 'markAsRead').mockImplementationOnce(() => answer.promise);
    const screen = await render(ASHA);

    await screen.pressCard(ASHA_UNKNOWN_LINK);
    expect(screen.isUnread(ASHA_UNKNOWN_LINK)).toBe(false);

    await act(async () => {
      answer.land();
    });
    await screen.flush();
    expect(screen.isUnread(ASHA_UNKNOWN_LINK)).toBe(false);
  });

  it('puts it back to unread and says so when the mark fails', async () => {
    jest.spyOn(notifications, 'markAsRead').mockRejectedValueOnce(offline());
    const screen = await render(ASHA);

    await screen.pressCard(ASHA_UNKNOWN_LINK);

    expect(screen.isUnread(ASHA_UNKNOWN_LINK)).toBe(true);
    expect(screen.card(ASHA_UNKNOWN_LINK)).toBeDefined();
    expect(screen.said(`${COPY.markFailed} No internet connection`).length).toBeGreaterThan(0);
  });

  it('still opens the request when the mark fails, and the row is unread behind it', async () => {
    jest.spyOn(notifications, 'markAsRead').mockRejectedValueOnce(offline());
    const screen = await render(ASHA);

    await screen.pressCard(ASHA_ACCEPTED);

    expect(screen.navigation.getCurrentRoute()?.name).toBe('RequestDetails');
    expect(screen.said(COPY.markFailed).length).toBeGreaterThan(0);
    await screen.back();
    expect(screen.isUnread(ASHA_ACCEPTED)).toBe(true);
  });

  it('sends one mark for two taps', async () => {
    const answer = held<void>();
    const mark = jest.spyOn(notifications, 'markAsRead').mockImplementation(() => answer.promise);
    const screen = await render(RAVI);
    const target = screen.card(RAVI_REVIEW) as Instance;

    await act(async () => {
      target.props.onPress();
      target.props.onPress();
    });
    await screen.flush();

    expect(mark).toHaveBeenCalledTimes(1);
    await act(async () => {
      answer.land();
    });
  });

  it('updates the badge once back on Home', async () => {
    const screen = await render(ASHA);

    await screen.pressCard(ASHA_UNKNOWN_LINK);
    await screen.back();

    expect(screen.onHome()).toBe(true);
    expect(screen.badge()).toBe('5');
    expect(screen.bell().props.accessibilityLabel).toBe('Notifications, 5 unread');
  });

  it('counts a mark that lands after coming back — the bell reads again when it does', async () => {
    const answer = held<void>();
    const real = notifications.markAsRead.bind(notifications);
    jest.spyOn(notifications, 'markAsRead').mockImplementationOnce(async id => {
      await answer.promise;
      return real(id);
    });
    const screen = await render(ASHA);

    await screen.pressCard(ASHA_UNKNOWN_LINK);
    await screen.back();
    // Back before the mark landed: the read on return still counts it unread.
    expect(screen.badge()).toBe('6');

    await act(async () => {
      answer.land();
    });
    await screen.flush();
    expect(screen.badge()).toBe('5');
  });
});

describe('Notifications — mark all as read', () => {
  it('marks every one read once the service agrees, and says so', async () => {
    const screen = await render(ASHA);

    await screen.press(COPY.markAll);

    expect(screen.listed().every(item => item.read)).toBe(true);
    expect(screen.isUnread(ASHA_ACCEPTED)).toBe(false);
    expect(screen.said(COPY.markedAll).length).toBeGreaterThan(0);
    expect(screen.markAll().props.accessibilityState).toEqual({ disabled: true, busy: false });
    expect(await notifications.getUnreadCount()).toBe(0);
  });

  it('is busy while the call is out, changes nothing until it answers, and sends one call for five presses', async () => {
    const answer = held<void>();
    const real = notifications.markAllAsRead.bind(notifications);
    const markAll = jest.spyOn(notifications, 'markAllAsRead').mockImplementationOnce(async () => {
      await answer.promise;
      return real();
    });
    const screen = await render(ASHA);

    const button = screen.markAll();
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        button.props.onPress();
      }
    });
    await screen.flush();

    expect(markAll).toHaveBeenCalledTimes(1);
    expect(screen.markAll().props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(screen.isUnread(ASHA_ACCEPTED)).toBe(true);

    await act(async () => {
      answer.land();
    });
    await screen.flush();
    expect(screen.isUnread(ASHA_ACCEPTED)).toBe(false);
  });

  it('changes nothing and says so when it fails, and can be pressed again', async () => {
    jest.spyOn(notifications, 'markAllAsRead').mockRejectedValueOnce(offline());
    const screen = await render(ASHA);

    await screen.press(COPY.markAll);

    expect(screen.isUnread(ASHA_ACCEPTED)).toBe(true);
    expect(screen.listed().filter(item => !item.read)).toHaveLength(6);
    expect(screen.said(`${COPY.markAllFailed} No internet connection`).length).toBeGreaterThan(0);
    expect(screen.markAll().props.accessibilityState).toEqual({ disabled: false, busy: false });

    await screen.press(COPY.markAll);
    expect(screen.isUnread(ASHA_ACCEPTED)).toBe(false);
  });

  it('clears the badge on Home', async () => {
    const screen = await render(RAVI);

    await screen.press(COPY.markAll);
    await screen.back();

    expect(screen.badge()).toBeNull();
    expect(screen.bell().props.accessibilityLabel).toBe('Notifications');
  });

  it('draws the next page read when it was fetched before the mark and lands after it', async () => {
    // Every one of the second customer's is unread, the second page's too.
    const screen = await render(VENKATA);
    const page = held<Page<AppNotification>>();
    const real = notifications.list.bind(notifications);
    // The next page as the service answered it before anything was marked.
    const stale = await real({
      page: AppConfig.pagination.initialPage + 1,
      pageSize: AppConfig.pagination.defaultPageSize,
    });
    expect(stale.items.every(item => !item.read)).toBe(true);
    jest.spyOn(notifications, 'list').mockImplementationOnce(() => page.promise);

    await screen.endReached();
    await screen.press(COPY.markAll);
    await act(async () => {
      page.land(stale);
    });
    await screen.flush();

    expect(screen.listed()).toHaveLength(22);
    expect(screen.listed().every(item => item.read)).toBe(true);
    expect(screen.markAll().props.accessibilityState).toEqual({ disabled: true, busy: false });
  });
});

describe('Notifications — states', () => {
  it('holds placeholders while the first page loads, in one named and busy region', async () => {
    const page = held<Page<AppNotification>>();
    jest.spyOn(notifications, 'list').mockImplementationOnce(() => page.promise);
    const screen = await render(ASHA);

    expect(screen.placeholders()).toBe(5);
    expect(screen.listed()).toEqual([]);
    const region = screen.host('notifications-loading');
    expect(region.props.accessibilityLabel).toBe(COPY.loading);
    expect(region.props.accessibilityState).toEqual({ busy: true });
    expect(screen.busy()).toEqual(['notifications-loading']);
    // The list itself is not a stop: it carries no name, role or state.
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.list().props.accessibilityRole).toBeUndefined();
    expect(screen.pressable(COPY.markAll)).toHaveLength(0);

    await act(async () => {
      page.fail(offline());
    });
    await screen.flush();
    // The failure in its own words, under a list that is still no stop of its own.
    expect(screen.has('notifications-error')).toBe(true);
    expect(screen.text('notifications-error')).toContain(COPY.failedTitle);
    expect(screen.has('notifications-loading')).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });

  it('replaces the busy region once the first page lands, and leaves the list unnamed', async () => {
    // The list used to be named on every render — "Loading your
    // notifications", then "Your notifications" — so loaded, TalkBack stopped
    // on it to say what the heading had just said. Now the wait is its own
    // region, and it is gone, not updated, when the notifications arrive.
    // The service's own first page, held until the test lets it through.
    const gate = held<void>();
    const real = notifications.list.bind(notifications);
    jest
      .spyOn(notifications, 'list')
      .mockImplementationOnce(request => gate.promise.then(() => real(request)));
    const screen = await render(ASHA);

    const waiting = screen.host('notifications-loading');
    expect(waiting.props.accessibilityState).toEqual({ busy: true });

    await act(async () => {
      gate.land();
    });
    await screen.flush();

    expect(screen.listed()).toHaveLength(AppConfig.pagination.defaultPageSize);
    // Not hidden or emptied: no longer in the tree at all, so its busy cannot outlive it.
    expect(screen.has('notifications-loading')).toBe(false);
    expect(screen.list() === waiting).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.list().props.accessibilityRole).toBeUndefined();
    // Nothing anywhere on the loaded inbox still says busy.
    expect(screen.busy()).toEqual([]);
  });

  it('says calmly when there are none, with nothing to mark', async () => {
    const screen = await render(NAMELESS);

    expect(screen.has('notifications-empty')).toBe(true);
    expect(screen.text('notifications-empty')).toContain(COPY.emptyTitle);
    expect(screen.text('notifications-empty')).toContain(COPY.emptyMessage);
    expect(screen.pressable(COPY.markAll)).toHaveLength(0);
    // Its own words, under a list that is still no stop of its own.
    expect(screen.has('notifications-loading')).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });

  it('gives Meena an empty inbox too', async () => {
    const screen = await render(MEENA);

    expect(screen.has('notifications-empty')).toBe(true);
    expect(screen.badge()).toBeNull();
  });

  it('shows a failed first read with Try again, and reads again once for it', async () => {
    const list = jest.spyOn(notifications, 'list').mockRejectedValueOnce(offline());
    const screen = await render(ASHA);

    expect(screen.has('notifications-error')).toBe(true);
    expect(screen.text('notifications-error')).toContain(COPY.failedTitle);
    expect(screen.list().props.onRefresh).toBeUndefined();
    expect(list).toHaveBeenCalledTimes(1);

    await screen.press('Try again');

    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.has('notifications-error')).toBe(false);
    expect(screen.listed()).toHaveLength(AppConfig.pagination.defaultPageSize);
  });

  it('keeps the notifications when a pull fails, and says so above them', async () => {
    const screen = await render(ASHA);
    const list = jest.spyOn(notifications, 'list').mockRejectedValueOnce(offline());

    await screen.pull();

    expect(screen.listed()).toHaveLength(AppConfig.pagination.defaultPageSize);
    expect(screen.has('notifications-refresh-error')).toBe(true);
    expect(screen.text('notifications-refresh-error')).toContain(COPY.refreshFailedTitle);

    await screen.press('Try again');
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.has('notifications-refresh-error')).toBe(false);
  });

  it('loads the next page as the end comes into reach', async () => {
    const list = jest.spyOn(notifications, 'list');
    const screen = await render(ASHA);

    await screen.endReached();

    expect(list).toHaveBeenLastCalledWith({
      page: AppConfig.pagination.initialPage + 1,
      pageSize: AppConfig.pagination.defaultPageSize,
    });
    expect(screen.listed()).toHaveLength(22);

    // Nothing more to ask for.
    await screen.endReached();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('shows the next page loading under the list', async () => {
    const screen = await render(ASHA);
    const page = held<Page<AppNotification>>();
    jest.spyOn(notifications, 'list').mockImplementationOnce(() => page.promise);

    await screen.endReached();

    expect(screen.pressable(COPY.loadingMore)).toHaveLength(0);
    expect(
      screen.renderer.root.findAll(node => node.props?.accessibilityLabel === COPY.loadingMore).length,
    ).toBeGreaterThan(0);
    await act(async () => {
      page.fail(offline());
    });
  });

  it('says when the next page fails, keeps what it has, and retries that page', async () => {
    const screen = await render(ASHA);
    const list = jest.spyOn(notifications, 'list').mockRejectedValueOnce(offline());

    await screen.endReached();

    expect(screen.listed()).toHaveLength(AppConfig.pagination.defaultPageSize);
    expect(screen.has('notifications-more-error')).toBe(true);
    expect(screen.text('notifications-more-error')).toContain(COPY.moreFailedTitle);

    // Scrolling on past a failure does not retry it.
    await screen.endReached();
    expect(list).toHaveBeenCalledTimes(1);

    await screen.press('Try again');
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith({
      page: AppConfig.pagination.initialPage + 1,
      pageSize: AppConfig.pagination.defaultPageSize,
    });
    expect(screen.listed()).toHaveLength(22);
  });
});

describe('Notifications — whose they are', () => {
  it('shows a vendor only the vendor’s own', async () => {
    const screen = await render(RAVI);

    expect(screen.listed()).toHaveLength(8);
    expect(screen.listed().every(item => item.id.startsWith('ntf_v1_'))).toBe(true);
    expect(JSON.stringify(screen.listed())).not.toContain('REQ-24063');
  });

  it('shows a customer none of a vendor’s', async () => {
    const screen = await render(ASHA);

    expect(screen.listed().every(item => item.id.startsWith('ntf_c1_'))).toBe(true);
    expect(JSON.stringify(screen.listed())).not.toContain('REQ-31042');
  });
});
