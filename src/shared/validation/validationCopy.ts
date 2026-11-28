/**
 * Shared validation copy
 *
 * The sentences the shared field rules refuse with — phone (`phone.ts`), email
 * (`email.ts`) and image (`image.ts`) — in one table, so the three can be
 * translated together (phase5-contract.md section 7, 28/11/2026).
 *
 * `VALIDATION_COPY_EN` is the source; `validationCopy.hi.ts` and `.gu.ts`
 * translate it; `VALIDATION_COPY` answers in the current language.
 *
 * ⚠️ A schema built at module scope must read these through a function —
 * `{ error: () => VALIDATION_COPY.phone.required }` — never as a string, or the
 * message is fixed in the language the module loaded in.
 *
 * ⚠️ `image.type` is the backend refusal's sentence too (`FILE_TYPE_NOT_ALLOWED`
 * in `shared/types/error.ts`), in every language: both refusals read the same.
 */

import { localized } from '@/core/i18n';
import { VALIDATION_COPY_GU } from '@/shared/validation/validationCopy.gu';
import { VALIDATION_COPY_HI } from '@/shared/validation/validationCopy.hi';

export const VALIDATION_COPY_EN = Object.freeze({
  phone: Object.freeze({
    required: 'Enter your phone number.',
    digitsOnly: 'Enter a phone number using digits only.',
    tooShort: 'That number looks too short. Please check it.',
    tooLong: 'That number looks too long. Please check it.',
  }),
  email: Object.freeze({
    invalid: 'Enter a valid email address.',
  }),
  image: Object.freeze({
    type: 'Only JPG, PNG and WebP images are supported.',
    /** `{count}` is the limit in megabytes. */
    size: 'Images must be smaller than {count} MB.',
  }),
});

export const VALIDATION_COPY = localized({
  en: VALIDATION_COPY_EN,
  hi: VALIDATION_COPY_HI,
  gu: VALIDATION_COPY_GU,
});
