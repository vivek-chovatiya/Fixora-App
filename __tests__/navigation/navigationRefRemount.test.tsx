/**
 * A tapped push still opens its screen after the language has been changed.
 *
 * Changing the language re-mounts the tree under AppRoot, navigation container
 * included (core/i18n, AppRoot's docblock), while `usePushNotifications` lives
 * in AppRoot itself and is never re-mounted. A tap that arrives while the
 * signed-in role's stack is not mounted yet is held, and opened when the
 * container says it is ready or its state changes.
 *
 * ⚠️ The defect this pins (28/11/2026). The hook used to hear those moments
 * through `navigationRef.addListener`. React Navigation's ref remembers a
 * listener — and hands it to every container mounted later — only when it is
 * added while no container is mounted; added while one is, it is given to that
 * container alone and goes with it. So whether a held tap opened after a
 * language change depended on whether the saved language had been read before
 * AppRoot first drew (a race against storage on the device, always so in
 * tests). AppRoot now passes the hook's callback to each container's
 * `onReady` / `onStateChange`, which every new container calls by itself.
 *
 * Real AppRoot, real container and a real stack; the role's root (here
 * `CustomerTabs`) appears when the test says, standing in for the moment a
 * vendor's profile check or a sign in finishes.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { AppRoot } from '@/app/AppRoot';
import { resetLocaleState, updateLocaleState } from '@/core/i18n';
import {
  getSessionStorage,
  setSessionStorage,
  type SessionStorage,
} from '@/core/storage/SessionStorage';
import { authReducer } from '@/features/auth/state/authSlice';
import type { SessionPayload } from '@/features/auth/types';
import { resetLocaleChoiceForTests } from '@/features/language/state/localeChoice';
import { navigationRef } from '@/navigation/navigationRef';
import { ToastProvider } from '@/shared/components';
import { MockNetworkStatusService } from '@/shared/services/mock/MockNetworkStatusService';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { PushMessage, PushPlatform, PushService } from '@/shared/services/types/PushService';
import { ThemeProvider } from '@/shared/theme';

/** Shows or hides the role's stack in the stand-in navigator below. */
let mockShowRoleStack: ((shown: boolean) => void) | null = null;

jest.mock('@/navigation/RootNavigator', () => {
  const ReactActual = jest.requireActual('react');
  const { Text: NativeText } = jest.requireActual('react-native');
  const { createNativeStackNavigator } = jest.requireActual('@react-navigation/native-stack');

  const Stack = createNativeStackNavigator();

  function Gate() {
    return <NativeText testID="gate">gate</NativeText>;
  }
  function Home() {
    return <NativeText testID="home">home</NativeText>;
  }
  function Details({ route }: { route: { params: { requestId: string } } }) {
    return <NativeText testID="details">{route.params.requestId}</NativeText>;
  }

  /** Starts on a gate that is not the role's root, as every re-mount does here. */
  function RootNavigator() {
    const [roleStack, setRoleStack] = ReactActual.useState(false);
    mockShowRoleStack = setRoleStack;

    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {roleStack ? (
          <>
            <Stack.Screen name="CustomerTabs" component={Home} />
            <Stack.Screen name="RequestDetails" component={Details} />
          </>
        ) : (
          <Stack.Screen name="Gate" component={Gate} />
        )}
      </Stack.Navigator>
    );
  }

  return { RootNavigator };
});

jest.mock('@/shared/services/pushRegistration', () => ({
  registerPushDevice: jest.fn(async () => undefined),
}));

/** The device's push, tapped when a test says. */
class FakePush implements PushService {
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

  onForegroundMessage(): () => void {
    return () => undefined;
  }

  onMessageOpened(listener: (message: PushMessage) => void): () => void {
    this.opened.add(listener);
    return () => {
      this.opened.delete(listener);
    };
  }

  async getInitialMessage(): Promise<PushMessage | null> {
    return null;
  }

  handleBackgroundMessages(): void {}

  tap(message: PushMessage): void {
    [...this.opened].forEach(listener => listener(message));
  }
}

const CUSTOMER: SessionPayload = {
  token: 'jwt-customer',
  user: { id: 'usr_c', firstName: 'Asha', lastName: 'Patel', phone: '9876543210', role: 'customer' },
};

const ABOUT_A_REQUEST: PushMessage = {
  title: 'Request accepted',
  body: 'Ravi accepted your request.',
  data: { notificationId: 'n-1', type: 'REQUEST_ACCEPTED', requestId: 'req-42' },
};

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

/** A stored session that is always the customer's, so `restoreSession` signs them in. */
const STORED_CUSTOMER: SessionStorage = {
  read: async () => CUSTOMER,
  write: async () => undefined,
  clear: async () => undefined,
} as unknown as SessionStorage;

const realSessionStorage = getSessionStorage();
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
let push: FakePush;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  setSessionStorage(STORED_CUSTOMER);
  push = new FakePush();
});

afterEach(async () => {
  while (mounted.length > 0) {
    const renderer = mounted.pop()!;
    await act(async () => {
      renderer.unmount();
    });
  }
  mockShowRoleStack = null;
  setSessionStorage(realSessionStorage);
  resetServices();
  jest.restoreAllMocks();
  // Back to the suite default: English, chosen and restored (jest.setup.js).
  resetLocaleState();
  updateLocaleState({ isChosen: true, isRestored: true });
  resetLocaleChoiceForTests();
});

async function renderApp() {
  registerService('networkStatus', new MockNetworkStatusService());
  registerService('push', push);
  const store = configureStore({ reducer: { auth: authReducer } });

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <SafeAreaProvider initialMetrics={METRICS}>
          <ThemeProvider>
            <ToastProvider>
              <AppRoot />
            </ToastProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);
  expect(store.getState().auth.status).toBe('authenticated');

  const shown = (testID: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props.testID === testID);
  return { shown };
}

async function showRoleStack() {
  await act(async () => {
    mockShowRoleStack?.(true);
  });
}

async function tap(message: PushMessage) {
  await act(async () => {
    push.tap(message);
  });
}

/** How many routes in the root stack are this one: a tap must open its screen once. */
function routesNamed(name: string): number {
  return navigationRef.getRootState()?.routes.filter(route => route.name === name).length ?? 0;
}

describe('a tapped push and the language re-mount', () => {
  it('before any change, a tap held at the gate opens once the role’s stack is there', async () => {
    const { shown } = await renderApp();
    expect(shown('gate')).toHaveLength(1);

    await tap(ABOUT_A_REQUEST);
    expect(navigationRef.getCurrentRoute()?.name).toBe('Gate');

    await showRoleStack();

    expect(navigationRef.getCurrentRoute()?.name).toBe('RequestDetails');
    expect(navigationRef.getCurrentRoute()?.params).toEqual({ requestId: 'req-42' });
    expect(routesNamed('RequestDetails')).toBe(1);
  });

  it('after changing the language, a tap held at the gate still opens, once', async () => {
    const { shown } = await renderApp();

    await act(async () => {
      updateLocaleState({ locale: 'hi' });
    });
    // A new container and a new navigator: back at the gate.
    expect(shown('gate')).toHaveLength(1);

    await tap(ABOUT_A_REQUEST);
    expect(navigationRef.getCurrentRoute()?.name).toBe('Gate');

    await showRoleStack();

    expect(navigationRef.getCurrentRoute()?.name).toBe('RequestDetails');
    expect(navigationRef.getCurrentRoute()?.params).toEqual({ requestId: 'req-42' });
    expect(shown('details')[0]?.props.children).toBe('req-42');
    expect(routesNamed('RequestDetails')).toBe(1);
  });

  it('after two changes, a tap with the role’s stack already mounted opens at once', async () => {
    await renderApp();
    await showRoleStack();

    await act(async () => {
      updateLocaleState({ locale: 'gu' });
    });
    await act(async () => {
      updateLocaleState({ locale: 'en' });
    });
    await showRoleStack();
    expect(navigationRef.getCurrentRoute()?.name).toBe('CustomerTabs');

    await tap(ABOUT_A_REQUEST);

    expect(navigationRef.getCurrentRoute()?.name).toBe('RequestDetails');
    expect(routesNamed('RequestDetails')).toBe(1);
  });
});
