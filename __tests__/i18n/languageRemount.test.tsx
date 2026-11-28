/**
 * AppRoot and the app's language (phase5-contract.md section 7).
 *
 * Three rules a later edit to AppRoot could break without any screen test
 * noticing:
 * - changing the language re-mounts the tree, so a screen that is already on
 *   screen — and would never re-render by itself — shows the new words;
 * - it keeps the user where they were (the navigation state survives the
 *   re-mount), so changing the language from a profile does not drop them on
 *   the first tab;
 * - the saved language is read before anything is drawn: while the read is
 *   pending there is no screen at all, and the first screen drawn is already
 *   in the saved language — but never for longer than
 *   `AppConfig.locale.restoreTimeoutMs`, after which the app starts as a first
 *   launch does and a late answer is ignored.
 *
 * The navigator is a small real stack whose screens are memoised and read copy
 * in render: the only way they can change their words is by being mounted again.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { CommonActions } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { AppRoot } from '@/app/AppRoot';
import { store } from '@/app/store';
import { AppConfig } from '@/core/config/AppConfig';
import { getLocaleState, resetLocaleState, updateLocaleState, type AppLocale } from '@/core/i18n';
import { setLocaleStorage, type LocaleStorage } from '@/core/storage/LocaleStorage';
import { resetLocaleChoiceForTests } from '@/features/language/state/localeChoice';
import { navigationRef } from '@/navigation/navigationRef';
import { ToastProvider } from '@/shared/components';
import { FirebasePushService } from '@/shared/services/device/FirebasePushService';
import { MockNetworkStatusService } from '@/shared/services/mock/MockNetworkStatusService';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import { ThemeProvider } from '@/shared/theme';

let mockScreenMounts = 0;

jest.mock('@/navigation/RootNavigator', () => {
  const ReactActual = jest.requireActual('react');
  const { Text: NativeText } = jest.requireActual('react-native');
  const { createNativeStackNavigator } = jest.requireActual('@react-navigation/native-stack');
  const { AUTH_COPY } = require('@/features/auth/constants/authCopy');

  const Stack = createNativeStackNavigator();

  /** Memoised and prop-less: nothing but a re-mount can make it read its copy again. */
  const Words = ReactActual.memo(function WordsComponent({ testID }: { testID: string }) {
    ReactActual.useEffect(() => {
      mockScreenMounts += 1;
    }, []);
    return <NativeText testID={testID}>{AUTH_COPY.customerLogin.title}</NativeText>;
  });

  function First() {
    return <Words testID="first-screen" />;
  }
  function Second() {
    return <Words testID="second-screen" />;
  }

  function RootNavigator() {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="First" component={First} />
        <Stack.Screen name="Second" component={Second} />
      </Stack.Navigator>
    );
  }

  return { RootNavigator };
});

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  mockScreenMounts = 0;
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
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
  // After the unmount, so whatever the tree left scheduled is dropped with the fake clock.
  jest.useRealTimers();
  // Back to the suite default: English, chosen and restored (jest.setup.js).
  resetLocaleState();
  updateLocaleState({ isChosen: true, isRestored: true });
  resetLocaleChoiceForTests();
});

async function renderApp() {
  registerService('networkStatus', new MockNetworkStatusService());
  registerService('push', new FirebasePushService());

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

  const shown = (testID: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props.testID === testID);
  const words = (testID: string) => String(shown(testID)[0]?.props.children);

  return { renderer, shown, words };
}

async function switchTo(locale: AppLocale) {
  await act(async () => {
    updateLocaleState({ locale });
  });
}

/** A storage whose read is answered when the test says. */
function deferredStorage() {
  let answer!: (locale: AppLocale | null) => void;
  const read = new Promise<AppLocale | null>(resolve => {
    answer = resolve;
  });
  const storage: LocaleStorage = {
    read: jest.fn(() => read),
    write: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  };
  return { storage, answer };
}

describe('AppRoot — changing the language', () => {
  it('re-mounts the tree, so a screen already on screen shows the new words', async () => {
    const { words } = await renderApp();
    expect(words('first-screen')).toBe('Sign in');
    const mountsBefore = mockScreenMounts;

    await switchTo('hi');

    expect(words('first-screen')).toBe('साइन इन करें');
    expect(mockScreenMounts).toBe(mountsBefore + 1);

    await switchTo('gu');

    expect(words('first-screen')).toBe('સાઇન ઇન કરો');
  });

  it('keeps the user where they were', async () => {
    const { words, shown } = await renderApp();
    await act(async () => {
      navigationRef.dispatch(CommonActions.navigate('Second'));
    });
    expect(navigationRef.getCurrentRoute()?.name).toBe('Second');

    await switchTo('hi');

    expect(navigationRef.getCurrentRoute()?.name).toBe('Second');
    expect(shown('second-screen')).toHaveLength(1);
    expect(words('second-screen')).toBe('साइन इन करें');
  });

  it('re-mounts nothing when the language stays the same', async () => {
    await renderApp();
    const mountsBefore = mockScreenMounts;

    await act(async () => {
      updateLocaleState({ isChosen: true });
    });

    expect(mockScreenMounts).toBe(mountsBefore);
  });
});

describe('AppRoot — the saved language', () => {
  it('draws no screen until the saved language is read, then draws it in that language', async () => {
    resetLocaleState();
    resetLocaleChoiceForTests();
    const { storage, answer } = deferredStorage();
    setLocaleStorage(storage);

    const { shown, words } = await renderApp();

    expect(storage.read).toHaveBeenCalledTimes(1);
    expect(shown('app-language-pending')).toHaveLength(1);
    expect(shown('first-screen')).toHaveLength(0);
    expect(mockScreenMounts).toBe(0);

    await act(async () => {
      answer('gu');
    });

    expect(shown('app-language-pending')).toHaveLength(0);
    // The first screen ever drawn is already Gujarati: mounted once, never redrawn from English.
    expect(words('first-screen')).toBe('સાઇન ઇન કરો');
    expect(mockScreenMounts).toBe(1);
    expect(getLocaleState()).toEqual({ locale: 'gu', isChosen: true, isRestored: true });
  });

  it('with nothing saved, opens in English with no language chosen yet', async () => {
    resetLocaleState();
    resetLocaleChoiceForTests();
    const { storage, answer } = deferredStorage();
    setLocaleStorage(storage);

    const { words } = await renderApp();
    await act(async () => {
      answer(null);
    });

    expect(words('first-screen')).toBe('Sign in');
    expect(getLocaleState()).toEqual({ locale: 'en', isChosen: false, isRestored: true });
  });

  /*
    A storage read that never settles (reviewer finding, 28/11/2026) used to
    leave the blank page up for ever. It is given up on after
    `AppConfig.locale.restoreTimeoutMs`, and the app starts as a first launch
    does: English, nothing chosen — which is what puts the chooser in front.
  */
  it('gives up on a read that never answers, and starts as a first launch', async () => {
    jest.useFakeTimers();
    resetLocaleState();
    resetLocaleChoiceForTests();
    setLocaleStorage({
      read: jest.fn(() => new Promise<AppLocale | null>(() => undefined)),
      write: jest.fn(async () => undefined),
      clear: jest.fn(async () => undefined),
    });

    const { shown, words } = await renderApp();
    expect(shown('app-language-pending')).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(AppConfig.locale.restoreTimeoutMs - 1);
    });
    // Still waiting a moment short of the limit: a slow read is not cut off early.
    expect(shown('app-language-pending')).toHaveLength(1);
    expect(mockScreenMounts).toBe(0);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(shown('app-language-pending')).toHaveLength(0);
    expect(words('first-screen')).toBe('Sign in');
    expect(getLocaleState()).toEqual({ locale: 'en', isChosen: false, isRestored: true });
  });

  it('ignores a saved language that arrives after the read was given up on', async () => {
    jest.useFakeTimers();
    resetLocaleState();
    resetLocaleChoiceForTests();
    const { storage, answer } = deferredStorage();
    setLocaleStorage(storage);

    const { words } = await renderApp();
    await act(async () => {
      jest.advanceTimersByTime(AppConfig.locale.restoreTimeoutMs);
    });
    expect(getLocaleState()).toEqual({ locale: 'en', isChosen: false, isRestored: true });
    const mountsBefore = mockScreenMounts;

    await act(async () => {
      answer('gu');
    });

    // Nothing re-mounted under whoever is looking at the chooser.
    expect(getLocaleState()).toEqual({ locale: 'en', isChosen: false, isRestored: true });
    expect(words('first-screen')).toBe('Sign in');
    expect(mockScreenMounts).toBe(mountsBefore);
  });
});
