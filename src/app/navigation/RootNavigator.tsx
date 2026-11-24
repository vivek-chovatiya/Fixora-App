/**
 * RootNavigator
 *
 * Splash → check auth → role → that role's navigator (App PROJECT_BIBLE §7.1).
 * Customer, vendor and admin navigators never coexist, so no role can reach
 * another role's screens.
 */

import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { Icon, Loader, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

import { AdminNavigator } from './AdminNavigator';
import { AuthNavigator } from './AuthNavigator';
import { CustomerNavigator } from './CustomerNavigator';
import { VendorNavigator } from './VendorNavigator';
import { navigationTheme } from './options';

function Splash() {
  const theme = useTheme();
  return (
    <View testID="splash" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, backgroundColor: theme.colors.background }}>
      <View style={{ width: 72, height: 72, borderRadius: theme.radius.xl, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="fallback" size="xl" color="onPrimary" />
      </View>
      <Text variant="h1">Fixora</Text>
      <Loader />
    </View>
  );
}

export function RootNavigator() {
  const theme = useTheme();
  const { status, role } = useAuth();

  if (status === 'loading') {
    return <Splash />;
  }

  return (
    <NavigationContainer theme={navigationTheme(theme)}>
      {status !== 'signedIn' ? (
        <AuthNavigator />
      ) : role === 'VENDOR' ? (
        <VendorNavigator />
      ) : role === 'ADMIN' ? (
        <AdminNavigator />
      ) : (
        <CustomerNavigator />
      )}
    </NavigationContainer>
  );
}
