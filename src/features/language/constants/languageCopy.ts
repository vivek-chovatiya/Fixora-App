/**
 * Language copy
 *
 * The words of the language chooser — the one-time "Choose your language"
 * screen on first launch, and the same screen opened from the Language row in
 * the customer and vendor profiles (phase5-contract.md section 7, approved by
 * the owner 28/11/2026).
 *
 * `LANGUAGE_COPY_EN` is the source; `languageCopy.hi.ts` and `.gu.ts` translate
 * it; `LANGUAGE_COPY` answers in the current language.
 *
 * ⚠️ `LANGUAGE_NAMES` is not translated and never will be: each language is
 * listed in its own script, so a person who cannot read the current one can
 * still find theirs. `names` is the other half — what each is called in the
 * language the app speaks now — shown beneath, and spoken with it.
 */

import { localized, type AppLocale } from '@/core/i18n';
import { LANGUAGE_COPY_GU } from '@/features/language/constants/languageCopy.gu';
import { LANGUAGE_COPY_HI } from '@/features/language/constants/languageCopy.hi';

/** Each language in its own script. Adding a language adds a line here. */
export const LANGUAGE_NAMES: Readonly<Record<AppLocale, string>> = Object.freeze({
  en: 'English',
  hi: 'हिन्दी',
  gu: 'ગુજરાતી',
});

export const LANGUAGE_COPY_EN = Object.freeze({
  chooser: Object.freeze({
    /** First launch. */
    title: 'Choose your language',
    subtitle: 'You can change it any time from your profile.',
    continue: 'Continue',
    continueHint: 'Shows the app in the language you selected',

    /** Opened from a profile. */
    changeTitle: 'Language',
    changeSubtitle: 'Choose the language the app uses on this phone.',
    save: 'Save',
    saveHint: 'Shows the app in the language you selected and returns to your profile',
    back: 'Back',
    backHint: 'Returns to your profile without changing the language',

    /** Names the group of options for a screen reader. */
    listLabel: 'Languages',
    optionHint: 'Selects this language',
  }),

  /** What each language is called in the language the app speaks now. */
  names: Object.freeze({
    en: 'English',
    hi: 'Hindi',
    gu: 'Gujarati',
  }),

  /** The row in both profiles. `{language}` is the current one, in its own script. */
  profileRow: Object.freeze({
    label: 'Language: {language}',
    hint: 'Lets you choose the language the app uses',
  }),
});

export const LANGUAGE_COPY = localized({
  en: LANGUAGE_COPY_EN,
  hi: LANGUAGE_COPY_HI,
  gu: LANGUAGE_COPY_GU,
});
