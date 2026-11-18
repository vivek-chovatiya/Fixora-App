/**
 * The one table between the backend's request constants and the app's
 * (`shared/services/api/requestTokens.ts`). Pinned here: every status the
 * backend's model allows has an answer the vendor's screens recognise, an
 * unknown value passes through untouched (section 21: never invent a status),
 * and the priorities read the same both ways.
 */

import {
  holdsWork,
  isAwaitingAnswer,
  isFinishedWork,
  nextWorkStep,
} from '@/features/vendor/constants/jobPresentation';
import {
  toAppPriority,
  toAppRequestStatus,
  toBackendPriority,
} from '@/shared/services/api/requestTokens';
import type { KnownRequestStatus } from '@/shared/services/types/RequestService';

/** `Fixora-Backend/src/models/servicerequest.js` status enum, 17/11/2026. */
const BACKEND_STATUSES = ['PENDING', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'];

/** `KnownRequestStatus` (`shared/services/types/RequestService.ts`). */
const KNOWN_APP_STATUSES: readonly KnownRequestStatus[] = [
  'CREATED',
  'PENDING_VENDOR',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
  'ON_HOLD',
];

describe('request status, backend → app', () => {
  it.each([
    ['PENDING', 'PENDING_VENDOR'],
    ['ACCEPTED', 'ACCEPTED'],
    ['ASSIGNED', 'ACCEPTED'],
    ['IN_PROGRESS', 'IN_PROGRESS'],
    ['COMPLETED', 'COMPLETED'],
    ['CANCELLED', 'CANCELLED'],
    ['REJECTED', 'REJECTED'],
  ])('reads %s as %s', (backend, app) => {
    expect(toAppRequestStatus(backend)).toBe(app);
  });

  it('answers every status the backend’s model allows with one section 21 names', () => {
    for (const status of BACKEND_STATUSES) {
      expect(KNOWN_APP_STATUSES).toContain(toAppRequestStatus(status));
    }
  });

  it('passes a status it does not know through exactly as sent', () => {
    expect(toAppRequestStatus('ON_HOLD')).toBe('ON_HOLD');
    expect(toAppRequestStatus('pending')).toBe('pending');
    // Never read from the prototype.
    expect(toAppRequestStatus('constructor')).toBe('constructor');
  });

  it('gives the vendor’s screens what they act on: waiting answers, held work starts or completes', () => {
    const job = (backend: string) => ({ status: toAppRequestStatus(backend) });

    expect(isAwaitingAnswer(job('PENDING'))).toBe(true);
    expect(nextWorkStep(job('ACCEPTED'))).toBe('start');
    expect(nextWorkStep(job('ASSIGNED'))).toBe('start');
    expect(nextWorkStep(job('IN_PROGRESS'))).toBe('complete');
    expect(isFinishedWork(job('COMPLETED'))).toBe(true);
    for (const unheld of ['PENDING', 'REJECTED', 'CANCELLED', 'ON_HOLD']) {
      expect(holdsWork(job(unheld))).toBe(false);
    }
  });
});

describe('priority, both ways', () => {
  it.each([
    ['LOW', 'LOW'],
    ['MEDIUM', 'MEDIUM'],
    ['HIGH', 'HIGH'],
    ['URGENT', 'EMERGENCY'],
  ])('reads %s as %s, and sends it back as it came', (backend, app) => {
    expect(toAppPriority(backend)).toBe(app);
    expect(toBackendPriority(app)).toBe(backend);
  });

  it('passes a priority it does not know through, either way', () => {
    expect(toAppPriority('CRITICAL')).toBe('CRITICAL');
    expect(toBackendPriority('CRITICAL')).toBe('CRITICAL');
  });
});
