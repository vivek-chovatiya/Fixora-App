/**
 * Navigation copy — Hindi. Translates `NAVIGATION_COPY_EN` in
 * `navigationCopy.ts`; a key left out reads in English.
 */

import type { LocaleTable } from '@/core/i18n';
import type { NAVIGATION_COPY_EN } from '@/navigation/navigationCopy';

export const NAVIGATION_COPY_HI: LocaleTable<typeof NAVIGATION_COPY_EN> = {
  customerTabs: {
    Home: 'होम',
    Requests: 'रिक्वेस्ट',
    Profile: 'प्रोफ़ाइल',
  },
  vendorTabs: {
    Dashboard: 'डैशबोर्ड',
    Requests: 'रिक्वेस्ट',
    Team: 'टीम',
    Profile: 'प्रोफ़ाइल',
  },
};
