/**
 * MockVendorRequestService
 *
 * Stands in for the vendor's request endpoints until they exist (Phases 3E-3
 * to 3E-5). It answers as a backend would: from the session, per vendor, and
 * with the same work the dashboard counts.
 *
 * ⚠️ The same fixtures as the dashboard, on purpose. `mockVendorDashboardData`
 * is one vendor's work; the dashboard previews it and this lists it. Two
 * fixture tables would let the dashboard say "4 waiting" over a list of three,
 * which is a bug a vendor would see in the first minute. Nothing else is shared
 * — the two services do not call each other and neither knows how the other is
 * drawn.
 *
 * ⚠️ The only state is what vendors did (Phases 3E-4 and 3E-5). Who accepted
 * or rejected what, and how far each vendor's accepted work has got, is kept in
 * the one `MockVendorRequestBook` the dashboard mock is handed too; the
 * fixtures themselves are rebuilt on every call. No storage, no timers, nothing
 * that changes a request's status by itself — a status changes because a
 * vendor called accept, reject, start or complete, and only then.
 *
 * ⚠️ It enforces what a backend would, rather than trusting the screen to hide a
 * button. Only a request that is waiting for this vendor can be answered; an
 * open request goes to whoever accepts first and everybody after is refused;
 * somebody else's directed request does not exist as far as this vendor is
 * concerned. Work moves one step at a time — accepted to in progress to
 * completed — and a step from any other status is refused. The checks and the
 * write happen in one synchronous step, so two calls in flight at once cannot
 * both pass them.
 *
 * ⚠️ A reference that is not this vendor's is `notFound`, whether or not some
 * other vendor has it. Answering `forbidden` would confirm that it exists.
 *
 * ⚠️ It withholds what the vendor may not see yet (owner decision,
 * 21/10/2026). Each request is held here in full — `RECORDS`, the customer's
 * request as raised — and `details` is the one place it is cut down for the
 * vendor asking: while they do not hold the work (waiting for their answer, or
 * declined by them) the record leaves off the customer's name, phone and full
 * address, and the area (`locality`) is all it says about where — as the list
 * and the dashboard leave the name off the same requests' cards. Whether they
 * hold it is this backend's own knowledge — which of their groups the request
 * is in — not a reading of the status. Accepting makes the same request come
 * back whole, on the answer and on every read after it.
 *
 * ⚠️ A completion is checked as a backend would check it (sections 36 and 37),
 * not trusted because the form already did: the amount a whole number of paise
 * above 0 and within the ceiling, the currency the one the app records in, the
 * status one it knows, a method — one of its own — when the customer paid and
 * none when they have not, notes within their ceiling. Anything else is
 * `validation`, and nothing is recorded. The input is checked first, then the
 * request is looked up and its status checked, as an endpoint validates a body
 * before it touches the record. The method's label is the service's own,
 * stored on the record, so a completion reads the same however the list of
 * methods changes later. It is recorded, never processed: no money moves. A
 * payment recorded later (21/10/2026) is checked the same way and changes the
 * record's payment and nothing else.
 *
 * ⚠️ The payment methods are this service's answer (section 37: "must follow
 * backend configuration") — section 37's own five, in its order. The app never
 * holds a list of its own.
 */

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser } from '@/features/auth/types';
import {
  applyVendorAnswers,
  asAccepted,
  asCompleted,
  asRejected,
  asStarted,
  MockVendorRequestBook,
  rejectedByVendor,
  unheld,
} from '@/shared/services/mock/MockVendorRequestBook';
import {
  buildMockVendorWork,
  mockScenarioFor,
  type MockDashboardScenario,
  type MockVendorWork,
} from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY, simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import type { RequestAddress } from '@/shared/services/types/RequestService';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import {
  COMPLETION_NOTES_MAX_LENGTH,
  FINAL_AMOUNT_MAX_MINOR,
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_UNPAID,
  type PaymentMethodOption,
  type VendorCompletionInput,
  type VendorCompletionRecord,
  type VendorPaymentInput,
  type VendorPaymentResult,
  type VendorRequestDecisionResult,
  type VendorRequestDetails,
  type VendorRequestList,
  type VendorRequestRefusal,
  type VendorRequestService,
  type VendorWorkStepResult,
} from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';

/**
 * One request as the customer raised it, beyond what a card shows — this
 * "backend"'s whole record, before anything is withheld from a vendor.
 *
 * The preferred date is written as days from today so the fixture stays
 * believable whenever the app is opened (the dashboard fixtures' ages do the
 * same); `details` turns it into the contract's `YYYY-MM-DD`.
 */
interface MockRequestRecord {
  categoryName?: string;
  description?: string;
  imageUrls?: readonly string[];
  /** 0 is today, 1 tomorrow, -1 yesterday. */
  preferredInDays?: number;
  preferredTime?: string;
  /** Withheld until the vendor holds the work. */
  customerPhone?: string;
  /** Withheld until the vendor holds the work. */
  address?: Readonly<RequestAddress>;
}

const photo = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`;

/**
 * Every request's full record, by reference.
 *
 * Kept beside the service rather than on the shared fixtures: the dashboard has
 * no use for a description, and a fixture file that fed two screens everything
 * either might want would couple them through it. A request with no entry here
 * still opens — it simply has no category line, no description and nothing
 * more.
 *
 * Phones are the fixtures' 90000 numbers (`mockAuthData`), never a real one.
 */
const RECORDS: Readonly<Record<string, MockRequestRecord>> = Object.freeze({
  // Waiting — the vendor is told the area and no more.
  'REQ-31042': {
    categoryName: 'Electrician',
    description: 'The main switchboard is sparking when the geyser is switched on. Power is off for now.',
    imageUrls: [photo('req31042a'), photo('req31042b')],
    // An emergency: today, at no particular time.
    preferredInDays: 0,
    customerPhone: '9000031042',
    address: {
      formattedAddress: '14, 3rd Cross, 5th Block, Koramangala, Bengaluru 560095',
      addressLine: '14, 3rd Cross, 5th Block',
      locality: 'Koramangala, Bengaluru',
      postalCode: '560095',
      latitude: 12.9352,
      longitude: 77.6245,
    },
  },
  'REQ-31038': {
    categoryName: 'Electrician',
    description: 'New ceiling fan for the second bedroom. The fan is already bought; the hook is in place.',
    preferredInDays: 1,
    preferredTime: '10:00',
    customerPhone: '9000031038',
    address: {
      formattedAddress: '702, Sobha Daffodil, 27th Main, HSR Layout Sector 2, Bengaluru 560102',
      addressLine: '702, Sobha Daffodil, 27th Main',
      locality: 'HSR Layout, Bengaluru',
      postalCode: '560102',
    },
  },
  // The stress case: long enough to wrap everywhere, and more photos than the strip draws.
  'REQ-2026-BLR-EAST-0031021': {
    categoryName: 'Electrician',
    description:
      'Tenants are moving out at the end of the month and the owner wants every room checked before the handover: sockets, switches, earthing, the distribution board and the balcony lights, with a written list of anything that needs replacing.',
    imageUrls: [
      photo('req31021a'),
      photo('req31021b'),
      photo('req31021c'),
      photo('req31021d'),
      photo('req31021e'),
      photo('req31021f'),
    ],
    preferredInDays: 3,
    preferredTime: '09:00',
    customerPhone: '9000031021',
    address: {
      formattedAddress:
        'Flat 1204, Tower B, Prestige Shantiniketan Residency, 3rd Cross, 12th Main Road, Hoysala Nagar, Indiranagar 2nd Stage Extension, Bengaluru 560038',
      locality: 'Indiranagar, Bengaluru',
      postalCode: '560038',
    },
  },
  // A request the customer added nothing to: the address alone, typed by hand.
  'REQ-30987': {
    customerPhone: '9000030987',
    address: { formattedAddress: '22, 1st Main, Jeevan Bhima Nagar, Bengaluru 560075' },
  },

  // Held — accepted or under way: everything.
  'REQ-30954': {
    categoryName: 'Electrician',
    description: 'Inverter and battery to be installed in the utility area. Wiring to two rooms.',
    imageUrls: [photo('req30954a')],
    preferredInDays: 0,
    preferredTime: '11:00',
    customerPhone: '9000030954',
    address: {
      formattedAddress: '221, 16th Main, BTM 2nd Stage, Bengaluru 560076',
      addressLine: '221, 16th Main',
      locality: 'BTM Layout, Bengaluru',
      postalCode: '560076',
    },
  },
  'REQ-30961': {
    categoryName: 'Electrician',
    description: 'MCB for the kitchen circuit keeps tripping.',
    preferredInDays: 1,
    preferredTime: '09:00',
    customerPhone: '9000030961',
    address: {
      formattedAddress: '5, 8th Main, 4th Block, Koramangala, Bengaluru 560034',
      locality: 'Koramangala, Bengaluru',
      postalCode: '560034',
    },
  },

  // Finished.
  'REQ-30912': {
    categoryName: 'Electrician',
    description: 'Separate point needed for a new geyser.',
    imageUrls: [photo('req30912a')],
    preferredInDays: -1,
    preferredTime: '15:00',
    customerPhone: '9000030912',
    address: { formattedAddress: '41, 19th Cross, HSR Layout Sector 3, Bengaluru 560102' },
  },
  'REQ-30876': {
    categoryName: 'Electrician',
    customerPhone: '9000030876',
    address: { formattedAddress: '9, 2nd Cross, Defence Colony, Indiranagar, Bengaluru 560038' },
  },
  'REQ-30833': {
    categoryName: 'Electrician',
    description: 'Two sockets in the hall are loose.',
    customerPhone: '9000030833',
    address: { formattedAddress: '17, 6th Cross, 1st Block, Koramangala, Bengaluru 560034' },
  },
  'REQ-30790': {
    categoryName: 'Electrician',
    customerPhone: '9000030790',
    address: { formattedAddress: '63, 7th Main, BTM 1st Stage, Bengaluru 560029' },
  },
  'REQ-30744': {
    categoryName: 'Electrician',
    customerPhone: '9000030744',
    address: { formattedAddress: '12, 24th Main, HSR Layout Sector 1, Bengaluru 560102' },
  },
});

/**
 * The ways a customer can pay, as this "backend" is configured: section 37's
 * own list, in its order. Ids are what the app sends; labels are what it shows.
 */
const PAYMENT_METHODS: readonly PaymentMethodOption[] = Object.freeze([
  Object.freeze({ id: 'cash', label: 'Cash' }),
  Object.freeze({ id: 'upi', label: 'UPI' }),
  Object.freeze({ id: 'bank_transfer', label: 'Bank transfer' }),
  Object.freeze({ id: 'card', label: 'Card' }),
  Object.freeze({ id: 'other', label: 'Other' }),
]);

/**
 * What was recorded when the fixtures' finished work was completed, by
 * reference — beside the service for the reason `RECORDS` is.
 *
 * One paid by UPI with a note, one not paid yet with none, and the rest with
 * no record at all: work finished before the record existed, or closed by the
 * backend some other way, which a screen must cope with by saying nothing.
 */
const COMPLETIONS: Readonly<Record<string, VendorCompletionRecord>> = Object.freeze({
  'REQ-30912': Object.freeze({
    finalAmountMinor: 185_000,
    currency: 'INR',
    paymentStatus: PAYMENT_STATUS_PAID,
    paymentMethodId: 'upi',
    paymentMethodLabel: 'UPI',
    notes: 'Replaced the geyser point and fitted a separate 20A MCB for it.',
  }),
  'REQ-30833': Object.freeze({
    finalAmountMinor: 65_000,
    currency: 'INR',
    paymentStatus: PAYMENT_STATUS_UNPAID,
  }),
  // REQ-30876, REQ-30790 and REQ-30744 deliberately have none: older records.
});

/** The statuses this "backend" calls finished — the only work a payment can be recorded on. */
const FINISHED_STATUSES: readonly string[] = Object.freeze(['COMPLETED', 'CLOSED']);

export interface MockVendorRequestServiceOptions {
  /** Simulated latency. Pass `NO_LATENCY` in tests. */
  latency?: MockLatency;

  /** The signed-in account, or null. Asked on every call. */
  currentUser?: () => Promise<AuthUser | null>;

  /** Which fixture a vendor gets. Defaults to the table beside the fixtures. */
  scenarioFor?: (vendorId: string) => MockDashboardScenario;

  /**
   * A vendor's work, in place of the fixtures. For a test that needs a record
   * the fixtures do not hold — a status nobody has heard of, say.
   */
  workFor?: (vendorId: string, nowMs: number) => MockVendorWork;

  /** Injectable clock, so a test can pin the ages on the cards. */
  now?: () => number;

  /**
   * Who answered what. Share one with the dashboard mock — `ServiceRegistry`
   * does — or the dashboard will not count what was answered here. A fresh,
   * empty book when not given.
   */
  book?: MockVendorRequestBook;
}

type Verdict =
  | { kind: 'waiting'; job: VendorJobSummary }
  | { kind: 'refused'; reason: VendorRequestRefusal };

/** One of this vendor's requests as it stands, and whether the work is theirs yet. */
interface Located {
  job: VendorJobSummary;
  /** Accepted by this vendor — under way or finished. Never a request waiting or declined. */
  held: boolean;
}

export class MockVendorRequestService implements VendorRequestService {
  private readonly latency: MockLatency;
  private readonly currentUser?: () => Promise<AuthUser | null>;
  private readonly scenarioFor: (vendorId: string) => MockDashboardScenario;
  private readonly workFor?: (vendorId: string, nowMs: number) => MockVendorWork;
  private readonly now: () => number;
  private readonly book: MockVendorRequestBook;

  constructor(options: MockVendorRequestServiceOptions = {}) {
    this.latency = options.latency ?? NO_LATENCY;
    this.currentUser = options.currentUser;
    this.scenarioFor = options.scenarioFor ?? mockScenarioFor;
    this.workFor = options.workFor;
    this.now = options.now ?? (() => Date.now());
    this.book = options.book ?? new MockVendorRequestBook();
  }

  async listRequests(): Promise<VendorRequestList> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();
      const offered = this.offered(vendor.id);
      const work = applyVendorAnswers(vendor.id, offered, this.book);

      // Statuses pass through untouched: the service reports, it does not interpret.
      return {
        pending: work.pending,
        active: work.active,
        completed: work.completed,
        // What this vendor declined: their history, apart from the work (2026-10-21).
        rejected: rejectedByVendor(vendor.id, offered, this.book),
      };
    }, this.latency);
  }

  async getRequest(requestId: string): Promise<VendorRequestDetails> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();
      const { job, held } = this.current(vendor.id, requestId);

      return this.details(vendor.id, job, held);
    }, this.latency);
  }

  async listPaymentMethods(): Promise<PaymentMethodOption[]> {
    return simulateNetwork(async () => {
      await this.requireVendor();

      // Copies, so a caller cannot edit the configuration by editing an answer.
      return PAYMENT_METHODS.map(method => ({ ...method }));
    }, this.latency);
  }

  async acceptRequest(requestId: string): Promise<VendorRequestDecisionResult<'accepted'>> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();
      const verdict = this.waiting(vendor.id, requestId);
      if (verdict.kind === 'refused') {
        return { outcome: 'refused', reason: verdict.reason };
      }

      this.record(() => this.book.recordAcceptance(vendor.id, verdict.job.id));
      // Theirs now: the record comes back whole — the customer, and where.
      return {
        outcome: 'accepted',
        request: this.details(vendor.id, asAccepted(verdict.job), true),
      };
    }, this.latency);
  }

  async rejectRequest(requestId: string): Promise<VendorRequestDecisionResult<'rejected'>> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();
      const verdict = this.waiting(vendor.id, requestId);
      if (verdict.kind === 'refused') {
        return { outcome: 'refused', reason: verdict.reason };
      }

      const rejectedAt = new Date(this.now()).toISOString();
      this.record(() => this.book.recordRejection(vendor.id, verdict.job.id, rejectedAt));
      return {
        outcome: 'rejected',
        request: this.details(vendor.id, asRejected(verdict.job, rejectedAt), false),
      };
    }, this.latency);
  }

  async startRequest(requestId: string): Promise<VendorWorkStepResult<'started'>> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();
      const { job } = this.current(vendor.id, requestId);
      if (job.status !== 'ACCEPTED') {
        return { outcome: 'refused', reason: 'invalidTransition' };
      }

      this.record(() => this.book.recordStart(vendor.id, job.id));
      return { outcome: 'started', request: this.details(vendor.id, asStarted(job), true) };
    }, this.latency);
  }

  async completeRequest(
    requestId: string,
    completion: VendorCompletionInput,
  ): Promise<VendorWorkStepResult<'completed'>> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();
      // The body first, as an endpoint validates it before it touches the record.
      const record = completionRecordOf(completion);
      // From here to the write, nothing is awaited: two completions cannot both pass.
      const { job } = this.current(vendor.id, requestId);
      if (job.status !== 'IN_PROGRESS') {
        return { outcome: 'refused', reason: 'invalidTransition' };
      }

      const completedAt = new Date(this.now()).toISOString();
      this.record(() => this.book.recordCompletion(vendor.id, job.id, completedAt, record));
      return {
        outcome: 'completed',
        request: this.details(vendor.id, asCompleted(job, completedAt), true),
      };
    }, this.latency);
  }

  async recordPayment(requestId: string, payment: VendorPaymentInput): Promise<VendorPaymentResult> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();
      // The body first, as for a completion.
      const method = paidMethodOf(payment);
      // From here to the write, nothing is awaited: two recordings cannot both pass.
      const { job, held } = this.current(vendor.id, requestId);
      const record =
        held && FINISHED_STATUSES.includes(job.status)
          ? this.completionOf(vendor.id, job.id)
          : undefined;

      // Already paid: the record as it is — a retry of a call that went through is not a fault.
      if (record?.paymentStatus === PAYMENT_STATUS_PAID) {
        return { outcome: 'recorded', request: this.details(vendor.id, job, true) };
      }
      // Only "Not paid yet" can change, and only to paid.
      if (record?.paymentStatus !== PAYMENT_STATUS_UNPAID) {
        return { outcome: 'refused', reason: 'invalidTransition' };
      }

      // The payment and nothing else: the amount, currency and notes stay as recorded.
      const paid: VendorCompletionRecord = {
        ...record,
        paymentStatus: PAYMENT_STATUS_PAID,
        paymentMethodId: method.id,
        paymentMethodLabel: method.label,
      };
      this.record(() => this.book.recordPayment(vendor.id, job.id, paid));
      return { outcome: 'recorded', request: this.details(vendor.id, job, true) };
    }, this.latency);
  }

  /**
   * One of this vendor's requests as it stands now — everybody's answers and
   * this vendor's progress applied — and whether they hold the work. A request
   * this vendor rejected is answered for exactly as their rejected list has it
   * — `REJECTED`, dated — even once somebody else has accepted it. Anything
   * else not here is `notFound`: never this vendor's, or taken by somebody else.
   *
   * Synchronous, so a step checked against it is written before anything else
   * can run.
   */
  private current(vendorId: string, requestId: string): Located {
    const reference = requestId.trim();
    const offered = this.offered(vendorId);
    const work = applyVendorAnswers(vendorId, offered, this.book);
    const matches = (candidate: VendorJobSummary) => candidate.id === reference;

    const waiting = work.pending.find(matches);
    if (waiting) {
      return { job: waiting, held: false };
    }
    const theirs = [...work.active, ...work.completed].find(matches);
    if (theirs) {
      return { job: theirs, held: true };
    }
    const declined = rejectedByVendor(vendorId, offered, this.book).find(matches);
    if (declined) {
      return { job: declined, held: false };
    }

    throw notFound();
  }

  /**
   * Whether a request is this vendor's to answer, and if not, why not.
   *
   * Synchronous from here to the write that follows it, on purpose: with no
   * `await` in between, two answers to the same request cannot both see it free.
   */
  private waiting(vendorId: string, requestId: string): Verdict {
    const reference = requestId.trim();
    const offered = this.offered(vendorId);

    const job = offered.pending.find(candidate => candidate.id === reference);
    if (!job) {
      // This vendor's, but it was never waiting — work under way or done.
      if (everyJob(offered).some(candidate => candidate.id === reference)) {
        return { kind: 'refused', reason: 'notPending' };
      }
      // Never offered to this vendor: somebody else's directed request, or nothing at all.
      throw notFound();
    }

    const holder = this.book.acceptedBy(reference);
    if (holder !== undefined && holder !== vendorId) {
      // First accept wins (section 33.1). Who won is not this vendor's business.
      return { kind: 'refused', reason: 'taken' };
    }
    if (holder === vendorId || this.book.hasRejected(vendorId, reference)) {
      // Already answered by this vendor — from another screen, or another device.
      return { kind: 'refused', reason: 'notPending' };
    }

    return { kind: 'waiting', job };
  }

  /** Writes an answer or a step. Anything that stops it being kept is a failure, never a success. */
  private record(write: () => void): void {
    try {
      write();
    } catch (cause) {
      throw new AppError({
        kind: 'unknown',
        message: 'Mock vendor requests: the answer could not be recorded',
        cause,
      });
    }
  }

  /**
   * What was recorded when a job was completed, as it stands: a payment
   * recorded later, else this vendor's own completion if they completed it
   * here, else the fixture's, if it has one.
   */
  private completionOf(vendorId: string, requestId: string): VendorCompletionRecord | undefined {
    return (
      this.book.paymentOf(vendorId, requestId) ??
      this.book.progressOf(vendorId, requestId)?.completion ??
      COMPLETIONS[requestId]
    );
  }

  /**
   * The request as this vendor may see it — the one place the owner's rule of
   * 21/10/2026 is applied.
   *
   * Always: the summary, and from the full record the category, what the
   * customer said, the photographs and the preferred date and time. Only when
   * the vendor holds the work: the customer's name and phone and the full
   * address — before that, the summary's `locality` is all that says where.
   * On finished work, what was recorded when it was completed.
   *
   * ⚠️ Withheld means absent: not null, not "", not a masked number. Fresh
   * objects and arrays, so a caller cannot edit the record by editing an answer.
   */
  private details(vendorId: string, summary: VendorJobSummary, held: boolean): VendorRequestDetails {
    const record = RECORDS[summary.id];
    const completion = this.completionOf(vendorId, summary.id);

    // The same cut as the cards' (`unheld`), so a card and its details cannot disagree.
    const shown: VendorRequestDetails = held ? { ...summary } : unheld(summary);

    return {
      ...shown,
      ...(record?.categoryName ? { categoryName: record.categoryName } : {}),
      ...(record?.description ? { description: record.description } : {}),
      ...(record?.imageUrls && record.imageUrls.length > 0 ? { imageUrls: [...record.imageUrls] } : {}),
      ...(record?.preferredInDays !== undefined
        ? { preferredDate: calendarDate(this.now(), record.preferredInDays) }
        : {}),
      ...(record?.preferredTime ? { preferredTime: record.preferredTime } : {}),
      ...(held && record?.customerPhone ? { customerPhone: record.customerPhone } : {}),
      ...(held && record?.address ? { address: { ...record.address } } : {}),
      ...(completion ? { completion: { ...completion } } : {}),
    };
  }

  /** What this vendor was offered, before anybody's answers. */
  private offered(vendorId: string): MockVendorWork {
    const nowMs = this.now();

    return this.workFor
      ? this.workFor(vendorId, nowMs)
      : buildMockVendorWork(this.scenarioFor(vendorId), nowMs);
  }

  /** What an authenticated vendor endpoint does to anybody else. */
  private async requireVendor(): Promise<AuthUser> {
    const user = (await this.currentUser?.()) ?? null;
    if (!user || user.role !== 'vendor') {
      throw new AppError({
        kind: 'unauthorized',
        message: 'Mock vendor requests: no vendor session',
      });
    }

    return user;
  }
}

function everyJob(work: MockVendorWork): VendorJobSummary[] {
  return [...work.pending, ...work.active, ...work.completed];
}

/**
 * A local calendar date some days from the given instant, as `YYYY-MM-DD` —
 * from local components, never `toISOString`, which converts to UTC first and
 * would put an evening fixture on the wrong day east of Greenwich.
 */
function calendarDate(nowMs: number, days: number): string {
  const now = new Date(nowMs);
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/** Not this vendor's — whether or not it is somebody else's. */
function notFound(): AppError {
  return new AppError({ kind: 'notFound', message: 'Mock vendor requests: no such request' });
}

function invalidCompletion(why: string): AppError {
  return new AppError({ kind: 'validation', message: `Mock vendor requests: ${why}` });
}

/**
 * A later payment checked as a backend would check it, and the method it names
 * — or `validation` saying what was wrong. Read as untrusted input, as a
 * completion is: the status must be exactly paid, the method one of this
 * service's own.
 */
function paidMethodOf(input: VendorPaymentInput): PaymentMethodOption {
  const value = (typeof input === 'object' && input !== null ? input : {}) as Partial<
    Record<keyof VendorPaymentInput, unknown>
  >;

  if (value.paymentStatus !== PAYMENT_STATUS_PAID) {
    throw invalidCompletion('a payment recorded later can only say the customer has paid');
  }

  const method = PAYMENT_METHODS.find(candidate => candidate.id === value.paymentMethodId);
  if (!method) {
    throw invalidCompletion('a payment needs one of the payment methods');
  }

  return method;
}

/**
 * A completion checked as a backend would check it, and the record it would
 * keep — or `validation` saying what was wrong (for the developer; the user
 * sees the kind's own sentence).
 *
 * Read as untrusted input: whatever arrives is checked field by field, so a
 * caller that got around the types is refused rather than stored. A blank note
 * is no note; the method's label is the service's own.
 */
function completionRecordOf(input: VendorCompletionInput): VendorCompletionRecord {
  const value = (typeof input === 'object' && input !== null ? input : {}) as Partial<
    Record<keyof VendorCompletionInput, unknown>
  >;

  const amount = value.finalAmountMinor;
  if (
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > FINAL_AMOUNT_MAX_MINOR
  ) {
    throw invalidCompletion('the final amount is not a whole number of minor units within range');
  }

  const currency = value.currency;
  if (typeof currency !== 'string' || currency !== AppConfig.money.currency) {
    throw invalidCompletion('the currency is not one this service records');
  }

  const status = value.paymentStatus;
  if (typeof status !== 'string' || (status !== PAYMENT_STATUS_PAID && status !== PAYMENT_STATUS_UNPAID)) {
    throw invalidCompletion('the payment status is not one this service knows');
  }

  let method: PaymentMethodOption | undefined;
  if (status === PAYMENT_STATUS_PAID) {
    method = PAYMENT_METHODS.find(candidate => candidate.id === value.paymentMethodId);
    if (!method) {
      throw invalidCompletion('a paid job needs one of the payment methods');
    }
  } else if (value.paymentMethodId !== undefined) {
    throw invalidCompletion('a job that is not paid yet has no payment method');
  }

  const notes = value.notes;
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > COMPLETION_NOTES_MAX_LENGTH)) {
    throw invalidCompletion('the notes are not text within the ceiling');
  }

  return {
    finalAmountMinor: amount,
    currency,
    paymentStatus: status,
    ...(method ? { paymentMethodId: method.id, paymentMethodLabel: method.label } : {}),
    ...(typeof notes === 'string' && notes.trim().length > 0 ? { notes } : {}),
  };
}
