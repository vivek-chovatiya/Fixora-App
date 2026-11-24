/**
 * AuthProvider
 *
 * The single owner of authentication state: token, current user and role
 * (App PROJECT_BIBLE §50). Screens never handle tokens themselves.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { setTokenProvider, setUnauthorizedHandler } from '@/core/http/HttpClient';
import { createLogger } from '@/core/logger/Logger';
import { SessionStorage } from '@/core/storage/SessionStorage';
import { authApi, type CustomerSignupPayload, type VendorSignupPayload } from '@/shared/services/api';
import { Analytics } from '@/shared/services/analytics';
import { AppError } from '@/shared/types/error';
import type { Session, UserProfile, UserRole } from '@/shared/types/models';

const log = createLogger('Auth');

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  role: UserRole | null;
  user: UserProfile | null;
  signIn: (identifier: string, password: string, role: UserRole) => Promise<void>;
  signUpCustomer: (payload: CustomerSignupPayload) => Promise<void>;
  signUpVendor: (payload: VendorSignupPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const tokenRef = useRef<string | null>(null);

  const clear = useCallback(async () => {
    tokenRef.current = null;
    setUser(null);
    setRole(null);
    setStatus('signedOut');
    await SessionStorage.clear();
  }, []);

  const applySession = useCallback(async (session: Session) => {
    tokenRef.current = session.token;
    await SessionStorage.save({ token: session.token, role: session.role });
    setRole(session.role);
    setUser(session.user);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    setTokenProvider(() => tokenRef.current);
    setUnauthorizedHandler(() => {
      if (tokenRef.current) {
        log.info('session rejected by server; signing out');
        void clear();
      }
    });
  }, [clear]);

  // Splash: restore a stored session and confirm it with the backend.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      Analytics.track('app_opened');
      const stored = await SessionStorage.load();
      if (!stored) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      tokenRef.current = stored.token;
      try {
        const profile = await authApi.me();
        if (cancelled) return;
        setRole(stored.role);
        setUser(profile);
        setStatus('signedIn');
      } catch (caught) {
        const error = AppError.from(caught);
        if (cancelled) return;
        if (error.kind === 'unauthorized' || error.kind === 'notFound') {
          await clear();
        } else {
          // Offline at launch: keep the session; screens show their own network states.
          log.warn('could not verify session at launch', { kind: error.kind });
          setRole(stored.role);
          setStatus('signedIn');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clear]);

  const signIn = useCallback(
    async (identifier: string, password: string, nextRole: UserRole) => {
      const session = await authApi.login(identifier.trim(), password, nextRole);
      await applySession(session);
      Analytics.track('login_completed', { role: nextRole });
    },
    [applySession],
  );

  const signUpCustomer = useCallback(
    async (payload: CustomerSignupPayload) => {
      const session = await authApi.registerCustomer(payload);
      await applySession(session);
      Analytics.track('signup_completed');
    },
    [applySession],
  );

  const signUpVendor = useCallback(
    async (payload: VendorSignupPayload) => {
      const session = await authApi.registerVendor(payload);
      await applySession(session);
      Analytics.track('vendor_signup');
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      log.warn('logout call failed; clearing local session anyway', { error });
    }
    await clear();
  }, [clear]);

  const refreshUser = useCallback(async () => {
    const profile = await authApi.me();
    setUser(profile);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, role, user, signIn, signUpCustomer, signUpVendor, signOut, refreshUser, setUser }),
    [status, role, user, signIn, signUpCustomer, signUpVendor, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
