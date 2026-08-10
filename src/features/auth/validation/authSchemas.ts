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
import { phoneSchema } from '@/shared/validation/phone';

/** Customer sign in, step one: the number a one-time code is sent to. */
export const customerPhoneSchema = z.object({
  phone: phoneSchema,
});

export type CustomerPhoneForm = z.infer<typeof customerPhoneSchema>;

/**
 * Customer sign in, step two: the code they received.
 *
 * Kept here rather than in shared validation because a one-time code is not a
 * general field — it belongs to this flow, and the vendor flows have their own
 * rules. It checks shape only: whether the code is the right one is never the
 * app's decision.
 */
export const customerOtpSchema = z.object({
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

export type CustomerOtpForm = z.infer<typeof customerOtpSchema>;
