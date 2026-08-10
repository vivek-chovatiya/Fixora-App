/**
 * AppRoot
 *
 * Everything that needs to sit *inside* the providers: the session restore, the
 * themed navigation container and the status bar.
 *
 * Kept separate from App so that App is purely the provider stack, and so this
 * can call useTheme and useAppDispatch — which a component rendering the
 * providers cannot do.
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { useAppDispatch } from '@/app/hooks';
import { restoreSession } from '@/features/auth/state/authThunks';
import { createNavigationTheme } from '@/navigation/navigationTheme';
import { RootNavigator } from '@/navigation/RootNavigator';
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

  return (
    <NavigationContainer theme={createNavigationTheme(theme)}>
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      <RootNavigator />
    </NavigationContainer>
  );
}
