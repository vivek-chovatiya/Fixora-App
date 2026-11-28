/**
 * Shared validation copy — Hindi. Translates `VALIDATION_COPY_EN` in
 * `validationCopy.ts`; a key left out reads in English. `{count}` stays as it is.
 *
 * ⚠️ `image.type` must stay identical to `FILE_TYPE_NOT_ALLOWED` in
 * `shared/types/error.hi.ts`.
 */

import type { LocaleTable } from '@/core/i18n';
import type { VALIDATION_COPY_EN } from '@/shared/validation/validationCopy';

export const VALIDATION_COPY_HI: LocaleTable<typeof VALIDATION_COPY_EN> = {
  phone: {
    required: 'अपना फ़ोन नंबर डालें।',
    digitsOnly: 'फ़ोन नंबर में सिर्फ़ अंक डालें।',
    tooShort: 'यह नंबर बहुत छोटा लग रहा है। कृपया जाँच लें।',
    tooLong: 'यह नंबर बहुत लंबा लग रहा है। कृपया जाँच लें।',
  },
  email: {
    invalid: 'सही ईमेल पता डालें।',
  },
  image: {
    type: 'सिर्फ़ JPG, PNG और WebP फ़ोटो ही लगाई जा सकती हैं।',
    size: 'फ़ोटो {count} MB से छोटी होनी चाहिए।',
  },
};
