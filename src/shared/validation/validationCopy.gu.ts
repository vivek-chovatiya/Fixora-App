/**
 * Shared validation copy — Gujarati. Translates `VALIDATION_COPY_EN` in
 * `validationCopy.ts`; a key left out reads in English. `{count}` stays as it is.
 *
 * ⚠️ `image.type` must stay identical to `FILE_TYPE_NOT_ALLOWED` in
 * `shared/types/error.gu.ts`.
 */

import type { LocaleTable } from '@/core/i18n';
import type { VALIDATION_COPY_EN } from '@/shared/validation/validationCopy';

export const VALIDATION_COPY_GU: LocaleTable<typeof VALIDATION_COPY_EN> = {
  phone: {
    required: 'તમારો ફોન નંબર નાખો.',
    digitsOnly: 'ફોન નંબરમાં ફક્ત અંક નાખો.',
    tooShort: 'આ નંબર બહુ નાનો લાગે છે. કૃપા કરીને તપાસી લો.',
    tooLong: 'આ નંબર બહુ લાંબો લાગે છે. કૃપા કરીને તપાસી લો.',
  },
  email: {
    invalid: 'સાચું ઇમેઇલ સરનામું નાખો.',
  },
  image: {
    type: 'ફક્ત JPG, PNG અને WebP ફોટા જ લગાવી શકાય છે.',
    size: 'ફોટો {count} MB કરતાં નાનો હોવો જોઈએ.',
  },
};
