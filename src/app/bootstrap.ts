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
import { startRestoringSavedLocale } from '@/features/language/state/localeChoice';
import { configureServices, getService } from '@/shared/services/ServiceRegistry';
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

  // The saved language, read now so it is usually known by the first render;
  // AppRoot draws nothing until it is (phase5-contract.md section 7). It never
  // rejects — an unreadable choice reads as none, and the chooser asks again.
  startRestoringSavedLocale();

  // Push messages that arrive with the app in the background or closed
  // (phase5-contract.md section 6). Here, at the start of the JavaScript and
  // before anything renders, because such a message starts this JavaScript on
  // its own, with no screen; a handler set by a component would miss it. With
  // push off (no Firebase config in the build) this does nothing.
  getService('push').handleBackgroundMessages();

  // Reads the token at request time rather than capturing it, so a sign in or
  // sign out takes effect on the very next request without re-registering.
  setTokenProvider(() => store.getState().auth.token);

  // A 401 means the session is dead server-side. Clearing it locally flips the
  // root navigator back to the auth flow — there is no imperative navigation
  // here, and no screen has to handle expiry itself.
  //
  // ⚠️ HttpClient only calls this for a 401 on a request that carried the token
  // signed in now, so a late answer for an account that has already left cannot
  // sign out the next one; and `signOut` is single-flight, so a burst of 401s
  // from one dying session ends it once.
  //
  // `forced`: nobody asked to leave, so the session is cleared without waiting
  // for this device's push token to be unregistered — a call the refused
  // session cannot authorise any more (`authThunks.endSession`).
  setUnauthorizedHandler(() => {
    if (store.getState().auth.status !== 'authenticated') {
      return;
    }
    log.warn('Session rejected by server; signing out.');
    void signOut(store.dispatch, { forced: true });
  });

  // Once per cold start: the guard above holds for the life of the JavaScript,
  // and coming back from the background does not run this again. No
  // properties — the stored session has not been read yet, so the role is not
  // known here, and `identifyUser` attributes what follows once it is.
  trackEvent('app_opened');

  log.info('Application bootstrapped');
}
