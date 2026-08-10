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

import { phoneSchema } from '@/shared/validation/phone';

/** Customer sign in, step one: the number a one-time code is sent to. */
export const customerPhoneSchema = z.object({
  phone: phoneSchema,
});

export type CustomerPhoneForm = z.infer<typeof customerPhoneSchema>;
