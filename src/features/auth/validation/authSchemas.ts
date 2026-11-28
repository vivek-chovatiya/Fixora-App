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
 *
 * The messages are in English, Hindi and Gujarati since Phase 5 (28/11/2026):
 * `AUTH_VALIDATION_COPY_EN` below is the source, `authSchemas.hi.ts` and
 * `.gu.ts` translate it. Each schema reads its message through a function
 * (`{ error: () => … }`), because the schemas are built once, when this module
 * loads, and a string read then would stay in that moment's language.
 */

import { z } from 'zod';

import { AppConfig } from '@/core/config/AppConfig';
import { localized } from '@/core/i18n';
import { AUTH_VALIDATION_COPY_GU } from '@/features/auth/validation/authSchemas.gu';
import { AUTH_VALIDATION_COPY_HI } from '@/features/auth/validation/authSchemas.hi';
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
 * What the auth forms refuse with. `{count}` is a digit count or a length limit.
 * One sentence per field rather than a template around a field name, so a
 * translation never has to fit "the business name" into someone else's grammar.
 */
export const AUTH_VALIDATION_COPY_EN = Object.freeze({
  codeRequired: 'Enter the code we sent you.',
  codeDigitsOnly: 'The code is digits only.',
  codeLength: 'Enter all {count} digits.',
  businessNameRequired: 'Enter the business name.',
  businessNameTooLong: 'The business name must be {count} characters or fewer.',
  firstNameRequired: 'Enter the first name.',
  firstNameTooLong: 'The first name must be {count} characters or fewer.',
  lastNameRequired: 'Enter the last name.',
  lastNameTooLong: 'The last name must be {count} characters or fewer.',
  servicesRequired: 'Select at least one service you offer.',
});

const MESSAGES = localized({
  en: AUTH_VALIDATION_COPY_EN,
  hi: AUTH_VALIDATION_COPY_HI,
  gu: AUTH_VALIDATION_COPY_GU,
});

type MessageKey = keyof typeof AUTH_VALIDATION_COPY_EN;

/** A zod message read when the field is checked, never when this module loads. */
function message(key: MessageKey, count?: number) {
  return { error: () => MESSAGES[key].replace('{count}', String(count ?? '')) };
}

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
 * in, vendor sign in and vendor registration send it to different services, but
 * the code itself has one shape.
 *
 * It checks shape only: whether the code is the right one is never the app's
 * decision (PROJECT_BIBLE.md section 7A.4).
 */
export const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, message('codeRequired'))
    .refine(value => /^\d+$/.test(value), message('codeDigitsOnly'))
    .refine(
      value => value.length === AppConfig.otp.length,
      message('codeLength', AppConfig.otp.length),
    ),
});

export type OtpForm = z.infer<typeof otpSchema>;

/** A required name-like field, trimmed and bounded, refusing with its own two sentences. */
function requiredName(required: MessageKey, tooLong: MessageKey, maxLength: number) {
  return z
    .string()
    .trim()
    .min(1, message(required))
    .max(maxLength, message(tooLong, maxLength));
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
  businessName: requiredName(
    'businessNameRequired',
    'businessNameTooLong',
    VENDOR_BUSINESS_NAME_MAX_LENGTH,
  ),
  ownerFirstName: requiredName('firstNameRequired', 'firstNameTooLong', VENDOR_NAME_MAX_LENGTH),
  ownerLastName: requiredName('lastNameRequired', 'lastNameTooLong', VENDOR_NAME_MAX_LENGTH),
  phone: phoneSchema,
  email: optionalEmailSchema,
  serviceCategoryIds: z.array(z.string()).min(1, message('servicesRequired')),
});

export type VendorRegistrationForm = z.infer<typeof vendorRegistrationSchema>;

/**
 * A returning vendor signing in: the number a one-time code is sent to
 * (phase5-contract.md section 1.1, 28/11/2026).
 *
 * The same rule customer sign in uses, kept as its own schema because the two
 * forms belong to different flows and may grow apart; there is no code field
 * any more — the code is entered on the screen after, through `otpSchema`.
 */
export const vendorLoginSchema = z.object({
  phone: phoneSchema,
});

export type VendorLoginForm = z.infer<typeof vendorLoginSchema>;
