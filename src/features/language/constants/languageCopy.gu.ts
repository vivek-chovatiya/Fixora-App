/**
 * Language copy — Gujarati. Translates `LANGUAGE_COPY_EN` in `languageCopy.ts`;
 * a key left out reads in English. `{language}` stays as it is.
 */

import type { LocaleTable } from '@/core/i18n';
import type { LANGUAGE_COPY_EN } from '@/features/language/constants/languageCopy';

export const LANGUAGE_COPY_GU: LocaleTable<typeof LANGUAGE_COPY_EN> = {
  chooser: {
    title: 'તમારી ભાષા પસંદ કરો',
    subtitle: 'તમે તેને ગમે ત્યારે તમારી પ્રોફાઇલમાંથી બદલી શકો છો.',
    continue: 'આગળ વધો',
    continueHint: 'ઍપને તમે પસંદ કરેલી ભાષામાં બતાવે છે',

    changeTitle: 'ભાષા',
    changeSubtitle: 'આ ફોન પર ઍપ કઈ ભાષામાં દેખાય તે પસંદ કરો.',
    save: 'સેવ કરો',
    saveHint: 'ઍપને તમે પસંદ કરેલી ભાષામાં બતાવે છે અને તમારી પ્રોફાઇલ પર પાછા લઈ જાય છે',
    back: 'પાછા',
    backHint: 'ભાષા બદલ્યા વગર તમારી પ્રોફાઇલ પર પાછા લઈ જાય છે',

    listLabel: 'ભાષાઓ',
    optionHint: 'આ ભાષા પસંદ કરે છે',
  },
  names: {
    en: 'અંગ્રેજી',
    hi: 'હિન્દી',
    gu: 'ગુજરાતી',
  },
  profileRow: {
    label: 'ભાષા: {language}',
    hint: 'ઍપની ભાષા પસંદ કરવા દે છે',
  },
};
