/**
 * AuthService
 *
 * The only route to authentication. Screens reach it through hooks and thunks,
 * never directly, and never through an HTTP client or a delivery provider.
 *
 * Delivery is the backend's. A code arrives over whatever channel the backend
 * chose — WhatsApp today, SMS or anything else tomorrow — and the app never
 * imports a WhatsApp or SMS SDK (PROJECT_BIBLE.md section 7A.1). What the app
 * does learn is which channel was used, as a value on the challenge
 * (`deliveryChannel`, phase5-contract.md section 2), so the code screen can say
 * where to look. Words only: nothing branches on it but copy, so changing
 * provider is still invisible to every flow.
 *
 * Both roles prove the phone with a one-time code on every sign in (owner
 * decision 28/11/2026, phase5-contract.md section 1 — supersedes the permanent
 * vendor auth code of PROJECT_BIBLE.md section 7A.2). There is no standing
 * vendor credential any more, so nothing here issues, shows, confirms or
 * regenerates one.
 *
 * Session restoration is also absent. SessionStorage and the `restoreSession`
 * thunk already own it, so a restore method here would create a second,
 * competing source of truth. This interface covers only genuinely remote work.
 *
 * The backend is the authority on every question asked here: whether an account
 * exists, whether a code is valid, whether a vendor is active. The mock
 * simulates those answers so the UI can be built; simulation never becomes the
 * rule.
 */

import type { SessionPayload } from '@/features/auth/types';

/**
 * How the backend says it sent a one-time code (phase5-contract.md section 2).
 *
 * `NONE` is what a backend with no provider configured answers — development,
 * where the code is a fixed one. Any value the app does not know is read as
 * `NONE` at the service boundary, so a channel the backend adds later words the
 * screen as it was worded before rather than breaking it.
 */
export type OtpDeliveryChannel = 'WHATSAPP' | 'NONE';

/**
 * The result of asking for a one-time code. Carries only what the UI needs to
 * render the verification step — never the code itself.
 */
export interface OtpChallenge {
  /**
   * Destination to show the user, already masked by the backend
   * (for example "••••••3210"). Masking is not done in the app, so the full
   * number is never needed just to render a confirmation line.
   */
  maskedDestination: string;
  /** ISO-8601 instant after which the code is rejected. */
  expiresAt: string;
  /** Seconds the user must wait before another code may be requested. */
  resendAfterSeconds: number;
  /** Which channel carried the code. Chooses the words on the code screen, nothing else. */
  deliveryChannel: OtpDeliveryChannel;
}

/**
 * What a vendor supplies to register.
 *
 * Kept to what the flow genuinely needs. Documents and shop images from
 * PROJECT_BIBLE.md section 28 are upload flows that belong with the profile
 * work, not with authentication, so they are not speculated here.
 */
export interface VendorRegistrationDetails {
  businessName: string;
  ownerFirstName: string;
  ownerLastName: string;
  phone: string;
  email?: string;
  /**
   * Backend-owned category identifiers. Never a hardcoded category name — the
   * app must support a new service without a release.
   */
  serviceCategoryIds: string[];
}

/**
 * Handle for an in-progress vendor onboarding.
 *
 * Every subsequent step is keyed by `registrationId` rather than by phone, so a
 * half-finished registration cannot be resumed by anyone who merely knows the
 * number.
 */
export interface VendorRegistration {
  registrationId: string;
  challenge: OtpChallenge;
}

export interface AuthService {
  /* Customer ------------------------------------------------------------- */

  /**
   * Starts customer sign in by requesting a one-time code.
   *
   * Succeeds regardless of whether the number is registered — revealing that
   * would let anyone enumerate customers, and the frontend is not permitted to
   * decide it anyway.
   */
  requestCustomerOtp(phone: string): Promise<OtpChallenge>;

  /** Completes customer sign in. Rejects if the code is wrong or expired. */
  verifyCustomerOtp(phone: string, code: string): Promise<SessionPayload>;

  /* Vendor onboarding ---------------------------------------------------- */

  /**
   * Submits vendor details and starts phone verification.
   *
   * Returns no session: registering is not signing in. Verifying the code is.
   */
  registerVendor(details: VendorRegistrationDetails): Promise<VendorRegistration>;

  /** Re-sends the onboarding code. Backs the "resend" affordance. */
  requestVendorOtp(registrationId: string): Promise<OtpChallenge>;

  /**
   * Verifies the onboarding code, which creates the vendor — active at once,
   * with no administrator approval step — and signs them in
   * (phase5-contract.md section 1.2).
   *
   * Nothing else is issued: there is no auth code to show or confirm.
   */
  verifyVendorOtp(registrationId: string, code: string): Promise<SessionPayload>;

  /* Vendor sign in ------------------------------------------------------- */

  /**
   * Starts a returning vendor's sign in by requesting a one-time code
   * (phase5-contract.md section 1.1).
   *
   * Answers the same for every well-formed number — known, unknown or
   * suspended — so it never reveals whether a number has a vendor account. A
   * code is only actually sent to an existing vendor; the app cannot tell, and
   * must not try.
   */
  requestVendorSignInOtp(phone: string): Promise<OtpChallenge>;

  /**
   * Completes a returning vendor's sign in.
   *
   * A wrong code and a number with no vendor account are refused alike, as a
   * wrong code — no code was ever sent to the second, and telling them apart
   * would tell anyone which numbers have accounts. A suspended vendor is
   * refused only after a correct code.
   */
  verifyVendorSignInOtp(phone: string, code: string): Promise<SessionPayload>;

  /* Common --------------------------------------------------------------- */

  /**
   * Invalidates the session server-side.
   *
   * Callers must clear local state even if this rejects — a user who asked to
   * sign out must end up signed out regardless of what the network did.
   */
  signOut(): Promise<void>;
}
