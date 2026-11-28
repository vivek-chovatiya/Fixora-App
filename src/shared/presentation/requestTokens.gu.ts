/**
 * Request tokens — Gujarati. Translates the `_EN` tables in `requestTokens.ts`;
 * a key left out reads in English. `{count}` stays as it is.
 */

import type { LocaleTable } from '@/core/i18n';
import type { PRIORITY_COPY_EN, RELATIVE_TIME_COPY_EN } from '@/shared/presentation/requestTokens';

export const RELATIVE_TIME_COPY_GU: LocaleTable<typeof RELATIVE_TIME_COPY_EN> = {
  justNow: 'હમણાં જ',
  minute: '{count} મિનિટ પહેલાં',
  hour: '{count} કલાક પહેલાં',
  day: '{count} દિવસ પહેલાં',
  days: '{count} દિવસ પહેલાં',
};

export const PRIORITY_COPY_GU: LocaleTable<typeof PRIORITY_COPY_EN> = {
  LOW: 'ઓછી',
  MEDIUM: 'મધ્યમ',
  HIGH: 'વધુ',
  EMERGENCY: 'ઇમરજન્સી',
};
