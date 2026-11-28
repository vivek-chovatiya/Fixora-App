/**
 * Language copy — Hindi. Translates `LANGUAGE_COPY_EN` in `languageCopy.ts`; a
 * key left out reads in English. `{language}` stays as it is.
 */

import type { LocaleTable } from '@/core/i18n';
import type { LANGUAGE_COPY_EN } from '@/features/language/constants/languageCopy';

export const LANGUAGE_COPY_HI: LocaleTable<typeof LANGUAGE_COPY_EN> = {
  chooser: {
    title: 'अपनी भाषा चुनें',
    subtitle: 'आप इसे कभी भी अपनी प्रोफ़ाइल से बदल सकते हैं।',
    continue: 'आगे बढ़ें',
    continueHint: 'ऐप को आपकी चुनी हुई भाषा में दिखाता है',

    changeTitle: 'भाषा',
    changeSubtitle: 'इस फ़ोन पर ऐप किस भाषा में दिखे, यह चुनें।',
    save: 'सेव करें',
    saveHint: 'ऐप को आपकी चुनी हुई भाषा में दिखाता है और आपकी प्रोफ़ाइल पर वापस ले जाता है',
    back: 'वापस',
    backHint: 'भाषा बदले बिना आपकी प्रोफ़ाइल पर वापस ले जाता है',

    listLabel: 'भाषाएँ',
    optionHint: 'यह भाषा चुनता है',
  },
  names: {
    en: 'अंग्रेज़ी',
    hi: 'हिन्दी',
    gu: 'गुजराती',
  },
  profileRow: {
    label: 'भाषा: {language}',
    hint: 'ऐप की भाषा चुनने देता है',
  },
};
