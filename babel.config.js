module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // zod v4 ships `export * as core from ...`, which the React Native preset
    // does not transform on its own. Without this, Metro fails to bundle the
    // moment anything imports zod — while Jest passes, because it resolves zod
    // to its CommonJS build instead.
    '@babel/plugin-transform-export-namespace-from',
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
    // react-native-worklets powers Reanimated 4. This plugin must stay last.
    'react-native-worklets/plugin',
  ],
};
