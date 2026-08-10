/**
 * Application bootstrap
 *
 * One-time wiring performed before the first render.
 *
 * This is the file that connects the pieces the foundation left deliberately
 * unconnected: the HTTP client exposes `setTokenProvider` and
 * `setUnauthorizedHandler` but never calls them itself, so that core/http stays
 * unaware of Redux and of how sessions are stored.
 */

import { setTokenProvider, setUnauthorizedHandler } from '@/core/http/HttpClient';
import { createLogger } from '@/core/logger/Logger';
import { store } from '@/app/store';
import { signOut } from '@/features/auth/state/authThunks';
import { configureServices } from '@/shared/services/ServiceRegistry';

const log = createLogger('bootstrap');

let hasBootstrapped = false;

export function bootstrapApp(): void {
  if (hasBootstrapped) {
    return;
  }
  hasBootstrapped = true;

  configureServices();

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

  log.info('Application bootstrapped');
}
