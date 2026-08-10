module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  /**
   * node_modules is not transformed by default, but React Native libraries ship
   * untranspiled ESM. Anything imported during startup has to be listed here or
   * Jest fails on `import` before reaching the test.
   */
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?(@react-native|react-native|@react-navigation|react-native-.*|@gorhom/.*|react-redux|@reduxjs/.*|redux|reselect|immer))',
  ],
};
