/**
 * AuthService
 *
 * The only route to authentication. Screens reach it through hooks and thunks,
 * never directly, and never through an HTTP client or a delivery provider.
 *
 * Delivery is deliberately absent from this contract. A code arrives "somehow" —
 * WhatsApp today, SMS or anything else tomorrow — and that is a backend concern.
 * The app must never import a WhatsApp or SMS SDK, and nothing here names one,
 * so changing provider is invisible to the frontend.
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

/**
 * A freshly issued permanent vendor auth code.
 *
 * ⚠️ The `code` is a standing credential. It is returned exactly once, for
 * display. It must never be logged, put in Redux, persisted, attached to
 * analytics, or included in an error. Hold it in screen-local state only, for
 * as long as it takes the vendor to copy it.
 */
export interface VendorAuthCode {
  code: string;
  /** ISO-8601 instant the code was generated. */
  issuedAt: string;
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
   * Returns no session: registering is not signing in.
   */
  registerVendor(details: VendorRegistrationDetails): Promise<VendorRegistration>;

  /** Re-sends the onboarding code. Backs the "resend" affordance. */
  requestVendorOtp(registrationId: string): Promise<OtpChallenge>;

  /**
   * Verifies the onboarding code. Success activates the vendor automatically —
   * there is no administrator approval step — and issues their permanent auth
   * code.
   *
   * Deliberately returns a code, not a session. Verifying the phone proves the
   * number; it does not by itself sign the vendor in. The session is only
   * created once they confirm the auth code they were shown.
   */
  verifyVendorOtp(registrationId: string, code: string): Promise<VendorAuthCode>;

  /**
   * Confirms the vendor has saved their auth code, and signs them in.
   *
   * This is the only vendor onboarding call that produces a session.
   */
  verifyVendorAuthCode(registrationId: string, authCode: string): Promise<SessionPayload>;

  /**
   * Issues a replacement auth code and revokes the previous one immediately.
   *
   * For the vendor who did not manage to save the first code. The old value
   * must stop working the moment this resolves.
   */
  regenerateVendorAuthCode(registrationId: string): Promise<VendorAuthCode>;

  /* Vendor sign in ------------------------------------------------------- */

  /**
   * Signs a returning vendor in with their phone and permanent auth code.
   *
   * No one-time code is involved: onboarding already proved the number, and
   * requiring an OTP on every sign in is not the approved flow.
   *
   * The code is a standing credential. Implementations must never log it,
   * include it in an error, attach it to analytics, or persist it.
   */
  signInVendor(phone: string, authCode: string): Promise<SessionPayload>;

  /* Common --------------------------------------------------------------- */

  /**
   * Invalidates the session server-side.
   *
   * Callers must clear local state even if this rejects — a user who asked to
   * sign out must end up signed out regardless of what the network did.
   */
  signOut(): Promise<void>;
}
