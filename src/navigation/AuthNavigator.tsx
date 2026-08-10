/**
 * AuthNavigator
 *
 * The pre-authentication stack. Mounted only while nobody is signed in, so no
 * authenticated screen is reachable from here.
 *
 * Screens are placeholders until Stage 2 (PROJECT_BIBLE.md section 84).
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { createPlaceholder } from '@/navigation/placeholders/PlaceholderScreen';
import type { AuthStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const LoginScreen = createPlaceholder('Login', 'PROJECT_BIBLE section 8');
const SignupScreen = createPlaceholder('Create Account', 'PROJECT_BIBLE section 9');
const ForgotPasswordScreen = createPlaceholder('Forgot Password', 'PROJECT_BIBLE section 8');

export function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
