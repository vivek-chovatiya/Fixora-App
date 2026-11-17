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
 *
 * Being the only writers also makes them the one place that tells analytics and
 * crash reporting who is signed in, and the place the sign in and sign up events
 * of PROJECT_BIBLE.md section 54 are sent from — once per session established,
 * never from a screen, which could send one twice or not at all.
 *
 * ⚠️ Those events carry the role and nothing else. Never the phone number, the
 * name, the one-time code or the vendor auth code (section 7A.2).
 *
 * The two vendor thunks also remember the vendor's phone number on this device
 * once their session exists, so the next vendor sign in asks for the code alone.
 * The phone only: the code they were just given is passed to the service and
 * nowhere else (`rememberedVendorStorage` refuses anything that is not a phone
 * number as a second line).
 */

import { createLogger } from '@/core/logger/Logger';
import { getSessionStorage } from '@/core/storage/SessionStorage';
import { getRememberedVendorStorage } from '@/features/auth/state/rememberedVendorStorage';
import {
  sessionAbsent,
  sessionRestored,
  signedIn,
  signedOut,
  userUpdated,
} from '@/features/auth/state/authSlice';
import type { AuthUser, SessionPayload } from '@/features/auth/types';
import { getService } from '@/shared/services/ServiceRegistry';
import { identifyUser, trackEvent } from '@/shared/services/telemetry';
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

  // Now rather than at publish: the session is real from the moment it is on
  // disk, and the event the caller sends next belongs to this user, not to the
  // nobody the hold would leave it with.
  identifyUser(session.user);

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
 * Remembers which phone a vendor just signed in with.
 *
 * After the session, never before it: a number is remembered because it signed
 * in, and a refused attempt must not replace the one that worked last time.
 *
 * ⚠️ Can never fail a sign in. The storage module already answers its own
 * failures; the catch is for an implementation that breaks that promise, and a
 * vendor who is signed in must not be told otherwise because a shortcut for
 * next time could not be kept. Logged by kind only — never the number.
 */
async function rememberVendorPhone(phone: string): Promise<void> {
  try {
    await getRememberedVendorStorage().remember(phone);
  } catch (caught) {
    log.warn('Could not remember the vendor phone', { kind: AppError.from(caught).kind });
  }
}

/**
 * Reads any stored session at startup. Always resolves: a failure to read means
 * "not signed in", not an error the user must act on.
 */
export async function restoreSession(dispatch: Dispatch): Promise<void> {
  const session = await getSessionStorage().read();

  if (session) {
    log.info('Session restored', { role: session.user.role });
    identifyUser(session.user);
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

  // ⚠️ Every customer verification counts as a login — including the first, the
  // one that created the account (section 7A.1). Section 54's
  // `signup_completed` needs the backend to say which of the two this was, and
  // `verifyCustomerOtp` answers with a session that does not. Guessing from an
  // empty name would count a customer who never gave one as new at every sign
  // in. An open item until the contract carries it.
  trackEvent('login_completed', { role: session.user.role });
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

  // The number the vendor signed in with, not `session.user.phone`: it has just
  // been proven to work with this call, which is what it will be used for.
  await rememberVendorPhone(phone);

  trackEvent('login_completed', { role: session.user.role });
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
 *
 * `phone` is the number the vendor typed at registration, normalised as it was
 * sent. It is not sent here — the service is keyed by the registration id — and
 * is only remembered once the session exists.
 */
export async function confirmVendorAuthCode(
  dispatch: Dispatch,
  registrationId: string,
  phone: string,
  authCode: string,
): Promise<SessionPayload> {
  const session = await getService('auth').verifyVendorAuthCode(registrationId, authCode);

  // Confirmation runs the same animation as the one-time code, and earns the
  // same pause before the vendor application replaces it.
  await establishSession(dispatch, session, duration.verifiedHold);

  // ⚠️ The number typed at registration, not `session.user.phone`, for the
  // reason sign in gives: the remembered number is what the next code-only
  // sign in sends, and the account's number has no format contract. A backend
  // answering "+919000000001" would be remembered as twelve digits, and that
  // next sign in would fail as a wrong code.
  await rememberVendorPhone(phone);

  // Section 54's `vendor_signup`, sent here because this is where onboarding is
  // finished: a vendor who stops before confirming their code has no account to
  // count. Not `login_completed` as well — that counts returning vendors
  // signing in with a code they already hold.
  trackEvent('vendor_signup', { role: session.user.role });
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
  // Before the app is told, as signing in identifies before it publishes:
  // nothing recorded from here on may be filed under the user who just left.
  identifyUser(null);
  dispatch(signedOut());
  log.info('Signed out');
}

/**
 * Adopts a customer record the backend has just returned (Phase 3D-8).
 *
 * The device is written before the application is told, the same order every
 * other session change here uses: a profile that is on screen but not on disk
 * would revert at the next launch with nothing to explain it, and of the two
 * the silent revert is far worse than a moment's delay.
 *
 * ⚠️ There is no session to update when nobody is signed in, and this says so
 * rather than inventing one. That is not a theoretical case — signing out and
 * a request finishing can race, and the loser must not resurrect a session the
 * customer has just ended.
 */
export async function updateSessionUser(dispatch: Dispatch, user: AuthUser): Promise<void> {
  const session = await getSessionStorage().read();
  if (!session) {
    log.warn('Profile updated with no session to keep it in');
    return;
  }

  await getSessionStorage().write({ ...session, user });
  dispatch(userUpdated(user));
  log.info('Profile updated');
}
