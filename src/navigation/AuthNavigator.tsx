/**
 * AuthNavigator
 *
 * The pre-authentication stack. Mounted only while nobody is signed in, so no
 * authenticated screen is reachable from here.
 *
 * Customer sign in is complete: phone, then one-time code. Nothing navigates
 * onward from verification — a session flips RootNavigator instead, so the stack
 * has no route into the application.
 *
 * Vendor screens and their routes arrive together in a later sub-stage; empty
 * placeholders for them would only be dead code (PROJECT_BIBLE.md section 84).
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CustomerLoginScreen } from '@/features/auth/screens/CustomerLoginScreen';
import { CustomerOtpScreen } from '@/features/auth/screens/CustomerOtpScreen';
import { VendorRegistrationScreen } from '@/features/auth/screens/VendorRegistrationScreen';
import { createPlaceholder } from '@/navigation/placeholders/PlaceholderScreen';
import type { AuthStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const SignupScreen = createPlaceholder('Create Account', 'PROJECT_BIBLE section 9');

export function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="CustomerLogin" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerLogin" component={CustomerLoginScreen} />
      <Stack.Screen name="CustomerOtp" component={CustomerOtpScreen} />
      <Stack.Screen name="VendorRegistration" component={VendorRegistrationScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}
