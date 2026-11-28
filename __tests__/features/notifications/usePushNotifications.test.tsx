/**
 * usePushNotifications against phase5-contract.md section 6.3, as the app
 * runs it:
 *
 * - a session restored at start-up pairs the device without asking anything;
 *   only a sign in may ask (`mayAskPermission`) — the asking itself, once per
 *   device, is `pushRegistration`'s and tested there;
 * - a push in front is a toast in the notification's own words and the
 *   arrival signal the bell and the inbox read again on — and nothing with
 *   nobody signed in;
 * - a tapped push opens the signed-in role's own details screen by id, or
 *   Notifications without a `requestId` — and nothing with nobody signed in,
 *   or for a vendor whose stack does not have the route;
 * - a tap that started the app waits for the stored session and the role's
 *   stack before it opens anything, and opens it once.
 *
 * The navigation container is a stand-in (`navigationRef` is mocked): what is
 * asserted is the action dispatched to it, which is what a real container
 * would act on. Its `onReady` / `onStateChange` are stood in for by calling the
 * callback the hook returns, which AppRoot hands to the real container; that
 * it still works across the language re-mount is
 * `__tests__/navigation/navigationRefRemount.test.tsx`.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { CommonActions } from '@react-navigation/native';
import { Provider } from 'react-redux';

import {
  authReducer,
  sessionAbsent,
  sessionRestored,
  signedIn,
  signedOut,
} from '@/features/auth/state/authSlice';
import type { SessionPayload } from '@/features/auth/types';
import { usePushNotifications } from '@/features/notifications/hooks/usePushNotifications';
import { onNotificationsArrived } from '@/features/notifications/state/notificationSync';
import { ToastProvider } from '@/shared/components';
import { registerPushDevice } from '@/shared/services/pushRegistration';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { PushMessage, PushPlatform, PushService } from '@/shared/services/types/PushService';
import { ThemeProvider } from '@/shared/theme';

interface FakeNavigation {
  ready: boolean;
  routeNames: string[];
  dispatched: unknown[];
}

jest.mock('@/navigation/navigationRef', () => {
  const navigation = {
    ready: false,
    routeNames: [] as string[],
    dispatched: [] as unknown[],
    isReady: () => navigation.ready,
    getRootState: () => (navigation.ready ? { routeNames: navigation.routeNames } : undefined),
    dispatch: (action: unknown) => {
      navigation.dispatched.push(action);
    },
  };
  return { navigationRef: navigation };
});

jest.mock('@/shared/services/pushRegistration', () => ({
  registerPushDevice: jest.fn(async () => undefined),
}));

const navigation = (jest.requireMock('@/navigation/navigationRef') as { navigationRef: FakeNavigation })
  .navigationRef;
const register = registerPushDevice as jest.Mock;

/** The device's push, delivering what a test tells it to. */
class FakePush implements PushService {
  initial: PushMessage | null = null;
  private readonly foreground = new Set<(message: PushMessage) => void>();
  private readonly opened = new Set<(message: PushMessage) => void>();

  isAvailable(): boolean {
    return true;
  }

  platform(): PushPlatform {
    return 'android';
  }

  async getToken(): Promise<string | null> {
    return 'device-token';
  }

  onTokenRefresh(): () => void {
    return () => undefined;
  }

  onForegroundMessage(listener: (message: PushMessage) => void): () => void {
    this.foreground.add(listener);
    return () => {
      this.foreground.delete(listener);
    };
  }

  onMessageOpened(listener: (message: PushMessage) => void): () => void {
    this.opened.add(listener);
    return () => {
      this.opened.delete(listener);
    };
  }

  async getInitialMessage(): Promise<PushMessage | null> {
    return this.initial;
  }

  handleBackgroundMessages(): void {}

  arrive(message: PushMessage): void {
    [...this.foreground].forEach(listener => listener(message));
  }

  tap(message: PushMessage): void {
    [...this.opened].forEach(listener => listener(message));
  }
}

const CUSTOMER: SessionPayload = {
  token: 'jwt-customer',
  user: { id: 'usr_c', firstName: 'Asha', lastName: 'Patel', phone: '9876543210', role: 'customer' },
};

const VENDOR: SessionPayload = {
  token: 'jwt-vendor',
  user: { id: 'usr_v', firstName: 'Ravi', lastName: 'Kumar', phone: '9000000001', role: 'vendor' },
};

const CUSTOMER_STACK = ['CustomerTabs', 'RequestDetails', 'Notifications'];
const VENDOR_STACK = ['VendorTabs', 'VendorRequestDetails', 'Notifications'];

const ABOUT_A_REQUEST: PushMessage = {
  title: 'Request accepted',
  body: 'Ravi accepted your request.',
  data: { notificationId: 'n-1', type: 'SERVICE_REQUEST', requestId: 'req-1' },
};

const ABOUT_NOTHING: PushMessage = {
  title: 'Welcome',
  data: { notificationId: 'n-2', type: 'GENERAL' },
};

/** What AppRoot passes to the container's `onReady` and `onStateChange`. */
let navigationChanged: () => void = () => undefined;

function Harness() {
  navigationChanged = usePushNotifications();
  return null;
}

let push: FakePush;
let store: ReturnType<typeof createStore>;
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

function createStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

async function render(): Promise<ReactTestRenderer.ReactTestRenderer> {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <Harness />
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);
  return renderer;
}

async function dispatch(action: Parameters<typeof store.dispatch>[0]): Promise<void> {
  await act(async () => {
    store.dispatch(action);
  });
}

/** The role's stack is mounted under the container. */
async function mountStack(routeNames: string[]): Promise<void> {
  await act(async () => {
    navigation.ready = true;
    navigation.routeNames = routeNames;
    // The container's `onReady`, then `onStateChange`, as a real one calls them.
    navigationChanged();
    navigationChanged();
  });
}

function toastText(renderer: ReactTestRenderer.ReactTestRenderer): string | null {
  // The toast's card: the one control that dismisses it, labelled with its message.
  const [card] = renderer.root.findAll(
    node => typeof node.type === 'string' && node.props.accessibilityHint === 'Dismisses this message',
  );
  return card ? String(card.props.accessibilityLabel) : null;
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  push = new FakePush();
  registerService('push', push);
  store = createStore();
  register.mockClear();
  navigation.ready = false;
  navigation.routeNames = [];
  navigation.dispatched = [];
});

afterEach(async () => {
  while (mounted.length > 0) {
    const renderer = mounted.pop()!;
    await act(async () => {
      renderer.unmount();
    });
  }
  resetServices();
  jest.restoreAllMocks();
});

describe('pairing the device with a session', () => {
  it('registers a restored session without asking, and asks only after a sign in', async () => {
    await render();
    expect(register).not.toHaveBeenCalled();

    await dispatch(sessionRestored(CUSTOMER));
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenLastCalledWith({ mayAskPermission: false });

    await dispatch(signedOut());
    expect(register).toHaveBeenCalledTimes(1);

    await dispatch(signedIn(VENDOR));
    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenLastCalledWith({ mayAskPermission: true });
  });

  it('asks after a first sign in on a device with no stored session', async () => {
    await render();
    await dispatch(sessionAbsent());
    expect(register).not.toHaveBeenCalled();

    await dispatch(signedIn(CUSTOMER));
    expect(register).toHaveBeenCalledWith({ mayAskPermission: true });
  });
});

describe('a push in front', () => {
  it('is a toast in its own words, and tells the bell and the inbox to read again', async () => {
    const arrived = jest.fn();
    const stop = onNotificationsArrived(arrived);
    const renderer = await render();
    await dispatch(sessionRestored(CUSTOMER));

    await act(async () => {
      push.arrive(ABOUT_A_REQUEST);
    });

    expect(toastText(renderer)).toBe('Request accepted\nRavi accepted your request.');
    expect(arrived).toHaveBeenCalledTimes(1);
    stop();
  });

  it('says it plainly when the push carries no words', async () => {
    const renderer = await render();
    await dispatch(sessionRestored(VENDOR));

    await act(async () => {
      push.arrive({ data: { notificationId: 'n-3' } });
    });

    expect(toastText(renderer)).toBe('You have a new notification.');
  });

  it('is ignored with nobody signed in', async () => {
    const arrived = jest.fn();
    const stop = onNotificationsArrived(arrived);
    const renderer = await render();
    await dispatch(sessionAbsent());

    await act(async () => {
      push.arrive(ABOUT_A_REQUEST);
    });

    expect(toastText(renderer)).toBeNull();
    expect(arrived).not.toHaveBeenCalled();
    stop();
  });
});

describe('a tapped push', () => {
  it("opens a customer's request in the customer's own details screen, by id", async () => {
    await render();
    await dispatch(sessionRestored(CUSTOMER));
    await mountStack(CUSTOMER_STACK);

    await act(async () => {
      push.tap(ABOUT_A_REQUEST);
    });

    expect(navigation.dispatched).toEqual([
      CommonActions.navigate('RequestDetails', { requestId: 'req-1' }),
    ]);
    // Ids only: none of the notification's words travel in the route.
    expect(JSON.stringify(navigation.dispatched)).not.toContain('Request accepted');
  });

  it("opens a vendor's request in the vendor's own details screen", async () => {
    await render();
    await dispatch(sessionRestored(VENDOR));
    await mountStack(VENDOR_STACK);

    await act(async () => {
      push.tap(ABOUT_A_REQUEST);
    });

    expect(navigation.dispatched).toEqual([
      CommonActions.navigate('VendorRequestDetails', { requestId: 'req-1' }),
    ]);
  });

  it('opens Notifications when the push names no request', async () => {
    await render();
    await dispatch(sessionRestored(CUSTOMER));
    await mountStack(CUSTOMER_STACK);

    await act(async () => {
      push.tap(ABOUT_NOTHING);
    });

    expect(navigation.dispatched).toEqual([CommonActions.navigate('Notifications', undefined)]);
  });

  it('opens nothing with nobody signed in, then or after a later sign in', async () => {
    await render();
    await dispatch(sessionAbsent());
    await mountStack(['AuthEntry', 'CustomerLogin']);

    await act(async () => {
      push.tap(ABOUT_A_REQUEST);
    });
    await dispatch(signedIn(CUSTOMER));
    await mountStack(CUSTOMER_STACK);

    expect(navigation.dispatched).toEqual([]);
  });

  it('opens nothing for a vendor whose stack has no such screen yet', async () => {
    await render();
    await dispatch(sessionRestored(VENDOR));
    await mountStack(['VendorProfileSetup']);

    await act(async () => {
      push.tap(ABOUT_A_REQUEST);
    });
    // Finishing setup later does not open it out of nowhere.
    await mountStack(VENDOR_STACK);

    expect(navigation.dispatched).toEqual([]);
  });

  it('started from closed, waits for the session and the stack, then opens once', async () => {
    push.initial = ABOUT_A_REQUEST;
    await render();
    // The stored session is still being read, and no navigator exists.
    expect(navigation.dispatched).toEqual([]);

    await dispatch(sessionRestored(VENDOR));
    // Signed in, but the vendor's profile check is still on screen: no navigator.
    expect(navigation.dispatched).toEqual([]);

    await mountStack(VENDOR_STACK);
    await mountStack(VENDOR_STACK);

    expect(navigation.dispatched).toEqual([
      CommonActions.navigate('VendorRequestDetails', { requestId: 'req-1' }),
    ]);
  });

  it('started from closed with nobody signed in, opens nothing', async () => {
    push.initial = ABOUT_A_REQUEST;
    await render();

    await dispatch(sessionAbsent());
    await mountStack(['AuthEntry']);

    expect(navigation.dispatched).toEqual([]);
  });
});
