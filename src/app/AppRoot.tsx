/**
 * AppRoot
 *
 * Everything that needs to sit *inside* the providers: the session restore, the
 * themed navigation container and the status bar.
 *
 * Kept separate from App so that App is purely the provider stack, and so this
 * can call useTheme and useAppDispatch — which a component rendering the
 * providers cannot do.
 *
 * The navigation tree sits inside `AppErrorBoundary` (PROJECT_BIBLE.md section
 * 57, "Crash Handling"), so a screen that fails to render is replaced by a
 * themed way back rather than closing the app. The status bar sits outside it,
 * so the fallback keeps the bar the theme chose instead of the platform default.
 *
 * The offline banner (sections 49 and 57) sits above the navigators, inside the
 * boundary, and pushes them down while it shows. Two things keep every screen
 * correct under it, and both are measured rather than assumed:
 * - The navigators have a SafeAreaProvider of their own. A screen's
 *   SafeAreaView pads by its provider's overlap with the status bar; under the
 *   app-wide provider it would add a second status-bar gap below the banner,
 *   which has already paid that inset itself.
 * - The banner's height is handed down as the window offset, which `Screen`
 *   gives its KeyboardAvoidingView (shared/components/windowOffset.ts).
 *
 * ⚠️ Nothing is retried when the connection returns. Each screen keeps its own
 * Try again; a reload from here would hit every mounted screen at once.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, View, type LayoutChangeEvent } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppDispatch } from '@/app/hooks';
import { restoreSession } from '@/features/auth/state/authThunks';
import { createNavigationTheme } from '@/navigation/navigationTheme';
import { RootNavigator } from '@/navigation/RootNavigator';
import { AppErrorBoundary, OfflineBanner, WindowOffsetContext } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export function AppRoot() {
  const theme = useTheme();
  const dispatch = useAppDispatch();

  // Runs once. Until it resolves, auth status is `bootstrapping` and the splash
  // screen is shown, so the login screen never flashes before a stored session
  // is found.
  useEffect(() => {
    void restoreSession(dispatch);
  }, [dispatch]);

  // Zero while online: the wrapper below is empty when the banner is hidden.
  const [bannerHeight, setBannerHeight] = useState(0);
  const handleBannerLayout = useCallback((event: LayoutChangeEvent) => {
    setBannerHeight(event.nativeEvent.layout.height);
  }, []);

  return (
    <>
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      <AppErrorBoundary>
        <View onLayout={handleBannerLayout}>
          <OfflineBanner />
        </View>
        <WindowOffsetContext.Provider value={bannerHeight}>
          <SafeAreaProvider>
            <NavigationContainer theme={createNavigationTheme(theme)}>
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </WindowOffsetContext.Provider>
      </AppErrorBoundary>
    </>
  );
}
