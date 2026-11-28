/**
 * Authentication form messages — Hindi. Translates `AUTH_VALIDATION_COPY_EN` in
 * `authSchemas.ts`; a key left out reads in English. `{count}` stays as it is.
 */

import type { LocaleTable } from '@/core/i18n';
import type { AUTH_VALIDATION_COPY_EN } from '@/features/auth/validation/authSchemas';

export const AUTH_VALIDATION_COPY_HI: LocaleTable<typeof AUTH_VALIDATION_COPY_EN> = {
  codeRequired: 'हमारा भेजा हुआ कोड डालें।',
  codeDigitsOnly: 'कोड में सिर्फ़ अंक होते हैं।',
  codeLength: 'सभी {count} अंक डालें।',
  businessNameRequired: 'बिज़नेस का नाम डालें।',
  businessNameTooLong: 'बिज़नेस का नाम {count} अक्षरों से ज़्यादा नहीं हो सकता।',
  firstNameRequired: 'पहला नाम डालें।',
  firstNameTooLong: 'पहला नाम {count} अक्षरों से ज़्यादा नहीं हो सकता।',
  lastNameRequired: 'सरनेम डालें।',
  lastNameTooLong: 'सरनेम {count} अक्षरों से ज़्यादा नहीं हो सकता।',
  servicesRequired: 'आप जो सेवाएँ देते हैं, उनमें से कम से कम एक चुनें।',
};
