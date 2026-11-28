/**
 * Rating words — Hindi. Translates `RATING_COPY_EN` in `rating.ts`; a key left
 * out reads in English. `{count}` and `{max}` stay as they are.
 */

import type { LocaleTable } from '@/core/i18n';
import type { RATING_COPY_EN } from '@/shared/presentation/rating';

export const RATING_COPY_HI: LocaleTable<typeof RATING_COPY_EN> = {
  label: 'रेटिंग',
  value: '{max} में से {count} स्टार',
  none: 'अभी कोई रेटिंग नहीं चुनी गई',
  hint: 'आपकी रेटिंग चुनता है',
};
