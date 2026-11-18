/**
 * What a connected service answers for something the backend cannot do yet
 *
 * Some operations on the app's interfaces have no endpoint behind them (Phase
 * 4A, 17/11/2026): recording a payment after the job, the payment methods, the
 * vendor's working hours, uploading a photo. An Api service never pretends to
 * do one — no fake success, no invented data, no silent drop — it refuses, and
 * this is the one refusal they all give.
 *
 * Kind `forbidden`, so it is not retryable: trying again would fail the same
 * way, and a Try again button would be a promise the app cannot keep. The copy
 * is `NOT_SUPPORTED`'s in `shared/types/error.ts`, never the developer detail.
 *
 * ⚠️ Every use is a backend gap, recorded in WORKING_NOTES' open items. When
 * the endpoint arrives the call is written and this goes — nothing above the
 * service has to change, because the screens already show a failure.
 */

import { AppError } from '@/shared/types/error';

/**
 * `what` names the operation for the developer; it never reaches a screen.
 *
 * `code` picks a more specific sentence when the screen's own words need one
 * (`EMAIL_REMOVAL_NOT_SUPPORTED`: "Removing your email address is not available…");
 * every such code has an entry beside `NOT_SUPPORTED` in `shared/types/error.ts`.
 */
export function notSupported(what: string, code = 'NOT_SUPPORTED'): AppError {
  return new AppError({
    kind: 'forbidden',
    code,
    message: `Not supported by the backend yet: ${what}`,
  });
}
