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
 * one-time code, and a vendor uses the auth code they saved.
 *
 * There is no customer signup route either. A customer account is created by the
 * backend on first successful phone verification, so signing up and signing in
 * are the same three taps — a separate screen would collect details nobody has
 * yet asked for and add a step to the shortest path in the product.
 *
 * There is no vendor recovery route either, and its absence is deliberate.
 * `regenerateVendorAuthCode` is keyed by `registrationId`, which a returning
 * vendor does not have — so the current contract cannot express "I lost my
 * code" safely. Inventing a phone-only regeneration would turn a lost phone into
 * account takeover. It needs a backend operation before it can need a route.
 *
 * The remaining vendor routes are added with their screens, not ahead of them.
 */
export type AuthStackParamList = {
  /**
   * The introduction, shown once on a first launch.
   *
   * It lives in this stack rather than above it because it belongs to the same
   * unauthenticated phase: it is what an unknown user sees before choosing a
   * role, and it is unreachable to anyone with a session. Whether it is the
   * stack's entry point is decided at mount from local storage, not navigated
   * to — so nothing can return to it once it has been finished.
   */
  Onboarding: undefined;

  /**
   * Role selection, and the stack's entry point once the introduction is done. The choice made here is a
   * navigation decision only — the authenticated role comes from the session,
   * so nothing selected here is carried as a param or trusted afterwards.
   */
  AuthEntry: undefined;

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
