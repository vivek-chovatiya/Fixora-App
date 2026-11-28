/**
 * The app's current language
 *
 * One small store, outside React and outside Redux, that says which language
 * the interface speaks right now (phase5-contract.md section 7, approved by the
 * owner 28/11/2026 as a Phase 2 item; PROJECT_BIBLE.md section 75).
 *
 * Outside React because the things that read it are not all components: every
 * copy table resolves its words through `getLocale()` at the moment a property
 * is read (`localized.ts`), and the HTTP client sends it as `Accept-Language` on
 * each request. Outside Redux because nothing about it is a reducer's business —
 * it is one value, three flags, and a list of listeners — and because `core/`
 * must not depend on the app's store.
 *
 * The state holds three things:
 * - `locale`, the language in use;
 * - `isChosen`, whether someone on this device has picked one (a saved choice
 *   was found, or one was made this session) — the first-launch chooser is shown
 *   while it is false;
 * - `isRestored`, whether the saved choice has been read yet — nothing renders
 *   until it is, so the first screen is never drawn in the wrong language.
 *
 * Deliberately no persistence here. Reading and writing the saved choice is the
 * language feature's job (`features/language/state/localeChoice.ts`), through
 * the storage seam; this file only holds what that job decided.
 *
 * ⚠️ `updateLocaleState` notifies synchronously and once per call, whatever it
 * changed. AppRoot re-mounts the whole tree when the locale changes, so a caller
 * that set the locale and the chosen flag in two calls would re-mount twice.
 * Change them together.
 */

export type AppLocale = 'en' | 'hi' | 'gu';

/** Every language the app can speak, in the order the chooser lists them. */
export const APP_LOCALES: readonly AppLocale[] = Object.freeze(['en', 'hi', 'gu'] as const);

/** What the app speaks before anyone chooses, and what a missing translation falls back to. */
export const DEFAULT_LOCALE = 'en' satisfies AppLocale;

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

export interface LocaleState {
  readonly locale: AppLocale;
  /** A language has been picked on this device — saved earlier, or chosen this session. */
  readonly isChosen: boolean;
  /** The saved choice has been read (or the read gave up), so the app may render. */
  readonly isRestored: boolean;
}

const INITIAL_STATE: LocaleState = Object.freeze({
  locale: DEFAULT_LOCALE,
  isChosen: false,
  isRestored: false,
});

let state: LocaleState = INITIAL_STATE;

const listeners = new Set<() => void>();

/** The language in use. Cheap: every copy property read calls it. */
export function getLocale(): AppLocale {
  return state.locale;
}

/** The whole state, as one frozen object that changes identity only when something changed. */
export function getLocaleState(): LocaleState {
  return state;
}

/**
 * Changes any of the three values, and tells every listener once if anything
 * actually changed. An unknown locale is refused rather than stored: a value
 * read from a device or a test must never become the language the copy resolves
 * against.
 */
export function updateLocaleState(change: Partial<LocaleState>): void {
  const next: LocaleState = {
    locale: change.locale !== undefined && isAppLocale(change.locale) ? change.locale : state.locale,
    isChosen: change.isChosen ?? state.isChosen,
    isRestored: change.isRestored ?? state.isRestored,
  };

  if (
    next.locale === state.locale &&
    next.isChosen === state.isChosen &&
    next.isRestored === state.isRestored
  ) {
    return;
  }

  state = Object.freeze(next);
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Calls `listener` after every change. Returns the unsubscribe. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The tag `toLocaleDateString` / `toLocaleTimeString` should format with.
 *
 * `undefined` for English, which is exactly what every caller passed before
 * languages existed — the device's own English format, unchanged. Hindi and
 * Gujarati name the Indian form, so day and month names follow the interface.
 */
export function intlLocaleTag(locale: AppLocale = getLocale()): string | undefined {
  switch (locale) {
    case 'hi':
      return 'hi-IN';
    case 'gu':
      return 'gu-IN';
    default:
      return undefined;
  }
}

/** Back to English, not chosen, not restored. For tests only. */
export function resetLocaleState(): void {
  state = INITIAL_STATE;
  for (const listener of [...listeners]) {
    listener();
  }
}
