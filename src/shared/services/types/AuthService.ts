/**
 * AuthService
 *
 * The only route to authentication. Screens reach it through hooks and thunks,
 * never directly, and never through an HTTP client or a delivery provider.
 *
 * Delivery is deliberately absent from this contract. A customer receives a code
 * "somehow" — WhatsApp today, SMS or anything else tomorrow — and that is a
 * backend concern. The app must never import a WhatsApp or SMS SDK, and nothing
 * here names one, so switching provider is invisible to the frontend.
 *
 * Session restoration is also absent. The app already restores sessions from
 * SessionStorage via the auth thunks, so adding a restore method here would
 * create a second, competing source of truth. This interface covers only
 * operations that are genuinely remote.
 *
 * The backend is the authority on every question this interface asks: whether an
 * account exists, whether a code is valid, whether a vendor is approved. The
 * mock simulates those answers so the UI can be built; it never becomes the
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
   * (for example "+91 ••••• •3210"). Masking is not done in the app, so the
   * full number is never required just to render a confirmation line.
   */
  maskedDestination: string;
  /** ISO-8601 instant after which the code is rejected. */
  expiresAt: string;
  /** Seconds the user must wait before another code may be requested. */
  resendAfterSeconds: number;
}

export interface AuthService {
  /**
   * Starts customer sign in by requesting a one-time code for a phone number.
   *
   * Succeeds regardless of whether the number is registered. Revealing that
   * would let anyone enumerate customers, and the frontend is not permitted to
   * decide the question anyway.
   */
  requestCustomerOtp(phone: string): Promise<OtpChallenge>;

  /** Completes customer sign in. Rejects with an AppError if the code is wrong or expired. */
  verifyCustomerOtp(phone: string, code: string): Promise<SessionPayload>;

  /**
   * Signs a vendor in with their phone and the permanent code issued by an
   * administrator after approval.
   *
   * The code is a standing credential. Implementations must never log it,
   * include it in an error, attach it to analytics, or persist it beyond the
   * request.
   */
  signInVendor(phone: string, vendorCode: string): Promise<SessionPayload>;

  /**
   * Invalidates the session server-side.
   *
   * Callers must clear local state even if this rejects — a user who asked to
   * sign out must end up signed out regardless of what the network did.
   */
  signOut(): Promise<void>;
}
