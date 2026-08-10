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
