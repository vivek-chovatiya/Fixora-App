/**
 * AuthNavigator
 *
 * The pre-authentication stack. Mounted only while nobody is signed in, so no
 * authenticated screen is reachable from here.
 *
 * `Login` is the customer entry point. Vendor sign in and registration are
 * separate screens in a later sub-stage; the remaining placeholders stand until
 * then (PROJECT_BIBLE.md section 84).
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CustomerLoginScreen } from '@/features/auth/screens/CustomerLoginScreen';
import { createPlaceholder } from '@/navigation/placeholders/PlaceholderScreen';
import type { AuthStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const SignupScreen = createPlaceholder('Create Account', 'PROJECT_BIBLE section 9');
const ForgotPasswordScreen = createPlaceholder('Forgot Password', 'PROJECT_BIBLE section 8');

export function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={CustomerLoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
