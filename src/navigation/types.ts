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

/** Pre-authentication flow (PROJECT_BIBLE.md sections 8, 9, 28). */
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
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
