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
 * Only the hooks that establish a session dispatch anything — customer sign in,
 * vendor sign in, and the code that ends vendor registration. Asking for a code
 * and registering return their results to the calling screen.
 */

import { useCallback, useEffect, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { createLogger } from '@/core/logger/Logger';
import {
  selectAuthStatus,
  selectCurrentUser,
  selectIsAuthenticated,
  selectUserRole,
} from '@/features/auth/state/authSlice';
import {
  completeVendorRegistration,
  signInCustomer,
  signInVendor,
  signOut as signOutThunk,
} from '@/features/auth/state/authThunks';
import { getRememberedVendorStorage } from '@/features/auth/state/rememberedVendorStorage';
import type { SessionPayload } from '@/features/auth/types';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { getService } from '@/shared/services/ServiceRegistry';
import type {
  OtpChallenge,
  VendorRegistration,
  VendorRegistrationDetails,
} from '@/shared/services/types/AuthService';
import { AppError } from '@/shared/types/error';

const log = createLogger('useAuth');

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
 * Verifies the onboarding code, which creates the vendor and signs them in
 * (phase5-contract.md section 1.2).
 *
 * `phone` is the number typed at registration, remembered for the next sign in
 * once the session exists; the service is called with the registration id and
 * the code only.
 */
export function useCompleteVendorRegistration() {
  const dispatch = useAppDispatch();

  const verify = useCallback(
    (registrationId: string, phone: string, code: string): Promise<SessionPayload> =>
      completeVendorRegistration(dispatch, registrationId, phone, code),
    [dispatch],
  );

  return useServiceMutation<[string, string, string], SessionPayload>(verify);
}

/* Vendor sign in ---------------------------------------------------------- */

/**
 * Asks for a returning vendor's one-time code. Establishes no session, so it
 * dispatches nothing — the challenge belongs to the screen that asked for it.
 */
export function useRequestVendorSignInOtp() {
  const request = useCallback(
    (phone: string): Promise<OtpChallenge> => getService('auth').requestVendorSignInOtp(phone),
    [],
  );

  return useServiceMutation<[string], OtpChallenge>(request);
}

/** Verifies the code and signs the returning vendor in. */
export function useVendorSignIn() {
  const dispatch = useAppDispatch();

  const submit = useCallback(
    (phone: string, code: string): Promise<SessionPayload> => signInVendor(dispatch, phone, code),
    [dispatch],
  );

  return useServiceMutation<[string, string], SessionPayload>(submit);
}

export interface RememberedVendorPhone {
  /** Digits only, or null when none is remembered, it could not be read, or it was forgotten. */
  phone: string | null;
  /** True until the device has answered, once, on mount. */
  isReading: boolean;
  /** Forgets the number here and on the device, so the phone field comes back. */
  forget: () => void;
}

/**
 * The phone number the last vendor signed in with on this device, if any.
 *
 * Read once, on mount. Remembering is the sign-in thunks' job, after a session
 * exists; this only reads and forgets.
 *
 * ⚠️ Never in the way of signing in. A read that fails — even one that throws
 * despite the storage module promising not to — settles as "nothing
 * remembered", which is the phone form every vendor already knows.
 */
export function useRememberedVendorPhone(): RememberedVendorPhone {
  const [state, setState] = useState<{ phone: string | null; isReading: boolean }>({
    phone: null,
    isReading: true,
  });

  useEffect(() => {
    // An answer that arrives after the screen has gone has nowhere to land.
    let isCurrent = true;

    const settle = (phone: string | null) => {
      if (isCurrent) {
        setState({ phone, isReading: false });
      }
    };

    getRememberedVendorStorage()
      .read()
      .then(settle, (caught: unknown) => {
        log.warn('Remembered vendor could not be read', { kind: AppError.from(caught).kind });
        settle(null);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const forget = useCallback(() => {
    // The screen changes now; the device catches up. A forget that fails only
    // means the number may be offered again next time — the module logs it.
    setState({ phone: null, isReading: false });
    getRememberedVendorStorage()
      .forget()
      .catch((caught: unknown) => {
        log.warn('Remembered vendor could not be forgotten', {
          kind: AppError.from(caught).kind,
        });
      });
  }, []);

  return { phone: state.phone, isReading: state.isReading, forget };
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
