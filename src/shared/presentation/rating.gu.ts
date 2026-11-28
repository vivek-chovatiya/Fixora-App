/**
 * Rating words — Gujarati. Translates `RATING_COPY_EN` in `rating.ts`; a key
 * left out reads in English. `{count}` and `{max}` stay as they are.
 */

import type { LocaleTable } from '@/core/i18n';
import type { RATING_COPY_EN } from '@/shared/presentation/rating';

export const RATING_COPY_GU: LocaleTable<typeof RATING_COPY_EN> = {
  label: 'રેટિંગ',
  value: '{max} માંથી {count} સ્ટાર',
  none: 'હજી કોઈ રેટિંગ પસંદ કર્યું નથી',
  hint: 'તમારું રેટિંગ પસંદ કરે છે',
};
