import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from '@/app/navigation/RootNavigator';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { FeedbackProvider } from '@/shared/components';
import { ThemeProvider, useThemePreference } from '@/shared/theme';

function ThemedStatusBar() {
  const { mode } = useThemePreference();
  return <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />;
}

export function AppRoot() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initialPreference="light">
          <ThemedStatusBar />
          <FeedbackProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </FeedbackProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
