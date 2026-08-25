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
 * Customer sign in is complete: phone, then one-time code. There is no separate
 * signup — the account is created on first successful verification, so the two
 * are the same flow. Nothing navigates onward from verification either: a
 * session flips RootNavigator instead, so the stack has no route into the
 * application.
 *
 * Vendor authentication is complete alongside it: sign in for returning
 * vendors, and registration through to auth code confirmation for new ones.
 * Auth code display and confirmation are states inside VendorOtp rather than
 * routes, so the credential never travels between screens.
 *
 * The introduction is gated here rather than in RootNavigator, because this
 * stack is mounted exactly when it is relevant: nobody is signed in. A user with
 * a session never mounts this navigator, so they can never be shown it.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthEntryScreen } from '@/features/auth/screens/AuthEntryScreen';
import { CustomerLoginScreen } from '@/features/auth/screens/CustomerLoginScreen';
import { CustomerOtpScreen } from '@/features/auth/screens/CustomerOtpScreen';
import { VendorLoginScreen } from '@/features/auth/screens/VendorLoginScreen';
import { VendorOtpScreen } from '@/features/auth/screens/VendorOtpScreen';
import { VendorRegistrationScreen } from '@/features/auth/screens/VendorRegistrationScreen';
import { SplashScreen } from '@/features/auth/screens/SplashScreen';
import { useOnboardingGate } from '@/features/onboarding/hooks/useOnboardingGate';
import { OnboardingScreen } from '@/features/onboarding/screens/OnboardingScreen';
import type { AuthStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const gate = useOnboardingGate();

  /**
   * The same splash the session read shows, so the two checks read as one wait
   * rather than as a screen that appears and is immediately replaced.
   *
   * The navigator is not mounted until the answer is known, because
   * `initialRouteName` is only honoured on first mount — deciding it later would
   * mean navigating away from a screen the user should never have seen.
   */
  if (gate === 'checking') {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator
      initialRouteName={gate === 'required' ? 'Onboarding' : 'AuthEntry'}
      screenOptions={{ headerShown: false }}>
      {/*
        Registered whatever the gate said, so the route always exists and the
        two branches differ only in where the stack opens.
      */}
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        // Finishing replaces this route, but a hardware back press before that
        // must not return to it either — there is nothing behind it.
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="AuthEntry" component={AuthEntryScreen} />
      <Stack.Screen name="CustomerLogin" component={CustomerLoginScreen} />
      <Stack.Screen name="CustomerOtp" component={CustomerOtpScreen} />
      <Stack.Screen name="VendorLogin" component={VendorLoginScreen} />
      <Stack.Screen name="VendorRegistration" component={VendorRegistrationScreen} />
      <Stack.Screen name="VendorOtp" component={VendorOtpScreen} />
    </Stack.Navigator>
  );
}
