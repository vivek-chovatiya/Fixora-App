/**
 * RootNavigator
 *
 * Chooses which application the user sees, from auth state alone.
 *
 * This is a switch, not a stack. Customer and Vendor navigators are never
 * mounted at the same time and there is no route connecting them, so the role
 * separation required by PROJECT_BIBLE.md section 3 cannot be defeated by a deep
 * link or a stray `navigate` call — the target simply does not exist in the tree.
 *
 * It also means no screen performs imperative navigation on sign in, sign out or
 * session expiry. Those change state; the tree follows.
 */

import React from 'react';

import { useAppSelector } from '@/app/hooks';
import { selectAuthStatus, selectCurrentUser } from '@/features/auth/state/authSlice';
import { SplashScreen } from '@/features/auth/screens/SplashScreen';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import { CustomerNavigator } from '@/navigation/CustomerNavigator';
import { VendorNavigator } from '@/navigation/VendorNavigator';

export function RootNavigator() {
  const status = useAppSelector(selectAuthStatus);
  const user = useAppSelector(selectCurrentUser);

  if (status === 'bootstrapping') {
    return <SplashScreen />;
  }

  if (status === 'unauthenticated' || !user) {
    return <AuthNavigator />;
  }

  // No approval gate: vendor onboarding activates the vendor on phone
  // verification, and a session only exists once they have confirmed their auth
  // code, so any vendor holding a session is active (PROJECT_BIBLE.md 7A).
  return user.role === 'vendor' ? <VendorNavigator /> : <CustomerNavigator />;
}
