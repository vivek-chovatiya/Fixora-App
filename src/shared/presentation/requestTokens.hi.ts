/**
 * Request tokens — Hindi. Translates the `_EN` tables in `requestTokens.ts`; a
 * key left out reads in English. `{count}` stays as it is.
 */

import type { LocaleTable } from '@/core/i18n';
import type { PRIORITY_COPY_EN, RELATIVE_TIME_COPY_EN } from '@/shared/presentation/requestTokens';

export const RELATIVE_TIME_COPY_HI: LocaleTable<typeof RELATIVE_TIME_COPY_EN> = {
  justNow: 'अभी-अभी',
  minute: '{count} मिनट पहले',
  hour: '{count} घंटे पहले',
  day: '{count} दिन पहले',
  days: '{count} दिन पहले',
};

export const PRIORITY_COPY_HI: LocaleTable<typeof PRIORITY_COPY_EN> = {
  LOW: 'कम',
  MEDIUM: 'मध्यम',
  HIGH: 'ज़्यादा',
  EMERGENCY: 'इमरजेंसी',
};
