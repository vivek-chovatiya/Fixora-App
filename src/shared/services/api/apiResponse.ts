/**
 * Reading a backend response into the app's own types
 *
 * Every Api service turns the backend's JSON into an app type field by field,
 * through these readers, rather than casting it. A cast would let whatever the
 * backend sends — `_id`, a field the app has never heard of, a number where a
 * string was promised — walk past the service and into a screen; a reader
 * either finds what the contract promised or refuses the response.
 *
 * A refusal is a `server` AppError (retryable, with the app's own copy). The
 * contract is the two sides' agreement, so a response that breaks it is the
 * server's fault to report, not data for the screen to make sense of.
 *
 * ⚠️ A refusal names the field and never the value. Some of these values are
 * credentials — the session token, for one — and an error is
 * logged, reported to the crash reporter and passed around the UI.
 */

import { createLogger } from '@/core/logger/Logger';
import { AppError } from '@/shared/types/error';

const log = createLogger('apiResponse');

/** The refusals made here, so a list can tell a broken row from any other failure. */
const malformedErrors = new WeakSet<AppError>();

/** A response that does not match its contract. `what` is a field path, never a value. */
export function malformedResponse(what: string): AppError {
  const error = new AppError({ kind: 'server', message: `Unexpected response: ${what}` });
  malformedErrors.add(error);
  return error;
}

/** Whether `error` is a row or response refused by these readers. */
export function isMalformedResponse(error: unknown): boolean {
  return error instanceof AppError && malformedErrors.has(error);
}

/**
 * Each row of a list read with `read`, leaving out the rows that break the
 * contract (code review, 17/11/2026).
 *
 * One bad row must not cost the whole list: a request whose service was
 * deleted, a record half-written by an old seed — the rest are still the
 * person's, and a list that fails on one shows them none. Logged once per list,
 * by count and by what kind of row, never by id or value. Any other failure
 * still rejects.
 */
export function readRows<T>(rows: readonly unknown[], read: (row: unknown) => T, what: string): T[] {
  const items: T[] = [];
  let skipped = 0;

  for (const row of rows) {
    try {
      items.push(read(row));
    } catch (error) {
      if (!isMalformedResponse(error)) {
        throw error;
      }
      skipped += 1;
    }
  }

  if (skipped > 0) {
    log.warn('Rows that break the contract were left out', { what, skipped });
  }
  return items;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The object at `what`, or a refusal. */
export function requireRecord(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw malformedResponse(what);
  }
  return value;
}

/** A string with something in it, or a refusal. */
export function requireString(record: Record<string, unknown>, key: string, what: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw malformedResponse(`${what}.${key}`);
  }
  return value;
}

/**
 * A string with something in it, or undefined.
 *
 * Blank and null read as absent, because the backend writes "not set" both
 * ways (`icon: null`, `description: ''`) and the app's types say it with an
 * absent key — never an empty string a screen would have to test for.
 */
export function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** A finite number, or a refusal. */
export function requireNumber(record: Record<string, unknown>, key: string, what: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw malformedResponse(`${what}.${key}`);
  }
  return value;
}

/**
 * The id of a record the backend refers to, whichever way it sent it.
 *
 * The backend's mappers pass a reference through as Mongoose leaves it: a bare
 * id string when the field was not populated, the whole referenced document
 * when it was (`/requests/list` and `/requests/detail` populate `vendorId`,
 * `customerId`, `categoryId` and `subCategoryId`). Either way only the id is
 * read here, as a string — `_id` is the populated document's own key, and this
 * is the one place it is read, so it never travels further.
 *
 * Undefined for `null` (no such reference — an open request has no vendor) and
 * for anything else that is not an id.
 */
export function referenceId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() !== '' ? value : undefined;
  }
  if (isRecord(value)) {
    const id = value._id ?? value.id;
    return typeof id === 'string' && id.trim() !== '' ? id : undefined;
  }
  return undefined;
}

/**
 * The referenced document itself, when the backend populated it; undefined
 * for a bare id or `null`. Read field by field like any other record.
 */
export function populated(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}
