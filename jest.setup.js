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
