/**
 * Navigation copy — Gujarati. Translates `NAVIGATION_COPY_EN` in
 * `navigationCopy.ts`; a key left out reads in English.
 */

import type { LocaleTable } from '@/core/i18n';
import type { NAVIGATION_COPY_EN } from '@/navigation/navigationCopy';

export const NAVIGATION_COPY_GU: LocaleTable<typeof NAVIGATION_COPY_EN> = {
  customerTabs: {
    Home: 'હોમ',
    Requests: 'રિક્વેસ્ટ',
    Profile: 'પ્રોફાઇલ',
  },
  vendorTabs: {
    Dashboard: 'ડેશબોર્ડ',
    Requests: 'રિક્વેસ્ટ',
    Team: 'ટીમ',
    Profile: 'પ્રોફાઇલ',
  },
};
