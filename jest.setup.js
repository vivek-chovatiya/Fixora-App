/* eslint-env jest */

/**
 * Jest setup
 *
 * Native modules have no implementation under Jest, so each one used at app
 * startup is either given the library's own setup or mocked here. Without this,
 * rendering <App /> fails on the native module rather than on anything the test
 * is actually asserting.
 */

require('react-native-gesture-handler/jestSetup');

/**
 * The clipboard package resolves its native module at import time, so any file
 * importing it fails to load under Jest. The library ships its own mock for
 * exactly this; tests that care about copying inject a fake through
 * `setClipboard` instead.
 */
jest.mock(
  '@react-native-clipboard/clipboard',
  () => require('@react-native-clipboard/clipboard/jest/clipboard-mock.js'),
);

/**
 * Permissions resolve through a native module, so importing the library at all
 * fails under Jest. The library ships its own mock for exactly this; tests that
 * care about a permission outcome register a stub PermissionService instead of
 * driving this.
 */
jest.mock('react-native-permissions', () =>
  require('react-native-permissions/mock'),
);

/**
 * NetInfo resolves a native module too, and the registry imports it for the
 * device's network status, so every suite that touches the registry would fail
 * to load without this. The library ships its own mock (online by default);
 * tests that care about being offline register a `MockNetworkStatusService`
 * instead of driving this.
 */
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

/**
 * `useSafeAreaInsets` throws rather than guessing when no provider sits above
 * it, which would make every tree containing a toast wrap itself for a reason
 * no test is about.
 *
 * Only that hook is replaced. The library's own mock swaps the whole module and
 * takes SafeAreaView with it, which Screen renders — so the rest is left real.
 */
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };

  return {
    ...actual,
    useSafeAreaInsets: () => insets,
  };
});

/**
 * AsyncStorage v3 no longer ships a jest mock, so this provides an in-memory
 * one. Backed by a real Map rather than bare jest.fn()s so SessionStorage's
 * read-after-write behaviour is exercised honestly.
 */
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
      setItem: jest.fn(async (key, value) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async key => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

/**
 * Firebase (push notifications, phase5-contract.md section 6). Its packages build
 * a native event emitter the moment they load, which does not exist under Jest,
 * and only `FirebasePushService` ever loads them. Both are replaced here, so no
 * suite needs the native module and none sends anything.
 *
 * The default is the build the app has today: no Firebase app configured
 * (`getApps()` is empty), so push is off everywhere unless a suite says
 * otherwise. A suite that wants push on makes `getApps` answer
 * `[{ name: '[DEFAULT]' }]` and drives the messaging functions below, each a
 * plain `jest.fn`; listeners hand back an unsubscribe.
 */
jest.mock('@react-native-firebase/app', () => ({
  getApps: jest.fn(() => []),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(async () => 'test-fcm-token'),
  onTokenRefresh: jest.fn(() => jest.fn()),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(async () => null),
  setBackgroundMessageHandler: jest.fn(),
}));

/**
 * The app's language (phase5-contract.md section 7, 28/11/2026). Every suite
 * starts on a device where English has already been chosen and the saved choice
 * has been read — the state every screen was written and checked in — so no
 * suite meets the first-launch chooser, or AppRoot's wait for the saved
 * language, unless it asks to. `__tests__/i18n` is where they do, with
 * `resetLocaleState` and `updateLocaleState`.
 */
require('./src/core/i18n/locale').updateLocaleState({ isChosen: true, isRestored: true });
