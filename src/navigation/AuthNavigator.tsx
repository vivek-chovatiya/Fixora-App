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
 * Vendor authentication is complete alongside it, in the same shape: phone,
 * then one-time code, for returning vendors; registration, then one-time code,
 * for new ones (phase5-contract.md section 1, 28/11/2026). Either code signs
 * the vendor in, and nothing navigates onward from it either. There is no auth
 * code route — that credential was retired.
 *
 * The introduction is gated here rather than in RootNavigator, because this
 * stack is mounted exactly when it is relevant: nobody is signed in. A user with
 * a session never mounts this navigator, so they can never be shown it.
 *
 * Before both, once: "Choose your language" (phase5-contract.md section 7,
 * 28/11/2026), while no language has been chosen on this device. It is drawn
 * in place of the stack rather than as a route in it, so nothing can navigate
 * back to it, Android Back on it leaves the app as on any first screen, and the
 * stack still opens on the first route the onboarding gate picks. Choosing
 * flips the locale store's `isChosen`, and this navigator follows; a language
 * other than the current one also re-mounts the tree (AppRoot), so the stack
 * opens already in it.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthEntryScreen } from '@/features/auth/screens/AuthEntryScreen';
import { CustomerLoginScreen } from '@/features/auth/screens/CustomerLoginScreen';
import { CustomerOtpScreen } from '@/features/auth/screens/CustomerOtpScreen';
import { VendorLoginScreen } from '@/features/auth/screens/VendorLoginScreen';
import { VendorOtpScreen } from '@/features/auth/screens/VendorOtpScreen';
import { VendorRegistrationScreen } from '@/features/auth/screens/VendorRegistrationScreen';
import { VendorSignInOtpScreen } from '@/features/auth/screens/VendorSignInOtpScreen';
import { SplashScreen } from '@/features/auth/screens/SplashScreen';
import { useLocaleState } from '@/features/language/hooks/useLanguage';
import { LanguageScreen } from '@/features/language/screens/LanguageScreen';
import { useOnboardingGate } from '@/features/onboarding/hooks/useOnboardingGate';
import { OnboardingScreen } from '@/features/onboarding/screens/OnboardingScreen';
import type { AuthStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const gate = useOnboardingGate();
  const { isChosen } = useLocaleState();

  // First launch: the language comes before the introduction and sign in.
  if (!isChosen) {
    return <LanguageScreen mode="first" />;
  }

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
      <Stack.Screen name="VendorSignInOtp" component={VendorSignInOtpScreen} />
      <Stack.Screen name="VendorRegistration" component={VendorRegistrationScreen} />
      <Stack.Screen name="VendorOtp" component={VendorOtpScreen} />
    </Stack.Navigator>
  );
}
