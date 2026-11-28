/**
 * i18n — the app in English, Hindi and Gujarati
 *
 * Multi-language is a Phase 2 item the owner approved on 28/11/2026
 * (phase5-contract.md section 7, PROJECT_BIBLE.md section 75). This module is
 * the whole mechanism; it lives in `core/` because the HTTP client reads the
 * locale too, and `core/` may not depend on anything above it.
 *
 * - `locale.ts` — the current language, whether one has been chosen, and
 *   whether the saved choice has been read. A tiny store with `subscribe`.
 * - `localized.ts` — `localized({ en, hi, gu })`: one object of the English
 *   table's type that answers in the current language, key by key, falling back
 *   to English.
 *
 * Saving the choice and the chooser screens are the language feature's
 * (`features/language`). When the language changes, AppRoot re-mounts the tree
 * below the providers, so every mounted screen reads its copy again at once.
 *
 * ## How to convert a copy file (the pattern every table follows)
 *
 * 1. Keep the English object in its file, renamed with `_EN`, and export it:
 *    `export const VENDOR_COPY_EN = Object.freeze({ … })`. Nothing else in it
 *    changes — not one English word.
 * 2. Beside it, add `vendorCopy.hi.ts` and `vendorCopy.gu.ts`, each one typed
 *    object literal, with no `Object.freeze` inside (that would switch off the
 *    excess-key check):
 *
 *        import type { LocaleTable } from '@/core/i18n';
 *        import type { VENDOR_COPY_EN } from './vendorCopy';
 *
 *        export const VENDOR_COPY_HI: LocaleTable<typeof VENDOR_COPY_EN> = {
 *          dashboard: { title: 'डैशबोर्ड' },
 *        };
 *
 *    `import type` keeps the two files from loading each other at run time.
 *    Leave out anything that must not change (ids, icon names, `{placeholders}`
 *    you are not moving) and it falls back to English.
 * 3. Export the old name from the English file:
 *    `export const VENDOR_COPY = localized({ en: VENDOR_COPY_EN, hi: VENDOR_COPY_HI, gu: VENDOR_COPY_GU });`
 *    Every import of `VENDOR_COPY` keeps working, with the same type.
 * 4. Find the module-scope reads of that copy and move them into render (see
 *    below). A section alias (`const COPY = VENDOR_COPY.profile`) is fine.
 * 5. Add the table to `__tests__/i18n/translationKeys.test.ts`, which fails on
 *    a Hindi or Gujarati key that English does not have.
 *
 * Function values translate as functions with the English signature
 * (`copyReference: (reference: string) => \`संदर्भ ${reference} कॉपी करें\``).
 * Placeholders such as `{wait}`, `{count}`, `{destination}` stay exactly as
 * written, whatever the word order around them.
 *
 * ## How fallback works
 *
 * Each leaf is chosen on read: the current locale's value if its table has the
 * key and the value is the same kind (string for string, function for
 * function), otherwise English. So a half-translated table is safe to ship:
 * what is missing reads in English. Nothing is ever `undefined`.
 *
 * ## What must never be captured at module scope
 *
 * Any leaf: a string, a function's result, a template built from copy, an
 * array or map of labels (`Object.freeze([{ label: COPY.all }])`), a zod
 * message (`.min(1, COPY.required)` — write `{ error: () => COPY.required }`),
 * a navigation `title` set outside render, a default prop computed once. Each
 * is fixed in the language of the moment its module loaded. Read it in render,
 * or in a function called from render.
 *
 * ## Adding a language
 *
 * Add its code to `AppLocale` and `APP_LOCALES` in `locale.ts`, its tag to
 * `intlLocaleTag`, its own-script name to `LANGUAGE_NAMES` in
 * `features/language/constants/languageCopy.ts`, and a `.xx.ts` beside each
 * table. `LocaleTables` picks up the new key by itself.
 *
 * ## What stays English
 *
 * Text the backend writes — notification titles and messages, category and
 * service names — comes from the server in English and is shown as sent. The
 * app sends `Accept-Language` on every call as the seam for a backend that one
 * day answers in kind.
 */

export {
  APP_LOCALES,
  DEFAULT_LOCALE,
  getLocale,
  getLocaleState,
  intlLocaleTag,
  isAppLocale,
  resetLocaleState,
  subscribeLocale,
  updateLocaleState,
  type AppLocale,
  type LocaleState,
} from '@/core/i18n/locale';

export {
  localized,
  unknownTranslationKeys,
  type LocaleTable,
  type LocaleTables,
  type TranslatedLocale,
  type Translation,
} from '@/core/i18n/localized';
