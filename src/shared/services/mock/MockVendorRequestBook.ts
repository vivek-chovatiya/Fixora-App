/**
 * MockVendorRequestBook — DEVELOPMENT ONLY
 *
 * What the backend would remember about what vendors did (PROJECT_BIBLE.md
 * sections 33 to 36): who accepted which request and which vendor rejected
 * which (Phase 3E-4), and how far each vendor's accepted work has got — started,
 * then completed (Phase 3E-5), with the amount and payment the vendor recorded
 * on completing it (sections 36 and 37). The fixtures in `mockVendorDashboardData` say
 * what each vendor was offered; this says what they did about it, and
 * `applyVendorAnswers` puts the two together into what a vendor sees now.
 *
 * ⚠️ One book, shared by the dashboard and the request list. Both mocks are
 * handed the same instance (`ServiceRegistry`), so a request accepted on one
 * screen is counted as active on the other — the two cannot disagree, because
 * there is only one record of what happened.
 *
 * ⚠️ Held in memory, for as long as the app runs. Signing out and in again keeps
 * it (so vendor B sees what vendor A did on the same device); restarting the
 * app clears it, and every request is waiting again. Not persisted, on purpose:
 * the fixtures are rebuilt from the clock on every read and are not records, so
 * storing answers to them would be a second, half-real database. The backend
 * holds this for real; WORKING_NOTES says so.
 *
 * ⚠️ Deterministic. Nothing is random and nothing happens by itself — no timer
 * accepts a request on another vendor's behalf. A request is only ever taken
 * because some vendor called accept.
 *
 * The assignment is per request, because that is what first-accept-wins means:
 * one request, one winner, whoever asks after them is told it is taken. A
 * rejection is per vendor: declining an open request takes it out of one
 * vendor's waiting list and leaves it in everybody else's. Work progress is per
 * vendor too — it is a vendor's own job that is started or finished, and
 * nothing one vendor does to their work can show up in another's.
 *
 * ⚠️ A rejection is kept with when it was made and in what order (owner
 * decision, 2026-10-21: vendors keep a history of what they declined), and
 * `rejectedByVendor` lists them. Nobody else's answer removes one: a request
 * this vendor declined that somebody else then accepted is still in this
 * vendor's history. `applyVendorAnswers` — what the dashboard counts — is not
 * touched by any of it.
 */

import type { MockVendorWork } from '@/shared/services/mock/mockVendorDashboardData';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import type { VendorCompletionRecord } from '@/shared/services/types/VendorRequestService';

/** How far a vendor's accepted job has got (Phase 3E-5). Nothing here means: as offered. */
export interface MockWorkProgress {
  status: 'IN_PROGRESS' | 'COMPLETED';
  /** ISO-8601, when it was marked completed. */
  completedAt?: string;
  /**
   * What the vendor recorded when they completed it — the amount and the
   * payment (sections 36 and 37). Kept with the completion it belongs to, so
   * the two can never be recorded apart.
   */
  completion?: VendorCompletionRecord;
  /** Recorded order, so the latest finished is listed first whatever the clock says. */
  sequence: number;
}

/** One request a vendor declined. */
export interface MockRejection {
  /** ISO-8601, when it was declined. */
  rejectedAt: string;
  /** Recorded order, so the latest declined is listed first whatever the clock says. */
  sequence: number;
}

export class MockVendorRequestBook {
  /** Request reference → the vendor who accepted it. */
  private readonly assignments = new Map<string, string>();
  /** Vendor id → request reference → when they rejected it. */
  private readonly rejections = new Map<string, Map<string, MockRejection>>();
  /** Vendor id → request reference → how far that job has got. */
  private readonly progress = new Map<string, Map<string, MockWorkProgress>>();
  private sequence = 0;

  /** Who accepted a request, if anybody has. */
  acceptedBy(requestId: string): string | undefined {
    return this.assignments.get(requestId);
  }

  hasRejected(vendorId: string, requestId: string): boolean {
    return this.rejections.get(vendorId)?.has(requestId) ?? false;
  }

  /** When this vendor declined a request, if they did. */
  rejectionOf(vendorId: string, requestId: string): MockRejection | undefined {
    return this.rejections.get(vendorId)?.get(requestId);
  }

  /**
   * Records an acceptance. The caller has already checked that nobody holds the
   * request; refusing a second holder here as well keeps the book itself from
   * ever recording two winners.
   */
  recordAcceptance(vendorId: string, requestId: string): void {
    const holder = this.assignments.get(requestId);
    if (holder !== undefined && holder !== vendorId) {
      throw new Error('Mock vendor request book: already assigned');
    }
    this.assignments.set(requestId, vendorId);
  }

  /** The caller has checked the request is waiting for this vendor. */
  recordRejection(vendorId: string, requestId: string, rejectedAt: string): void {
    const rejected = this.rejections.get(vendorId) ?? new Map<string, MockRejection>();
    this.sequence += 1;
    rejected.set(requestId, { rejectedAt, sequence: this.sequence });
    this.rejections.set(vendorId, rejected);
  }

  /** How far one of this vendor's jobs has got, if it has moved since it was accepted. */
  progressOf(vendorId: string, requestId: string): MockWorkProgress | undefined {
    return this.progress.get(vendorId)?.get(requestId);
  }

  /** The caller has checked the job is accepted and not started. */
  recordStart(vendorId: string, requestId: string): void {
    this.setProgress(vendorId, requestId, { status: 'IN_PROGRESS' });
  }

  /** The caller has checked the job is in progress, and the completion is valid. */
  recordCompletion(
    vendorId: string,
    requestId: string,
    completedAt: string,
    completion?: VendorCompletionRecord,
  ): void {
    this.setProgress(vendorId, requestId, {
      status: 'COMPLETED',
      completedAt,
      // A copy: the caller's object is not the book's record.
      ...(completion ? { completion: { ...completion } } : {}),
    });
  }

  private setProgress(
    vendorId: string,
    requestId: string,
    step: Omit<MockWorkProgress, 'sequence'>,
  ): void {
    const jobs = this.progress.get(vendorId) ?? new Map<string, MockWorkProgress>();
    this.sequence += 1;
    jobs.set(requestId, { ...step, sequence: this.sequence });
    this.progress.set(vendorId, jobs);
  }
}

/**
 * A waiting request once it has been answered: the new status, and no longer
 * routed — `dispatch` describes a request that is waiting, and answered work has
 * none (as the fixtures' own active work has none).
 */
function answered(job: VendorJobSummary, status: 'ACCEPTED' | 'REJECTED'): VendorJobSummary {
  const next: VendorJobSummary = { ...job, status };
  delete next.dispatch;
  return next;
}

export const asAccepted = (job: VendorJobSummary) => answered(job, 'ACCEPTED');

/** A declined request, dated when it was declined. */
export const asRejected = (job: VendorJobSummary, rejectedAt: string): VendorJobSummary => ({
  ...answered(job, 'REJECTED'),
  rejectedAt,
});

/** Accepted work once it has been started (Phase 3E-5). */
export const asStarted = (job: VendorJobSummary): VendorJobSummary => ({
  ...job,
  status: 'IN_PROGRESS',
});

/** Work once it has been marked completed, dated when it was. */
export const asCompleted = (job: VendorJobSummary, completedAt: string): VendorJobSummary => ({
  ...job,
  status: 'COMPLETED',
  completedAt,
});

/**
 * What one vendor sees, once everybody's answers are applied to what they were
 * offered.
 *
 * - accepted by this vendor → out of waiting, into active (after the work
 *   already under way, which is further along);
 * - accepted by somebody else → gone: it was never this vendor's job;
 * - rejected by this vendor → gone from every group here (the request list
 *   shows it under its own `rejected` group — `rejectedByVendor`);
 * - otherwise → still waiting, where it was.
 *
 * Then this vendor's progress on their active work (3E-5):
 *
 * - started → still active, `IN_PROGRESS`, and ahead of the work only accepted
 *   (the contract lists active work furthest along first; otherwise the order
 *   is kept);
 * - completed → out of active, first in completed (latest finished first),
 *   `COMPLETED` with its `completedAt`.
 *
 * Fresh arrays; the work handed in is not changed.
 */
export function applyVendorAnswers(
  vendorId: string,
  work: MockVendorWork,
  book: MockVendorRequestBook,
): MockVendorWork {
  const pending: VendorJobSummary[] = [];
  const accepted: VendorJobSummary[] = [];

  for (const job of work.pending) {
    const holder = book.acceptedBy(job.id);
    if (holder === vendorId) {
      accepted.push(asAccepted(job));
    } else if (holder === undefined && !book.hasRejected(vendorId, job.id)) {
      pending.push(job);
    }
  }

  const underWay: VendorJobSummary[] = [];
  const onlyAccepted: VendorJobSummary[] = [];
  const finished: Array<{ job: VendorJobSummary; sequence: number }> = [];

  for (const job of [...work.active, ...accepted]) {
    const step = book.progressOf(vendorId, job.id);
    if (step?.status === 'COMPLETED') {
      finished.push({ job: asCompleted(job, step.completedAt ?? job.createdAt), sequence: step.sequence });
    } else if (step?.status === 'IN_PROGRESS' || job.status === 'IN_PROGRESS') {
      underWay.push(step ? asStarted(job) : job);
    } else {
      onlyAccepted.push(job);
    }
  }

  return {
    pending,
    active: [...underWay, ...onlyAccepted],
    completed: [
      ...finished.sort((a, b) => b.sequence - a.sequence).map(entry => entry.job),
      ...work.completed,
    ],
  };
}

/**
 * What one vendor declined, most recently declined first, each `REJECTED` and
 * dated (section 31's Rejected tab; owner decision, 2026-10-21).
 *
 * ⚠️ Read from this vendor's own rejections, and nothing else: whether the
 * request was later accepted by somebody else, or declined by them too, does
 * not matter — it is this vendor's history of what they did. Only what they
 * were offered can be in it, so another vendor's request never is.
 *
 * Kept apart from `applyVendorAnswers` on purpose: that is what the dashboard
 * counts, and declined requests are not work. Fresh objects; the work handed in
 * is not changed.
 */
export function rejectedByVendor(
  vendorId: string,
  work: MockVendorWork,
  book: MockVendorRequestBook,
): VendorJobSummary[] {
  const declined: Array<{ job: VendorJobSummary; sequence: number }> = [];

  for (const job of work.pending) {
    const rejection = book.rejectionOf(vendorId, job.id);
    if (rejection) {
      declined.push({ job: asRejected(job, rejection.rejectedAt), sequence: rejection.sequence });
    }
  }

  return declined.sort((a, b) => b.sequence - a.sequence).map(entry => entry.job);
}
