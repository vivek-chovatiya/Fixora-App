/**
 * The language choice: read at start, saved when made
 *
 * The two things that touch the device for the app's language
 * (phase5-contract.md section 7): restoring the saved choice before anything
 * renders, and saving a new one. Both go through `LocaleStorage` (the storage
 * seam) and leave the outcome in the locale store (`core/i18n`), which AppRoot
 * and the navigators follow.
 *
 * ⚠️ `restoreSavedLocale` runs once per start of the JavaScript, from
 * `bootstrapApp`, and AppRoot draws nothing until it has finished — so the
 * first screen is never drawn in English and then redrawn in Hindi. It always
 * finishes: `LocaleStorage` answers rather than rejects, an unreadable choice
 * reads as none, and a read that has not answered within
 * `AppConfig.locale.restoreTimeoutMs` is given up on and read as none too
 * (reviewer finding, 28/11/2026 — a storage call that never settled left a
 * blank screen). The chooser is shown again rather than the app hanging.
 *
 * ⚠️ A read that answers after it was given up on is ignored. By then the app
 * is drawn in English with the chooser in front; applying a late Hindi would
 * re-mount everything under a person who may be choosing at that moment. The
 * cost is choosing once more, which saves it again.
 *
 * ⚠️ `chooseLocale` changes the locale and the chosen flag in one update, after
 * the save. AppRoot re-mounts the whole tree below the providers when the
 * locale changes; two updates would re-mount it twice.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { updateLocaleState, type AppLocale } from '@/core/i18n';
import { createLogger } from '@/core/logger/Logger';
import { getLocaleStorage } from '@/core/storage/LocaleStorage';

const log = createLogger('localeChoice');

let restoring: Promise<void> | null = null;

/**
 * The saved language, or null when none is saved, it cannot be read, or the
 * read outlasts `AppConfig.locale.restoreTimeoutMs`. Never rejects.
 */
async function readSavedWithinLimit(): Promise<AppLocale | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const givenUp = new Promise<null>(resolve => {
    timer = setTimeout(() => {
      log.warn('The saved language took too long to read; starting without it');
      resolve(null);
    }, AppConfig.locale.restoreTimeoutMs);
  });

  try {
    // A read that loses the race is left to settle on its own; the race has
    // already attached to it, so its answer — or its failure — goes nowhere.
    return await Promise.race([getLocaleStorage().read(), givenUp]);
  } catch (error) {
    // The storage answers rather than rejects; this is the belt to its
    // braces, so that a start can never be stuck waiting for a language.
    log.error('Could not restore the saved language', { error: String(error) });
    return null;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

/**
 * Reads the saved language into the locale store and marks it restored. Safe to
 * call more than once: every call shares the first read.
 */
export function restoreSavedLocale(): Promise<void> {
  if (!restoring) {
    restoring = (async () => {
      const saved = await readSavedWithinLimit();
      updateLocaleState(
        saved ? { locale: saved, isChosen: true, isRestored: true } : { isRestored: true },
      );
    })();
  }
  return restoring;
}

/**
 * Starts `restoreSavedLocale` without waiting for it — for `bootstrapApp` and
 * AppRoot, which only need it begun (AppRoot follows the store for the end).
 */
export function startRestoringSavedLocale(): void {
  restoreSavedLocale().catch(error => {
    log.error('Could not restore the saved language', { error: String(error) });
  });
}

/**
 * Saves `locale` and makes it the app's language. A failed save is logged by
 * the storage and survived: the choice still applies now, and the chooser comes
 * back on the next start — the mild way round.
 */
export async function chooseLocale(locale: AppLocale): Promise<void> {
  await getLocaleStorage().write(locale);
  updateLocaleState({ locale, isChosen: true });
}

/** Forgets that a restore ran, so the next call reads again. For tests only. */
export function resetLocaleChoiceForTests(): void {
  restoring = null;
}
