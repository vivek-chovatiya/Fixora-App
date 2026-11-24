import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { CustomerSignupScreen } from '@/features/auth/screens/CustomerSignupScreen';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { VendorSignupScreen } from '@/features/auth/screens/VendorSignupScreen';
import { useTheme } from '@/shared/theme';

import { stackOptions } from './options';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={stackOptions(theme)}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CustomerSignup" component={CustomerSignupScreen} options={{ title: 'Sign up' }} />
      <Stack.Screen name="VendorSignup" component={VendorSignupScreen} options={{ title: 'Vendor registration' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot password' }} />
    </Stack.Navigator>
  );
}
