/**
 * Authentication form schemas
 *
 * The auth module owns its validation (CLAUDE.md section 16). Field-level rules
 * that other modules also need — phone shape, for one — are composed from
 * `@/shared/validation` rather than restated here.
 *
 * Schemas describe form input only. They never decide whether an account exists
 * or whether a code is correct; that is the backend's to answer
 * (PROJECT_BIBLE.md section 7A.4).
 */

import { z } from 'zod';

import { AppConfig } from '@/core/config/AppConfig';
import { optionalEmailSchema } from '@/shared/validation/email';
import { VENDOR_BUSINESS_NAME_MAX_LENGTH } from '@/shared/services/types/VendorProfileService';
import { phoneSchema } from '@/shared/validation/phone';

/**
 * Length ceilings for vendor registration text.
 *
 * These live here rather than in AppConfig because each is used by exactly one
 * field in one form. Limits that cross features — phone digits, code length —
 * belong in AppConfig; these would only add noise to it.
 *
 * They stop absurd input, nothing more. The backend enforces its own column
 * limits and remains the authority.
 */
export const VENDOR_NAME_MAX_LENGTH = 60;
/*
 * The business name's ceiling is the vendor profile's, so a name accepted at
 * registration is never refused by setup (Phase 3E-1).
 */
export { VENDOR_BUSINESS_NAME_MAX_LENGTH };

/**
 * What a person may put between the digits of a vendor auth code: any space
 * (the no-break space the code is displayed with included — `\s` covers it) and
 * any hyphen or dash, including the typographic ones a notes app substitutes.
 *
 * And the characters nobody can see, which arrive with a paste: zero-width
 * spaces and joiners and the direction marks (U+200B–U+200F), the direction
 * embeddings and overrides (U+202A–U+202E), the word joiner and the invisible
 * operators and isolates (U+2060–U+2069), and the byte-order mark (U+FEFF,
 * which `\s` already covers — listed so the set reads whole). A messaging app
 * wraps a number in direction isolates, and a code that looks like "482913"
 * would otherwise be refused as not numbers only, with nothing on screen to fix.
 *
 * ⚠️ Escapes, never the characters themselves: in this file they would be as
 * invisible to the next reader as they are to the vendor.
 */
const VENDOR_AUTH_CODE_SEPARATORS =
  /[\s\-‐-―−\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

/**
 * The vendor auth code as the backend receives it: the digits, nothing between.
 *
 * "482 913", "482-913" and " 482913 " are all the same code read off a screen,
 * copied from a message or written down in groups. Removing separators is not
 * correcting the entry — a letter or a seventh digit is left exactly where it is
 * for the schema to refuse.
 *
 * ⚠️ Always a string. A leading zero is part of the code, and a number type
 * would drop it.
 */
export function normaliseVendorAuthCode(raw: string): string {
  return raw.replace(VENDOR_AUTH_CODE_SEPARATORS, '');
}

/**
 * Ceiling on what the auth code field accepts, in characters.
 *
 * Twice the code's length rather than the length itself: the field must take a
 * pasted grouped code — "4 8 2 9 1 3" is eleven characters — and refuse a wrong
 * one with a reason, rather than have `maxLength` silently cut it to something
 * that looks complete. Short enough that a pasted paragraph is stopped.
 */
export const VENDOR_AUTH_CODE_INPUT_MAX_LENGTH = AppConfig.vendorAuthCode.length * 2;

/** Customer sign in, step one: the number a one-time code is sent to. */
export const customerPhoneSchema = z.object({
  phone: phoneSchema,
});

export type CustomerPhoneForm = z.infer<typeof customerPhoneSchema>;

/**
 * The one-time code, for every flow that verifies a phone number.
 *
 * Kept in the auth feature rather than shared validation because a one-time code
 * is not a general-purpose field — it belongs to authentication. Customer sign
 * in and vendor onboarding send it to different services with different results,
 * but the code itself has one shape.
 *
 * It checks shape only: whether the code is the right one is never the app's
 * decision (PROJECT_BIBLE.md section 7A.4).
 */
export const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter the code we sent you.')
    .refine(value => /^\d+$/.test(value), 'The code is digits only.')
    .refine(
      value => value.length === AppConfig.otp.length,
      `Enter all ${AppConfig.otp.length} digits.`,
    ),
});

export type OtpForm = z.infer<typeof otpSchema>;

/** A required name-like field, trimmed and bounded. */
function requiredName(label: string, maxLength: number) {
  return z
    .string()
    .trim()
    .min(1, `Enter the ${label}.`)
    .max(maxLength, `The ${label} must be ${maxLength} characters or fewer.`);
}

/**
 * Vendor registration.
 *
 * The fields are exactly those of `VendorRegistrationDetails` — the service
 * contract is the authority, and collecting anything it cannot carry would
 * produce data with nowhere to go.
 *
 * Email is optional because the contract marks it optional. Categories are
 * identifiers only: a name here would hardcode a service into the app
 * (PROJECT_BIBLE.md section 11).
 */
export const vendorRegistrationSchema = z.object({
  businessName: requiredName('business name', VENDOR_BUSINESS_NAME_MAX_LENGTH),
  ownerFirstName: requiredName('first name', VENDOR_NAME_MAX_LENGTH),
  ownerLastName: requiredName('last name', VENDOR_NAME_MAX_LENGTH),
  phone: phoneSchema,
  email: optionalEmailSchema,
  serviceCategoryIds: z.array(z.string()).min(1, 'Select at least one service you offer.'),
});

export type VendorRegistrationForm = z.infer<typeof vendorRegistrationSchema>;

/**
 * The vendor's permanent auth code, as typed or pasted by a person.
 *
 * Exactly `AppConfig.vendorAuthCode.length` digits once separators are removed
 * (owner's decision, 21/10/2026 — the code used to be opaque, and this rule used
 * to check completeness only). Each check reads the normalised value, so
 * "482 913" passes and the message for "48291a" is about the letter, not about
 * a space the person never typed.
 *
 * The checks run in order and the field shows the first that fails: empty, then
 * not digits, then the wrong count — so "abc" is told about letters rather than
 * about length. The value itself is not rewritten here; callers send
 * `normaliseVendorAuthCode(value)`, as phone fields send `normalisePhone`.
 *
 * Shape only. Whether a code is the right one is never the app's decision
 * (PROJECT_BIBLE.md section 7A.4).
 */
const vendorAuthCodeField = z
  .string()
  .refine(
    value => normaliseVendorAuthCode(value).length > 0,
    'Enter your authentication code.',
  )
  .refine(
    value => /^\d*$/.test(normaliseVendorAuthCode(value)),
    'Your authentication code is numbers only.',
  )
  .refine(
    value => normaliseVendorAuthCode(value).length === AppConfig.vendorAuthCode.length,
    `Your authentication code is ${AppConfig.vendorAuthCode.length} digits.`,
  );

/** Confirmation, during onboarding, that the vendor saved the code they were shown. */
export const vendorAuthCodeSchema = z.object({
  authCode: vendorAuthCodeField,
});

export type VendorAuthCodeForm = z.infer<typeof vendorAuthCodeSchema>;

/**
 * A returning vendor signing in.
 *
 * Both fields are composed rather than restated: the phone rule is the shared
 * one every flow uses, and the code rule is the same one onboarding confirms
 * against.
 */
export const vendorLoginSchema = z.object({
  phone: phoneSchema,
  authCode: vendorAuthCodeField,
});

export type VendorLoginForm = z.infer<typeof vendorLoginSchema>;
