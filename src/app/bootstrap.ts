/**
 * Application bootstrap
 *
 * One-time wiring performed before the first render.
 *
 * This is the file that connects the pieces the foundation left deliberately
 * unconnected: the HTTP client exposes `setTokenProvider` and
 * `setUnauthorizedHandler` but never calls them itself, so that core/http stays
 * unaware of Redux and of how sessions are stored.
 *
 * It is also where crash handling starts and where `app_opened` is sent
 * (PROJECT_BIBLE.md sections 54 and 57): this runs once per start of the
 * JavaScript, before anything renders, which is what a cold start is.
 */

import { setTokenProvider, setUnauthorizedHandler } from '@/core/http/HttpClient';
import { createLogger } from '@/core/logger/Logger';
import { installGlobalErrorHandler } from '@/app/globalErrorHandler';
import { store } from '@/app/store';
import { signOut } from '@/features/auth/state/authThunks';
import { configureServices } from '@/shared/services/ServiceRegistry';
import { trackEvent } from '@/shared/services/telemetry';

const log = createLogger('bootstrap');

let hasBootstrapped = false;

export function bootstrapApp(): void {
  if (hasBootstrapped) {
    return;
  }
  hasBootstrapped = true;

  configureServices();

  // Straight after the registry, so the crash reporter it records to already
  // exists, and before anything else here can throw.
  installGlobalErrorHandler();

  // Reads the token at request time rather than capturing it, so a sign in or
  // sign out takes effect on the very next request without re-registering.
  setTokenProvider(() => store.getState().auth.token);

  // A 401 means the session is dead server-side. Clearing it locally flips the
  // root navigator back to the auth flow — there is no imperative navigation
  // here, and no screen has to handle expiry itself.
  setUnauthorizedHandler(() => {
    if (store.getState().auth.status !== 'authenticated') {
      return;
    }
    log.warn('Session rejected by server; signing out.');
    void signOut(store.dispatch);
  });

  // Once per cold start: the guard above holds for the life of the JavaScript,
  // and coming back from the background does not run this again. No
  // properties — the stored session has not been read yet, so the role is not
  // known here, and `identifyUser` attributes what follows once it is.
  trackEvent('app_opened');

  log.info('Application bootstrapped');
}
