/**
 * Phone numbers, made readable
 *
 * How a stored phone number is written to whoever is looking: "+91 98765 43210"
 * rather than "9876543210". Written on 21/10/2026, when the owner chose
 * formatted numbers over the digits as stored — the customer profile, the team
 * list and the vendor's view of a customer had each been printing the raw
 * digits, and a ten-digit run is hard to read back to someone on a call.
 *
 * ⚠️ Display only. What the app sends is still `normalisePhone`'s digits
 * (`shared/validation/phone`); nothing here is ever handed to a service, and a
 * formatted number must never be compared with a stored one.
 *
 * ⚠️ By table, keyed by the app's dialling code (`AppConfig.phone.dialCode`).
 * A number that does not fit the country's shape — too short, too long, a
 * landline with an area code — is written as it was stored, because a grouping
 * guessed for a number nobody described would be a claim the app cannot back.
 * Another country is multi-country (PROJECT_BIBLE.md section 76, Phase 2); this
 * table is the seam it widens, as `money.ts`'s currency table is.
 *
 * Pure. An empty or missing number writes nothing, so a screen can leave the
 * line out.
 */

import { AppConfig } from '@/core/config/AppConfig';

/** How a national number is written in one country. */
interface PhoneFormat {
  /** Digit groups, in order; together they are the national number's length. */
  groups: readonly number[];
}

/** The countries the app knows how to write a number for, by dialling code. */
const FORMATS: Readonly<Record<string, PhoneFormat>> = Object.freeze({
  // India's mobile numbers: ten digits, written 5 + 5.
  '+91': Object.freeze({ groups: Object.freeze([5, 5]) }),
});

function nationalLength(format: PhoneFormat): number {
  return format.groups.reduce((sum, size) => sum + size, 0);
}

/**
 * "9876543210" → "+91 98765 43210".
 *
 * Also accepts the number with its country code already in front
 * ("919876543210", "+91 98765-43210"), which a backend may store. Anything
 * else comes back as it was given, trimmed.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (typeof phone !== 'string') {
    return '';
  }
  const stored = phone.trim();
  const dialCode = AppConfig.phone.dialCode;
  const format = FORMATS[dialCode];
  if (stored === '' || !format) {
    return stored;
  }

  // Only digits, spaces, dashes, brackets and one leading plus are a number's
  // own; anything else means the value is not one, and it is left alone.
  if (!/^\+?[\d\s()-]+$/.test(stored)) {
    return stored;
  }
  const digits = stored.replace(/\D/g, '');
  const countryDigits = dialCode.replace(/\D/g, '');
  const length = nationalLength(format);

  let national: string | null = null;
  if (digits.length === length) {
    national = digits;
  } else if (digits.length === countryDigits.length + length && digits.startsWith(countryDigits)) {
    national = digits.slice(countryDigits.length);
  }
  if (national === null) {
    return stored;
  }

  const parts: string[] = [];
  let start = 0;
  for (const size of format.groups) {
    parts.push(national.slice(start, start + size));
    start += size;
  }
  return `${dialCode} ${parts.join(' ')}`;
}
