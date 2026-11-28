/**
 * Payment words — Gujarati. Translates `PAYMENT_COPY_EN` in `payment.ts`; a key
 * left out reads in English.
 *
 * ⚠️ Recorded, never processed (PROJECT_BIBLE.md section 37): "ચુકવણી થઈ ગઈ"
 * says the professional recorded it, nothing more. The separator is not
 * translated.
 */

import type { LocaleTable } from '@/core/i18n';
import type { PAYMENT_COPY_EN } from '@/shared/presentation/payment';

export const PAYMENT_COPY_GU: LocaleTable<typeof PAYMENT_COPY_EN> = {
  paid: 'ચુકવણી થઈ ગઈ',
  unpaid: 'હજી ચુકવણી થઈ નથી',
  unavailable: 'ચુકવણીની સ્થિતિ ઉપલબ્ધ નથી',
};
