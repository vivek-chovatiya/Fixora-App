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
import { duration } from '@/shared/theme';
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
 *
 * `publishAfterMs` schedules the dispatch instead of awaiting it, and returns.
 *
 * Publishing swaps the navigation tree synchronously, so it unmounts the screen
 * that just verified something. Merely pausing before the dispatch would not
 * help: the caller only learns it succeeded when this resolves, so the screen
 * would still be told and unmounted on the same frame. Resolving first is what
 * gives it a moment in which it knows it succeeded and is still mounted.
 *
 * The gap therefore sits between the write and the dispatch, never earlier. The
 * session is durable for its whole duration: an app killed inside it restarts
 * signed in, exactly as one killed a millisecond before it would. What waits is
 * only when the rest of the application is told, and nothing can refuse a
 * session that is already on disk.
 */
async function establishSession(
  dispatch: Dispatch,
  session: SessionPayload,
  publishAfterMs = 0,
): Promise<void> {
  await getSessionStorage().write(session);

  const publish = () => {
    dispatch(signedIn(session));
    log.info('Session established', { role: session.user.role });
  };

  if (publishAfterMs > 0) {
    // Deliberately not awaited. It fires whether or not the screen that started
    // it is still there — the session exists either way, and a user who leaves
    // mid-animation should still arrive signed in.
    setTimeout(publish, publishAfterMs);
    return;
  }

  publish();
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

  // The code was checked on a screen showing the verification animation, so the
  // publish waits for its verified state to have been seen.
  await establishSession(dispatch, session, duration.verifiedHold);
  return session;
}

/**
 * Signs a returning vendor in with their phone and permanent auth code.
 *
 * The code is passed straight to the service and never retained here, logged, or
 * attached to any error.
 */
export async function signInVendor(
  dispatch: Dispatch,
  phone: string,
  authCode: string,
): Promise<SessionPayload> {
  const session = await getService('auth').signInVendor(phone, authCode);

  // No pause: this is a plain form with no verified state to hold on, and a
  // delay with nothing on screen is just a slower sign in.
  await establishSession(dispatch, session);
  return session;
}

/**
 * Final step of vendor onboarding: the vendor confirms the auth code they were
 * shown, and only then is a session created.
 *
 * The earlier onboarding calls — register, request code, verify code, regenerate
 * — deliberately have no thunk. None of them establishes a session, so they stay
 * screen-local through their hooks. In particular the generated auth code must
 * never reach Redux, so nothing that returns it is dispatched.
 */
export async function confirmVendorAuthCode(
  dispatch: Dispatch,
  registrationId: string,
  authCode: string,
): Promise<SessionPayload> {
  const session = await getService('auth').verifyVendorAuthCode(registrationId, authCode);

  // Confirmation runs the same animation as the one-time code, and earns the
  // same pause before the vendor application replaces it.
  await establishSession(dispatch, session, duration.verifiedHold);
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
