/**
 * Email validation
 *
 * One definition, shared by every form that collects an address.
 *
 * Deliberately permissive. An address is proven by sending mail to it, not by a
 * regular expression, and an over-strict pattern rejects valid addresses — which
 * is a worse failure than accepting one the backend will bounce.
 */

import { z } from 'zod';

/** Lowercased so the same address entered two ways reaches the backend once. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address.');

/**
 * An optional address: blank is allowed, but anything typed must be valid.
 *
 * Deliberately resolves to `''` rather than transforming empty to `undefined`.
 * A transform would make the schema's input and output types differ, and
 * react-hook-form types a form by a single shape — so the empty-means-absent
 * conversion belongs in the submit handler, next to the other normalisation.
 */
export const optionalEmailSchema = z.union([z.literal(''), emailSchema]);
