/**
 * AuthNavigator
 *
 * The pre-authentication stack. Mounted only while nobody is signed in, so no
 * authenticated screen is reachable from here.
 *
 * It opens on role selection, which is what makes both applications reachable.
 * The selection routes and nothing more: the authenticated role comes from the
 * session, never from what was tapped here.
 *
 * Customer sign in is complete: phone, then one-time code. Nothing navigates
 * onward from verification — a session flips RootNavigator instead, so the stack
 * has no route into the application.
 *
 * Vendor authentication is complete alongside it: sign in for returning
 * vendors, and registration through to auth code confirmation for new ones.
 * Auth code display and confirmation are states inside VendorOtp rather than
 * routes, so the credential never travels between screens.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthEntryScreen } from '@/features/auth/screens/AuthEntryScreen';
import { CustomerLoginScreen } from '@/features/auth/screens/CustomerLoginScreen';
import { CustomerOtpScreen } from '@/features/auth/screens/CustomerOtpScreen';
import { VendorLoginScreen } from '@/features/auth/screens/VendorLoginScreen';
import { VendorOtpScreen } from '@/features/auth/screens/VendorOtpScreen';
import { VendorRegistrationScreen } from '@/features/auth/screens/VendorRegistrationScreen';
import { createPlaceholder } from '@/navigation/placeholders/PlaceholderScreen';
import type { AuthStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const SignupScreen = createPlaceholder('Create Account', 'PROJECT_BIBLE section 9');

export function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="AuthEntry" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AuthEntry" component={AuthEntryScreen} />
      <Stack.Screen name="CustomerLogin" component={CustomerLoginScreen} />
      <Stack.Screen name="CustomerOtp" component={CustomerOtpScreen} />
      <Stack.Screen name="VendorLogin" component={VendorLoginScreen} />
      <Stack.Screen name="VendorRegistration" component={VendorRegistrationScreen} />
      <Stack.Screen name="VendorOtp" component={VendorOtpScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}
