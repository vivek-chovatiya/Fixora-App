/**
 * The backend's request constants, as the app's contract values
 *
 * One table for a request's status and one for its priority, for every Api
 * service that reads a request — the vendor's list, details and dashboard
 * today, the customer's requests when they go live. A request is one request
 * whoever opens it, and two tables would be two answers to "what does PENDING
 * mean" that could drift (the argument `shared/presentation/requestTokens.ts`
 * makes for the labels).
 *
 * Decisions (17/11/2026, against `Fixora-Backend/src/models/servicerequest.js`):
 * - `PENDING` is the app's `PENDING_VENDOR`: the backend has one waiting
 *   status, whether the request was directed at a vendor or broadcast to all
 *   (routing is `vendorId`, never the status — PROJECT_BIBLE.md section 21).
 * - `ASSIGNED` is the app's `ACCEPTED`. The backend writes it when a vendor
 *   names a technician for accepted work (`/requests/assign`, the web views'
 *   team assignment). The phone app has no assignment step in Phase 1 (section
 *   40), so to it this is accepted work that has not started — and starting it
 *   is the next step, exactly as for `ACCEPTED`.
 * - Everything else the backend names has the same name here.
 * - A value not in the table passes through as the plain string it was
 *   (section 21: the frontend never invents a status). The presentation tables
 *   show an unknown one safely, and the vendor's screens treat it as neither
 *   waiting, nor held, nor finished.
 *
 * ⚠️ Read in one direction for statuses. The app never sends a request status
 * — every change is an action endpoint — so there is deliberately no reverse
 * table to drift from this one.
 *
 * ⚠️ Priorities go both ways: the customer sends one, both sides read it back.
 * The backend's `URGENT` is section 15's `EMERGENCY` — the one the vendor's
 * cards must make visually distinguishable (section 31) — and the other three
 * share their names. An unknown one passes through, as a status does.
 */

import type { KnownRequestStatus, RequestStatus } from '@/shared/services/types/RequestService';

/** Backend status → the app's (section 21). */
const STATUS_FROM_BACKEND: Readonly<Record<string, KnownRequestStatus>> = Object.freeze({
  PENDING: 'PENDING_VENDOR',
  ACCEPTED: 'ACCEPTED',
  ASSIGNED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
});

/** Backend priority → the app's (section 15). */
const PRIORITY_FROM_BACKEND: Readonly<Record<string, string>> = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'EMERGENCY',
});

/** The app's priority → the backend's: the same table, read the other way. */
const PRIORITY_TO_BACKEND: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(Object.entries(PRIORITY_FROM_BACKEND).map(([backend, app]) => [app, backend])),
);

function lookup(table: Readonly<Record<string, string>>, value: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(table, value) ? table[value] : undefined;
}

/** A backend request status as the app's; an unknown one exactly as it was sent. */
export function toAppRequestStatus(backend: string): RequestStatus {
  return lookup(STATUS_FROM_BACKEND, backend) ?? backend;
}

/** A backend priority as the app's; an unknown one exactly as it was sent. */
export function toAppPriority(backend: string): string {
  return lookup(PRIORITY_FROM_BACKEND, backend) ?? backend;
}

/** The app's priority as the backend's; an unknown one exactly as it was given. */
export function toBackendPriority(app: string): string {
  return lookup(PRIORITY_TO_BACKEND, app) ?? app;
}
