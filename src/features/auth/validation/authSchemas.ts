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
export const VENDOR_BUSINESS_NAME_MAX_LENGTH = 80;

/**
 * Ceiling on the vendor auth code, in characters.
 *
 * Deliberately far above any code in use — issued codes are twelve characters —
 * because this is a bound on absurdity, not a description of the format. The
 * code is opaque by contract, so a tight limit would be the app inventing a
 * shape it was never promised and rejecting valid codes the day generation
 * changes. Wide enough to be wrong about nothing; narrow enough that a pasted
 * document is refused.
 */
export const VENDOR_AUTH_CODE_MAX_LENGTH = 64;

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
 * The vendor's permanent auth code, as typed by a person.
 *
 * Completeness only. `VendorAuthCode.code` is an opaque string in the contract —
 * the backend owns generation and format — so checking it looks like anything in
 * particular would encode a format the app was never promised, and would reject
 * a valid code the day generation changes. Whether a code is the right one is
 * never the app's decision.
 */
const vendorAuthCodeField = z
  .string()
  .trim()
  .min(1, 'Enter your authentication code.')
  .max(
    VENDOR_AUTH_CODE_MAX_LENGTH,
    // Says the entry is wrong, not that the code has a length. A message naming
    // the ceiling would teach a format the backend never promised.
    'That does not look like an authentication code. Please check it.',
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
