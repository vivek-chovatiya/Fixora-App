module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  /**
   * Reanimated 4 runs on react-native-worklets, whose native entry points
   * install a JSI module that does not exist under Jest. The library ships this
   * resolver for exactly that: it drops the `.native` extensions so the plain
   * implementations are resolved instead, which is what makes an animated
   * component renderable in a test at all.
   */
  resolver: '<rootDir>/node_modules/react-native-worklets/jest/resolver.js',
  /**
   * node_modules is not transformed by default, but React Native libraries ship
   * untranspiled ESM. Anything imported during startup has to be listed here or
   * Jest fails on `import` before reaching the test.
   */
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?(@react-native|react-native|@react-navigation|react-native-.*|@gorhom/.*|react-redux|@reduxjs/.*|redux|reselect|immer))',
  ],
};
