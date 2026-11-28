/**
 * Authentication form messages — Gujarati. Translates `AUTH_VALIDATION_COPY_EN`
 * in `authSchemas.ts`; a key left out reads in English. `{count}` stays as it is.
 */

import type { LocaleTable } from '@/core/i18n';
import type { AUTH_VALIDATION_COPY_EN } from '@/features/auth/validation/authSchemas';

export const AUTH_VALIDATION_COPY_GU: LocaleTable<typeof AUTH_VALIDATION_COPY_EN> = {
  codeRequired: 'અમે મોકલેલો કોડ નાખો.',
  codeDigitsOnly: 'કોડમાં ફક્ત અંક હોય છે.',
  codeLength: 'બધા {count} અંક નાખો.',
  businessNameRequired: 'બિઝનેસનું નામ નાખો.',
  businessNameTooLong: 'બિઝનેસનું નામ {count} અક્ષરથી વધુ ન હોઈ શકે.',
  firstNameRequired: 'પહેલું નામ નાખો.',
  firstNameTooLong: 'પહેલું નામ {count} અક્ષરથી વધુ ન હોઈ શકે.',
  lastNameRequired: 'અટક નાખો.',
  lastNameTooLong: 'અટક {count} અક્ષરથી વધુ ન હોઈ શકે.',
  servicesRequired: 'તમે આપો છો તે સેવાઓમાંથી ઓછામાં ઓછી એક પસંદ કરો.',
};
