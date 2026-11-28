/**
 * Navigation copy
 *
 * The bottom tabs' names, for both applications. They used to be the route
 * names themselves ("Home", "Requests") drawn as labels, which cannot be
 * translated; each tab now sets its `title` from here, in render, and the
 * floating bar draws and announces that (phase5-contract.md section 7,
 * 28/11/2026).
 *
 * Keyed by route name — an id, not display text — so a tab and its words cannot
 * be matched up wrongly. In English every label is the route name, exactly as
 * before.
 *
 * `NAVIGATION_COPY_EN` is the source; `navigationCopy.hi.ts` and `.gu.ts`
 * translate it.
 */

import { localized } from '@/core/i18n';
import { NAVIGATION_COPY_GU } from '@/navigation/navigationCopy.gu';
import { NAVIGATION_COPY_HI } from '@/navigation/navigationCopy.hi';

export const NAVIGATION_COPY_EN = Object.freeze({
  customerTabs: Object.freeze({
    Home: 'Home',
    Requests: 'Requests',
    Profile: 'Profile',
  }),
  vendorTabs: Object.freeze({
    Dashboard: 'Dashboard',
    Requests: 'Requests',
    Team: 'Team',
    Profile: 'Profile',
  }),
});

export const NAVIGATION_COPY = localized({
  en: NAVIGATION_COPY_EN,
  hi: NAVIGATION_COPY_HI,
  gu: NAVIGATION_COPY_GU,
});
