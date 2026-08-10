/**
 * Authentication hooks
 *
 * The seam screens are allowed to touch. They keep the dependency direction
 * intact:
 *
 *   Screen → hook → AuthService interface → implementation
 *
 * A screen that called `getService('auth')` itself, or reached storage or axios,
 * would break that chain and have to be rewritten when the backend lands.
 *
 * Submitting and error state come from useServiceMutation, matching how every
 * other write in the app behaves, so forms get the loading and error handling
 * the Definition of Done requires without inventing anything auth-specific.
 */

import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectAuthStatus,
  selectCurrentUser,
  selectIsAuthenticated,
  selectUserRole,
  selectVendorApproval,
} from '@/features/auth/state/authSlice';
import {
  signInCustomer,
  signInVendor,
  signOut as signOutThunk,
} from '@/features/auth/state/authThunks';
import type { SessionPayload } from '@/features/auth/types';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { getService } from '@/shared/services/ServiceRegistry';
import type { OtpChallenge } from '@/shared/services/types/AuthService';

/** Read-only view of the current session. */
export function useAuthSession() {
  return {
    status: useAppSelector(selectAuthStatus),
    user: useAppSelector(selectCurrentUser),
    role: useAppSelector(selectUserRole),
    isAuthenticated: useAppSelector(selectIsAuthenticated),
    vendorApproval: useAppSelector(selectVendorApproval),
  };
}

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
    (phone: string, code: string): Promise<SessionPayload> =>
      signInCustomer(dispatch, phone, code),
    [dispatch],
  );

  return useServiceMutation<[string, string], SessionPayload>(verify);
}

/** Signs a vendor in with the permanent code issued after approval. */
export function useVendorSignIn() {
  const dispatch = useAppDispatch();

  const submit = useCallback(
    (phone: string, vendorCode: string): Promise<SessionPayload> =>
      signInVendor(dispatch, phone, vendorCode),
    [dispatch],
  );

  return useServiceMutation<[string, string], SessionPayload>(submit);
}

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
