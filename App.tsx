/**
 * App
 *
 * The provider stack, and nothing else. Anything needing a hook from these
 * providers lives in AppRoot.
 *
 * Provider order matters:
 * - GestureHandlerRootView must wrap everything that can gesture.
 * - SafeAreaProvider must be above the navigators, which read insets.
 * - ThemeProvider must be above AppRoot, which themes the navigation container.
 * - Redux must be above AppRoot, which dispatches the session restore.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';

import { AppRoot } from '@/app/AppRoot';
import { bootstrapApp } from '@/app/bootstrap';
import { store } from '@/app/store';
import { ThemeProvider } from '@/shared/theme';

// Runs at import, before the first render, so no component can resolve a service
// or issue a request before the registry and HTTP client are wired. Failing here
// is intentional: a misconfigured registry should stop the app immediately
// rather than surface as a confusing error inside a screen.
bootstrapApp();

function App() {
  return (
    <ReduxProvider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <GestureHandlerRootView style={styles.root}>
            <AppRoot />
          </GestureHandlerRootView>
        </ThemeProvider>
      </SafeAreaProvider>
    </ReduxProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
