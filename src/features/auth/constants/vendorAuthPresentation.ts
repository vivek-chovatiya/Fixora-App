/**
 * Vendor auth presentation
 *
 * How a remembered vendor phone number is drawn and spoken on vendor sign in.
 * Display only: nothing here changes a value that is sent or stored.
 *
 * It used to draw the permanent vendor auth code as well; that code was retired
 * on 28/11/2026 (phase5-contract.md section 1) and its grouping went with it.
 *
 * ⚠️ Spoken forms spell digit by digit. TalkBack reads "0001" as a number —
 * "one" — which is useless for recognising the end of a phone number.
 * "0 0 0 1" is read one digit at a time.
 */

/** Digits of a phone number left visible when it is masked. */
const PHONE_VISIBLE_DIGITS = 4;

/** Stands in for each hidden digit — the glyph the backend masks numbers with. */
const PHONE_MASK = '•';

/** "0001" → "0 0 0 1", for an accessibility label. */
export function spellOut(value: string): string {
  return Array.from(value).join(' ');
}

/** The last digits of a phone number — what is shown of it, and what is spoken. */
export function phoneEnding(phone: string): string {
  return phone.slice(-PHONE_VISIBLE_DIGITS);
}

/**
 * "9000000001" → "••••••0001".
 *
 * The app's own masking, for a number it holds itself. A number the backend
 * reports — an OTP destination — arrives masked already and never passes
 * through here.
 */
export function maskPhone(phone: string): string {
  if (phone.length <= PHONE_VISIBLE_DIGITS) {
    return phone;
  }
  return `${PHONE_MASK.repeat(phone.length - PHONE_VISIBLE_DIGITS)}${phoneEnding(phone)}`;
}
