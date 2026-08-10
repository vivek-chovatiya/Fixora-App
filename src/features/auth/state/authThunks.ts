/**
 * Auth thunks
 *
 * The only writers of session state. Each one goes AuthService → storage →
 * Redux, so the server, the device and memory cannot disagree about who is
 * signed in.
 *
 * Screens must not dispatch `signedIn` / `signedOut` directly — those update
 * memory alone, so the session would resurrect or vanish on the next launch.
 *
 * Requesting a one-time code is absent here on purpose: it establishes no
 * session and belongs to the screen that asked for it, so it stays local state
 * via `useRequestCustomerOtp` (CLAUDE.md section 12).
 */

import { createLogger } from '@/core/logger/Logger';
import { getSessionStorage } from '@/core/storage/SessionStorage';
import {
  sessionAbsent,
  sessionRestored,
  signedIn,
  signedOut,
} from '@/features/auth/state/authSlice';
import type { SessionPayload } from '@/features/auth/types';
import { getService } from '@/shared/services/ServiceRegistry';
import { AppError } from '@/shared/types/error';

const log = createLogger('authThunks');

/**
 * Minimal dispatch contract. Typing against this instead of AppDispatch keeps
 * the auth feature from importing the store, which would be circular.
 */
type Dispatch = (action: unknown) => unknown;

/**
 * Persists then publishes. Storage is written first so that an app killed at
 * this instant restarts signed in, rather than in a state memory believes and
 * the device does not.
 */
async function establishSession(dispatch: Dispatch, session: SessionPayload): Promise<void> {
  await getSessionStorage().write(session);
  dispatch(signedIn(session));
  log.info('Session established', { role: session.user.role });
}

/**
 * Reads any stored session at startup. Always resolves: a failure to read means
 * "not signed in", not an error the user must act on.
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
 * Completes customer sign in with the code they received.
 *
 * Rejects with an AppError on a wrong or expired code, so the calling screen can
 * show the message beside the field.
 */
export async function signInCustomer(
  dispatch: Dispatch,
  phone: string,
  code: string,
): Promise<SessionPayload> {
  const session = await getService('auth').verifyCustomerOtp(phone, code);
  await establishSession(dispatch, session);
  return session;
}

/**
 * Completes vendor sign in with the permanent code issued after approval.
 *
 * The code is passed straight to the service and never retained here, logged, or
 * attached to any error.
 */
export async function signInVendor(
  dispatch: Dispatch,
  phone: string,
  vendorCode: string,
): Promise<SessionPayload> {
  const session = await getService('auth').signInVendor(phone, vendorCode);
  await establishSession(dispatch, session);
  return session;
}

/**
 * Ends the session.
 *
 * A failed server call must not strand the user in a signed-in shell: the local
 * session is cleared regardless. The reverse order would let a network blip
 * silently keep them signed in after they asked to leave.
 */
export async function signOut(dispatch: Dispatch): Promise<void> {
  try {
    await getService('auth').signOut();
  } catch (caught) {
    const appError = AppError.from(caught);
    log.warn('Remote sign out failed; clearing local session anyway', {
      kind: appError.kind,
    });
  }

  await getSessionStorage().clear();
  dispatch(signedOut());
  log.info('Signed out');
}
