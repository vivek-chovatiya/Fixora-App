/**
 * Phone validation
 *
 * One definition of what counts as a phone number, and one definition of how it
 * is normalised before it leaves the app.
 *
 * Both live here rather than in a screen or a service because customer sign in,
 * vendor registration and vendor sign in all take a phone number, and three
 * copies of this rule would drift the moment one of them changed.
 *
 * The limits come from AppConfig — a digit count is a limit, and CLAUDE.md
 * section 11 keeps limits out of feature code.
 *
 * ⚠️ This validates shape, nothing more. Whether a number exists, is reachable,
 * or already belongs to an account is the backend's answer to give
 * (PROJECT_BIBLE.md section 7A.4).
 */

import { z } from 'zod';

import { AppConfig } from '@/core/config/AppConfig';

/**
 * Reduces a typed number to digits, so '+91 98765-43210' and '9876543210' are
 * treated as the same input.
 *
 * Always call this before handing a number to a service. What the user typed is
 * a display concern; what the backend receives should be canonical.
 */
export function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Characters a person may reasonably type into a phone field. */
const ALLOWED_CHARACTERS = /^[\d\s+()-]+$/;

/**
 * The phone field, for any form that collects one.
 *
 * Validates the raw string rather than a normalised one so the message lands on
 * what the user can actually see and correct.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Enter your phone number.')
  .refine(value => ALLOWED_CHARACTERS.test(value), 'Enter a phone number using digits only.')
  .refine(
    value => normalisePhone(value).length >= AppConfig.phone.minDigits,
    'That number looks too short. Please check it.',
  )
  .refine(
    value => normalisePhone(value).length <= AppConfig.phone.maxDigits,
    'That number looks too long. Please check it.',
  );
