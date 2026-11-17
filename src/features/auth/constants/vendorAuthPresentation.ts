/**
 * Vendor auth presentation
 *
 * How the vendor auth code and a remembered phone number are drawn and spoken.
 * Display only: nothing here changes a value that is sent, stored or copied.
 *
 * ⚠️ Grouping is for the eye. The code is copied, confirmed and sent as its bare
 * digits; the space shown between the groups is a no-break space, so the code
 * never wraps across two lines and a person who types what they see is still
 * accepted (`normaliseVendorAuthCode` removes it).
 *
 * ⚠️ Spoken forms spell digit by digit. TalkBack reads "482913" as a number —
 * "four hundred eighty-two thousand…" — which is useless for writing a code
 * down or recognising the end of a phone number. "4 8 2 9 1 3" is read one
 * digit at a time.
 */

/** Digits per group when the code is shown. */
const CODE_GROUP_SIZE = 3;

/** Holds the groups apart without letting a line break between them. */
const GROUP_SEPARATOR = ' ';

/** Digits of a phone number left visible when it is masked. */
const PHONE_VISIBLE_DIGITS = 4;

/** Stands in for each hidden digit — the glyph the backend masks numbers with. */
const PHONE_MASK = '•';

/**
 * "482913" → "482 913".
 *
 * Anything that is not all digits is returned untouched: the backend generates
 * the code, and a display that mangled an unexpected one would be worse than one
 * that showed it as issued.
 */
export function groupVendorAuthCode(code: string): string {
  if (!/^\d+$/.test(code)) {
    return code;
  }

  const groups: string[] = [];
  for (let start = 0; start < code.length; start += CODE_GROUP_SIZE) {
    groups.push(code.slice(start, start + CODE_GROUP_SIZE));
  }
  return groups.join(GROUP_SEPARATOR);
}

/** "482913" → "4 8 2 9 1 3", for an accessibility label. */
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
