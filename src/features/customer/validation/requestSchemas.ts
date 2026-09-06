/**
 * Request form schemas
 *
 * The customer module owns its validation (CLAUDE.md section 16).
 *
 * ⚠️ Shape only, and only where the form itself is the authority. Whether a
 * vendor can be had on Thursday, whether a note is long enough to be useful,
 * whether a priority is honoured — none of that is decided here. The backend
 * owns it, and a client rule that guessed at it would reject requests the
 * backend would have accepted.
 *
 * The optional fields are optional in the schema too. PROJECT_BIBLE.md section
 * 14 marks preferred date and time as available only if the backend supports
 * them and section 17 marks notes optional, so requiring either would be the app
 * inventing an obligation the product does not have.
 */

import { z } from 'zod';

import { SELECTABLE_PRIORITIES } from '@/features/customer/constants/requestPresentation';
import { NO_PREFERENCE } from '@/features/customer/constants/requestScheduling';

/**
 * Ceiling on the notes field, in characters.
 *
 * Here rather than in AppConfig for the reason the auth schemas give: it bounds
 * one field on one form. It stops a pasted document, nothing more — the backend
 * enforces its own column limit and remains the authority.
 */
export const REQUEST_NOTES_MAX_LENGTH = 500;

/** `YYYY-MM-DD`, as `CreateRequestInput` defines it. */
const DATE_VALUE = /^\d{4}-\d{2}-\d{2}$/;
/** 24-hour `HH:mm`, as `CreateRequestInput` defines it. */
const TIME_VALUE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createRequestSchema = z.object({
  /**
   * Required, and with no default.
   *
   * Nothing is preselected on purpose. The distance between "low" and
   * "emergency" is the difference between next week and tonight, and a default
   * is an answer given on the customer's behalf to the one question on this
   * screen where being wrong costs them something.
   */
  priority: z
    .string()
    .refine(value => SELECTABLE_PRIORITIES.includes(value), 'Choose how urgent this is.'),

  preferredDate: z
    .string()
    .refine(
      value => value === NO_PREFERENCE || DATE_VALUE.test(value),
      'Choose a date from the list.',
    ),

  preferredTime: z
    .string()
    .refine(
      value => value === NO_PREFERENCE || TIME_VALUE.test(value),
      'Choose a time from the list.',
    ),

  /**
   * Bounded, never altered.
   *
   * Not trimmed: the notes are the customer's own account of their problem, and
   * a schema that quietly edits it is a schema deciding what they meant.
   * Whitespace at either end is the backend's to ignore.
   */
  notes: z
    .string()
    .max(
      REQUEST_NOTES_MAX_LENGTH,
      `Please keep this to ${REQUEST_NOTES_MAX_LENGTH} characters or fewer.`,
    ),
});

export type CreateRequestForm = z.infer<typeof createRequestSchema>;
