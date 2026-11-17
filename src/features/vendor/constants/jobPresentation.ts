/**
 * Job presentation
 *
 * What a backend status says on a vendor's card (PROJECT_BIBLE.md sections 21
 * and 31).
 *
 * ⚠️ The vendor's words, not the customer's. One backend status reads
 * differently from each side: `PENDING_VENDOR` is "Awaiting professional" to
 * the customer who is waiting and a new request to the vendor it is waiting
 * for. So this is a second table over the same vocabulary, not a copy of the
 * customer's — while priorities and ages, which read the same to everybody,
 * come from the shared `requestTokens`.
 *
 * ⚠️ It maps, it never decides. Which group a job belongs to is the service's
 * answer (`VendorDashboard`, `VendorRequestList`); this only chooses the label.
 *
 * ⚠️ What may be done to a request is read from its status here too
 * (`isAwaitingAnswer`, Phase 3E-4; `nextWorkStep`, Phase 3E-5), so a button can
 * never be offered for a status this table would word differently (section 33:
 * "never show actions that are invalid for the current status") — and so is
 * what may be shown of the customer (`holdsWork`, 21/10/2026).
 *
 * ⚠️ A status the app has never seen reads "Status unavailable" (Phase 3E-3).
 * It used to be shown tidied — `AWAITING_PARTS` as "Awaiting parts" — and that
 * put a backend constant nobody had worded in front of a vendor as though it
 * were a Fixora status. Section 21 forbids inventing one; saying the app cannot
 * show it is the only answer that invents nothing, and it is what the
 * customer's side already says. The raw value stays on the record for whoever
 * is debugging; it is never drawn.
 */

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { TokenPresentation } from '@/shared/presentation/requestTokens';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';

const COPY = VENDOR_COPY.job;

/**
 * Tone carries emphasis, not identity — the label always says which state it
 * is, and each has a glyph so it survives greyscale. They match the tones the
 * customer sees for the same moments: info while waiting or assigned, warning
 * while work is under way, success only once it is done.
 */
export function presentJobStatus(job: Pick<VendorJobSummary, 'status' | 'dispatch'>): TokenPresentation {
  const status = typeof job.status === 'string' ? job.status.trim().toUpperCase() : '';

  switch (status) {
    // Section 21: dispatch is routing, not status. Both waits are this status.
    case 'CREATED':
    case 'PENDING_VENDOR':
      if (job.dispatch === 'directed') {
        // The stronger lead (section 31.1), so the one that is emphasised.
        return { label: COPY.statusDirected, tone: 'info', icon: 'verified' };
      }
      return job.dispatch === 'broadcast'
        ? { label: COPY.statusBroadcast, tone: 'neutral', icon: 'send' }
        : { label: COPY.statusNew, tone: 'neutral', icon: 'pending' };
    case 'ACCEPTED':
      return { label: COPY.statusAccepted, tone: 'info', icon: 'verified' };
    case 'IN_PROGRESS':
      return { label: COPY.statusInProgress, tone: 'warning', icon: 'pending' };
    // Section 21 lists both; to the vendor a closed request is a finished one.
    case 'COMPLETED':
    case 'CLOSED':
      return { label: COPY.statusCompleted, tone: 'success', icon: 'success' };
    // The vendor's own answer, not a fault: neutral, and said in a word (3E-4).
    case 'REJECTED':
      return { label: COPY.statusRejected, tone: 'neutral', icon: 'reject' };
    default:
      return { label: COPY.statusUnknown, tone: 'neutral', icon: 'help' };
  }
}

/**
 * Whether a request is waiting for this vendor's answer — the only state in
 * which Accept and Reject are offered (section 33).
 *
 * The statuses the waiting label covers, and nothing else: a status the app
 * does not recognise is never assumed to be answerable. The service still
 * decides — this only keeps the app from offering what it knows to be invalid.
 */
export function isAwaitingAnswer(job: Pick<VendorJobSummary, 'status'>): boolean {
  const status = typeof job.status === 'string' ? job.status.trim().toUpperCase() : '';
  return status === 'CREATED' || status === 'PENDING_VENDOR';
}

/**
 * The work step an accepted request is ready for (sections 35 and 36): start an
 * accepted job, complete one in progress, and nothing for anything else —
 * waiting, rejected, finished, or a status the app does not recognise. The
 * service still decides; this only keeps the app from offering a step it knows
 * to be invalid.
 */
export function nextWorkStep(job: Pick<VendorJobSummary, 'status'>): 'start' | 'complete' | null {
  const status = typeof job.status === 'string' ? job.status.trim().toUpperCase() : '';
  if (status === 'ACCEPTED') {
    return 'start';
  }
  return status === 'IN_PROGRESS' ? 'complete' : null;
}

/**
 * Whether a request is finished work — the statuses the "Completed" label
 * covers, and nothing else. What was recorded on completion (sections 36 and
 * 37) is shown only then: a payment on work still under way would contradict
 * its own status.
 */
export function isFinishedWork(job: Pick<VendorJobSummary, 'status'>): boolean {
  const status = typeof job.status === 'string' ? job.status.trim().toUpperCase() : '';
  return status === 'COMPLETED' || status === 'CLOSED';
}

/**
 * Whether this vendor holds the work — accepted, in progress, or finished —
 * the only states in which a request's details may show who the customer is
 * and exactly where (owner decision, 21/10/2026: no customer name, phone or
 * full address before the vendor has accepted).
 *
 * Built from the two questions above rather than a list of its own, so the
 * statuses that offer a work step or a payment are exactly the ones that show
 * the customer. ⚠️ Anything else is no: waiting, declined, and a status the
 * app does not recognise — showing less is the only safe answer to a status
 * nobody worded. The service withholds the same fields; this is the screen's
 * half of the rule, kept even when a record carries them.
 */
export function holdsWork(job: Pick<VendorJobSummary, 'status'>): boolean {
  return nextWorkStep(job) !== null || isFinishedWork(job);
}
