/**
 * Authentication hooks
 *
 * The seam screens are allowed to touch. They keep the dependency direction
 * intact:
 *
 *   Screen → hook → AuthService interface → implementation
 *
 * A screen calling `getService('auth')` itself, or reaching storage or axios,
 * would break that chain and have to be rewritten when the backend lands.
 *
 * Submitting and error state come from useServiceMutation, matching every other
 * write in the app, so forms get the loading and error handling the Definition
 * of Done requires without inventing anything auth-specific.
 *
 * Only the two hooks that establish a session dispatch anything. The vendor
 * onboarding steps return their results to the calling screen, which is what
 * keeps the generated auth code out of Redux.
 */

import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectAuthStatus,
  selectCurrentUser,
  selectIsAuthenticated,
  selectUserRole,
} from '@/features/auth/state/authSlice';
import {
  confirmVendorAuthCode,
  signInCustomer,
  signInVendor,
  signOut as signOutThunk,
} from '@/features/auth/state/authThunks';
import type { SessionPayload } from '@/features/auth/types';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { getService } from '@/shared/services/ServiceRegistry';
import type {
  OtpChallenge,
  VendorAuthCode,
  VendorRegistration,
  VendorRegistrationDetails,
} from '@/shared/services/types/AuthService';

/** Read-only view of the current session. */
export function useAuthSession() {
  return {
    status: useAppSelector(selectAuthStatus),
    user: useAppSelector(selectCurrentUser),
    role: useAppSelector(selectUserRole),
    isAuthenticated: useAppSelector(selectIsAuthenticated),
  };
}

/* Customer ---------------------------------------------------------------- */

/**
 * Requests a one-time code. Establishes no session, so it dispatches nothing —
 * the challenge belongs to the screen that asked for it.
 */
export function useRequestCustomerOtp() {
  const request = useCallback(
    (phone: string): Promise<OtpChallenge> => getService('auth').requestCustomerOtp(phone),
    [],
  );

  return useServiceMutation<[string], OtpChallenge>(request);
}

/** Verifies the code and signs the customer in. */
export function useCustomerSignIn() {
  const dispatch = useAppDispatch();

  const verify = useCallback(
    (phone: string, code: string): Promise<SessionPayload> => signInCustomer(dispatch, phone, code),
    [dispatch],
  );

  return useServiceMutation<[string, string], SessionPayload>(verify);
}

/* Vendor onboarding ------------------------------------------------------- */

/** Submits vendor details and starts phone verification. Returns no session. */
export function useVendorRegistration() {
  const register = useCallback(
    (details: VendorRegistrationDetails): Promise<VendorRegistration> =>
      getService('auth').registerVendor(details),
    [],
  );

  return useServiceMutation<[VendorRegistrationDetails], VendorRegistration>(register);
}

/** Re-sends the onboarding code. */
export function useRequestVendorOtp() {
  const request = useCallback(
    (registrationId: string): Promise<OtpChallenge> =>
      getService('auth').requestVendorOtp(registrationId),
    [],
  );

  return useServiceMutation<[string], OtpChallenge>(request);
}

/**
 * The auth code is a standing credential, so the hooks that produce one do not
 * retain it. `mutate` resolves with the code and the calling screen becomes its
 * single owner, for exactly as long as it needs it — rather than the screen and
 * the hook each holding a copy.
 */
const CREDENTIAL_RESULT = { retainResult: false } as const;

/**
 * Verifies the onboarding code, which activates the vendor and issues their
 * permanent auth code.
 *
 * ⚠️ The resolved value contains the auth code. Hold it in screen state only,
 * long enough for the vendor to save it. It must not be dispatched, persisted or
 * logged. This hook deliberately does not sign the vendor in — confirming the
 * code does that.
 */
export function useVerifyVendorOtp() {
  const verify = useCallback(
    (registrationId: string, code: string): Promise<VendorAuthCode> =>
      getService('auth').verifyVendorOtp(registrationId, code),
    [],
  );

  return useServiceMutation<[string, string], VendorAuthCode>(verify, CREDENTIAL_RESULT);
}

/**
 * Issues a replacement auth code and revokes the previous one.
 *
 * Same handling rules as `useVerifyVendorOtp`: the resolved value is sensitive.
 */
export function useRegenerateVendorAuthCode() {
  const regenerate = useCallback(
    (registrationId: string): Promise<VendorAuthCode> =>
      getService('auth').regenerateVendorAuthCode(registrationId),
    [],
  );

  return useServiceMutation<[string], VendorAuthCode>(regenerate, CREDENTIAL_RESULT);
}

/**
 * Confirms the vendor saved their auth code, and signs them in.
 *
 * The only onboarding step that creates a session. Copying the code must not
 * call this — the vendor has to enter it.
 */
export function useConfirmVendorAuthCode() {
  const dispatch = useAppDispatch();

  const confirm = useCallback(
    (registrationId: string, authCode: string): Promise<SessionPayload> =>
      confirmVendorAuthCode(dispatch, registrationId, authCode),
    [dispatch],
  );

  return useServiceMutation<[string, string], SessionPayload>(confirm);
}

/* Vendor sign in ---------------------------------------------------------- */

/** Signs a returning vendor in with phone and permanent auth code. */
export function useVendorSignIn() {
  const dispatch = useAppDispatch();

  const submit = useCallback(
    (phone: string, authCode: string): Promise<SessionPayload> =>
      signInVendor(dispatch, phone, authCode),
    [dispatch],
  );

  return useServiceMutation<[string, string], SessionPayload>(submit);
}

/* Common ------------------------------------------------------------------ */

/**
 * Ends the session.
 *
 * Navigation is not this hook's concern. Clearing the session flips
 * RootNavigator back to the auth flow on its own, which is why no screen ever
 * navigates to Login itself.
 */
export function useSignOut() {
  const dispatch = useAppDispatch();

  const submit = useCallback((): Promise<void> => signOutThunk(dispatch), [dispatch]);

  return useServiceMutation<[], void>(submit);
}
