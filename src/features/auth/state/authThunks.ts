/**
 * Auth thunks
 *
 * Every state change that also touches persistent storage goes through here, so
 * the store and the device can never disagree about who is signed in.
 *
 * Screens must not call `signedIn` / `signedOut` directly — those would update
 * memory only, and the session would resurrect or vanish on the next launch.
 */

import { getSessionStorage } from '@/core/storage/SessionStorage';
import { createLogger } from '@/core/logger/Logger';
import {
  sessionAbsent,
  sessionRestored,
  signedIn,
  signedOut,
  type SessionPayload,
} from '@/features/auth/state/authSlice';

const log = createLogger('authThunks');

/**
 * Minimal dispatch contract. Typing against this rather than AppDispatch keeps
 * the auth feature from importing the store, which would be a circular import.
 */
type Dispatch = (action: unknown) => unknown;

/**
 * Reads any stored session at startup. Always resolves — a failure to read is
 * treated as "not signed in" rather than an error the user must act on.
 */
export async function restoreSession(dispatch: Dispatch): Promise<void> {
  const session = await getSessionStorage().read();

  if (session) {
    log.info('Session restored', { role: session.user.role });
    dispatch(sessionRestored(session));
    return;
  }

  log.info('No stored session');
  dispatch(sessionAbsent());
}

/**
 * Completes a sign in. Called by the login screen once the backend has returned
 * a token and user (Stage 2).
 *
 * The session is written before the state update so that an app killed at this
 * instant restarts signed in rather than in a state the store believes but the
 * device does not.
 */
export async function signIn(dispatch: Dispatch, session: SessionPayload): Promise<void> {
  await getSessionStorage().write(session);
  dispatch(signedIn(session));
  log.info('Signed in', { role: session.user.role });
}

/**
 * Ends the session. Storage is cleared first: if clearing failed after the state
 * reset, the next launch would silently restore the session the user just ended.
 */
export async function signOut(dispatch: Dispatch): Promise<void> {
  await getSessionStorage().clear();
  dispatch(signedOut());
  log.info('Signed out');
}
