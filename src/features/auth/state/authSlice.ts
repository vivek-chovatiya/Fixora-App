/**
 * authSlice
 *
 * The single source of truth for session state.
 *
 * Auth is promoted to global state (CLAUDE.md section 12) because unrelated
 * modules depend on it: the root navigator chooses an application from it, the
 * HTTP client reads the token from it, and both role applications read the user
 * from it.
 *
 * Reducers here are synchronous and pure. Anything touching storage lives in
 * authThunks so this file stays trivially testable.
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  AuthStatus,
  AuthUser,
  SessionPayload,
  UserRole,
  VendorApprovalStatus,
} from '@/features/auth/types';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
}

const initialState: AuthState = {
  status: 'bootstrapping',
  user: null,
  token: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Startup resolved with a stored session. */
    sessionRestored(state, action: PayloadAction<SessionPayload>) {
      state.status = 'authenticated';
      state.token = action.payload.token;
      state.user = action.payload.user;
    },

    /** Startup resolved with no stored session. */
    sessionAbsent(state) {
      state.status = 'unauthenticated';
      state.token = null;
      state.user = null;
    },

    signedIn(state, action: PayloadAction<SessionPayload>) {
      state.status = 'authenticated';
      state.token = action.payload.token;
      state.user = action.payload.user;
    },

    signedOut(state) {
      state.status = 'unauthenticated';
      state.token = null;
      state.user = null;
    },

    /** Profile edits and refreshed vendor approval status. */
    userUpdated(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
    },
  },
});

export const { sessionRestored, sessionAbsent, signedIn, signedOut, userUpdated } =
  authSlice.actions;

export const authReducer = authSlice.reducer;

/* Selectors -------------------------------------------------------------- */

interface HasAuth {
  auth: AuthState;
}

export const selectAuthStatus = (state: HasAuth): AuthStatus => state.auth.status;

export const selectCurrentUser = (state: HasAuth): AuthUser | null => state.auth.user;

export const selectAuthToken = (state: HasAuth): string | null => state.auth.token;

export const selectIsAuthenticated = (state: HasAuth): boolean =>
  state.auth.status === 'authenticated';

export const selectUserRole = (state: HasAuth): UserRole | null => state.auth.user?.role ?? null;

/** Undefined for customers, who have no approval concept. */
export const selectVendorApproval = (state: HasAuth): VendorApprovalStatus | undefined =>
  state.auth.user?.vendorApproval;
