/**
 * Language hooks
 *
 * What a screen or navigator needs to know about the app's language, and the
 * chooser's own state — so no screen reads the locale store or the storage seam
 * itself (CLAUDE.md section 4: screen → feature hook → the layer below).
 *
 * - `useLocaleState` follows the locale store: the language, whether one has
 *   been chosen on this device, whether the saved choice has been read.
 * - `useLanguageChoice` is the chooser: the options in order, the one selected
 *   (the current language until another is tapped), and `confirm`, which saves
 *   the selection and applies it. It refuses a second press while the first is
 *   saving, so the button can lock on `isSaving`.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  APP_LOCALES,
  getLocaleState,
  subscribeLocale,
  type AppLocale,
  type LocaleState,
} from '@/core/i18n';
import { createLogger } from '@/core/logger/Logger';
import { LANGUAGE_COPY, LANGUAGE_NAMES } from '@/features/language/constants/languageCopy';
import { chooseLocale } from '@/features/language/state/localeChoice';

const log = createLogger('useLanguageChoice');

export function useLocaleState(): LocaleState {
  return useSyncExternalStore(subscribeLocale, getLocaleState, getLocaleState);
}

export interface LanguageOptionModel {
  locale: AppLocale;
  /** In its own script, whatever the app speaks: "हिन्दी". */
  name: string;
  /** In the language the app speaks now, or null where it would only repeat `name`. */
  localName: string | null;
}

/** The options, in `APP_LOCALES` order, named as the chooser shows them. Read in render. */
export function languageOptions(): LanguageOptionModel[] {
  return APP_LOCALES.map(locale => {
    const name = LANGUAGE_NAMES[locale];
    const localName = LANGUAGE_COPY.names[locale];
    return { locale, name, localName: localName === name ? null : localName };
  });
}

export interface LanguageChoice {
  options: LanguageOptionModel[];
  selected: AppLocale;
  select: (locale: AppLocale) => void;
  /** Saves the selection and applies it. A second call while one is saving is ignored. */
  confirm: () => void;
  isSaving: boolean;
}

export function useLanguageChoice(): LanguageChoice {
  const { locale } = useLocaleState();
  const [selected, setSelected] = useState<AppLocale>(locale);
  const [isSaving, setIsSaving] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const confirm = useCallback(() => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setIsSaving(true);
    chooseLocale(selected)
      .catch(error => {
        // The storage already answers rather than rejects; nothing else in a
        // choice can fail, so this is the record of something unforeseen.
        log.error('Could not apply the chosen language', { error: String(error) });
      })
      .finally(() => {
        inFlight.current = false;
        // A new language re-mounts the tree, so this screen is usually gone by now.
        if (mounted.current) {
          setIsSaving(false);
        }
      });
  }, [selected]);

  return { options: languageOptions(), selected, select: setSelected, confirm, isSaving };
}
