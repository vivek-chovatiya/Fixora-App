/**
 * Payment words — Hindi. Translates `PAYMENT_COPY_EN` in `payment.ts`; a key
 * left out reads in English.
 *
 * ⚠️ Recorded, never processed (PROJECT_BIBLE.md section 37): "भुगतान हो गया"
 * says the professional recorded it, nothing more — no word here may suggest
 * Fixora took or confirmed a payment. The separator is not translated.
 */

import type { LocaleTable } from '@/core/i18n';
import type { PAYMENT_COPY_EN } from '@/shared/presentation/payment';

export const PAYMENT_COPY_HI: LocaleTable<typeof PAYMENT_COPY_EN> = {
  paid: 'भुगतान हो गया',
  unpaid: 'अभी भुगतान नहीं हुआ',
  unavailable: 'भुगतान की स्थिति उपलब्ध नहीं',
};
