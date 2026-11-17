/**
 * useCustomerLogout
 *
 * Signs the customer out, after forgetting the request they had not sent
 * (PROJECT_BIBLE.md section 25; owner decisions of 2026-09-22).
 *
 *   confirm → clear the unsent draft → sign out → the root navigator switches
 *
 * ⚠️ The draft goes first, and is awaited. It is the one thing on this device
 * that belongs to this customer and is not scoped to them in storage by key, so
 * it has to be gone before the session is — otherwise the next person to sign
 * in on this phone could be offered it. Should the removal fail, the draft is
 * still stamped with this customer's id and the next customer's provider
 * discards it unread (`RequestDraftStorage`), so a failure here costs nothing
 * but a log line and signing out still goes ahead.
 *
 * ⚠️ Nothing else is deleted. Submitted requests (3D-4) and reviews (3D-6) are
 * kept under this customer's own keys and are there again when they sign back
 * in; they are what a backend would keep, and logging out is not deleting an
 * account.
 *
 * Navigation is not this hook's concern either. `useSignOut` clears the session
 * and the root navigator follows it to the sign-in flow.
 *
 * One logout at a time: a second call while one is running does nothing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useSignOut } from '@/features/auth/hooks/useAuth';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import type { AppError } from '@/shared/types/error';

export interface CustomerLogout {
  /** Resolves when signing out has finished or failed. Never rejects. */
  logOut: () => Promise<void>;
  isLoggingOut: boolean;
  /** Set when the session could not be cleared on this device. */
  error: AppError | null;
}

export function useCustomerLogout(): CustomerLogout {
  const { clearDraft } = useRequestDraft();
  const { mutate: signOut, error } = useSignOut();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const inFlight = useRef(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const logOut = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setIsLoggingOut(true);

    try {
      await clearDraft();
      await signOut();
    } finally {
      inFlight.current = false;
      // Signing out unmounts the customer application; only a failure is still
      // here to be told.
      if (mountedRef.current) {
        setIsLoggingOut(false);
      }
    }
  }, [clearDraft, signOut]);

  return { logOut, isLoggingOut, error };
}
