/**
 * Navigation route contracts
 *
 * One param list per navigator. Screens read their params through these types,
 * so a renamed route or a changed param fails type-check instead of failing at
 * runtime in front of a user.
 *
 * Customer and Vendor param lists are separate on purpose. They are never
 * combined into one navigator, which is what makes the role separation required
 * by PROJECT_BIBLE.md section 3 structural rather than merely conventional — a
 * customer build has no vendor route to navigate to, even via a deep link.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

import type { OtpChallenge } from '@/shared/services/types/AuthService';

/**
 * Pre-authentication flow (PROJECT_BIBLE.md sections 7A, 9, 28).
 *
 * Routes are named by role. Customer and vendor authentication are different
 * mechanisms — a one-time code versus a permanent auth code — so a shared
 * "Login" route would have had to branch on something the screen should not be
 * deciding.
 *
 * There is no password reset route. Neither role has a password: customers use a
 * one-time code, and vendor recovery is auth code regeneration (section 7A.2).
 *
 * The remaining vendor routes are added with their screens, not ahead of them.
 */
export type AuthStackParamList = {
  CustomerLogin: undefined;
  /**
   * `phone` travels with the challenge because `verifyCustomerOtp(phone, code)`
   * needs it and `OtpChallenge` carries no identifier of its own — unlike vendor
   * onboarding, which is keyed by `registrationId`. It is the user's own number,
   * not a credential; the code itself never appears in navigation params.
   */
  CustomerOtp: { phone: string; challenge: OtpChallenge };

  /**
   * Returning vendors. Separate from CustomerLogin because the mechanisms
   * differ — a one-time code versus a permanent auth code — and a single screen
   * branching on role would have to decide something it should not.
   */
  VendorLogin: undefined;
  VendorRegistration: undefined;
  /**
   * Typed ahead of its screen so registration has a contract to hand off to.
   *
   * `registrationId` is the onboarding identity — never the phone number, so a
   * half-finished registration cannot be resumed by anyone who merely knows the
   * number. The challenge carries only the masked destination and timings; no
   * one-time code and no auth code ever travels in params.
   */
  VendorOtp: { registrationId: string; challenge: OtpChallenge };

  Signup: undefined;
};

/** Customer bottom tabs (PROJECT_BIBLE.md section 26). */
export type CustomerTabParamList = {
  Home: undefined;
  Requests: undefined;
  Profile: undefined;
};

/** Vendor bottom tabs (PROJECT_BIBLE.md section 43). */
export type VendorTabParamList = {
  Dashboard: undefined;
  Requests: undefined;
  Team: undefined;
  Profile: undefined;
};

/**
 * The root is switched by auth state, not navigated between. It is typed here so
 * that `useNavigation` resolves correctly anywhere in the tree.
 */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Customer: NavigatorScreenParams<CustomerTabParamList>;
  Vendor: NavigatorScreenParams<VendorTabParamList>;
};

/**
 * Registers the root routes with React Navigation so `useNavigation()` is typed
 * without a generic at every call site. The local type is named
 * RootStackParamList rather than RootParamList so it does not collide with the
 * global interface being augmented here.
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
