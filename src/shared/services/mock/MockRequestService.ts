/**
 * MockRequestService
 *
 * In-memory RequestService for the UI-first phase.
 *
 * ⚠️ It keeps what it is sent, and that reverses an earlier decision on purpose.
 * This mock used to acknowledge a created request and forget it, on the grounds
 * that persistence is the backend's and a mock that remembered would let screens
 * lean on behaviour no contract promised. Request details (PROJECT_BIBLE.md
 * section 20) changed the question: submitting a request and then opening it is
 * the flow itself, and a mock that cannot hand back the request it just accepted
 * makes that flow unreachable before the backend exists. So created requests are
 * stored, and read back, and listed.
 *
 * What stops that becoming the thing the old decision feared:
 *
 * - The store is the service's own and nothing else sees it. Screens reach it
 *   through `RequestService`, exactly as they will reach the real table.
 * - Order is computed, never inherited. The recent list is sorted by
 *   `createdAt` every time it is read, so nothing depends on which record
 *   happened to be inserted first — which is the ordering the contract promises
 *   and the only one a real endpoint would give.
 * - Each instance starts from the same seed. A test that constructs its own
 *   service cannot be affected by what another test created.
 *
 * ⚠️ Kept on this device, and only here. A request a customer raises is saved
 * through `MockRequestHistoryStorage` once it has been accepted, under that
 * customer's own key, and restored the first time the table is asked for
 * anything after a launch — so it is still there after the app is closed. That
 * reverses the earlier memory-only rule, because leaving a request and coming
 * back to it is the flow the customer app exists for. It is still a mock
 * standing in for a backend table, not persistence anyone may rely on: nothing
 * leaves the phone, nothing syncs, and another device sees none of it. The seed
 * is fixture data rebuilt on every launch and never saved.
 *
 * ⚠️ Scoped to the customer asking. The table is rebuilt from the seed and that
 * customer's saved requests whenever the customer changes, so signing out and in
 * as somebody else never shows the first person's requests to the second.
 *
 * The seed is fixture data standing in for a backend table. Its names come from
 * the category and vendor fixtures, so the three mocks tell one story. Statuses
 * are section 21's, spread across the seed so that every customer-facing stage
 * is reachable by opening a request — submitted, searching, awaiting a chosen
 * professional, assigned, in progress, completed, and one cancelled — and the
 * records between them cover every optional field present and absent: notes, no
 * notes, a typed address with no coordinates, a very long address, a very long
 * professional name, and one photograph that will not load. One completed
 * request carries the payment its professional recorded (sections 36 and 37)
 * and one closed request has none, so the details screen is seen both ways.
 *
 * ⚠️ The vendor mock's payment records are not these. The customer's and the
 * vendor's fixtures are two separate stand-in tables that share no requests and
 * no data; a payment recorded by a vendor in the app does not appear here.
 * Joining them is the backend's.
 *
 * ⚠️ Statuses never change here on their own. There is no timer and no
 * transition: a seeded request keeps its status for the life of the process, and
 * a created one keeps the status it was created with. How requests move through
 * section 21 is the backend's, and a mock that advanced them would be inventing a
 * lifecycle the app might then come to depend on. The one change is the
 * customer's own: `cancelRequest`, from `CREATED` or `PENDING_VENDOR` to
 * `CANCELLED` (owner decision, 21/10/2026), refused from anything later.
 *
 * ⚠️ A cancellation is saved on the device for a request the customer raised,
 * the way its creation was. A seeded request's lasts only as long as the table
 * does — until the app restarts or another customer signs in — because the seed
 * is fixture data that is rebuilt and never saved.
 *
 * ⚠️ The vendor mocks never hear of a cancellation. They hold their own fixtures
 * and share no requests with this table, so a request cancelled here is not
 * withdrawn from any vendor's list. Telling the professionals is the backend's.
 *
 * Replacing this with an ApiRequestService requires no change to any screen.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { findMockServiceNames } from '@/shared/services/mock/MockCategoryService';
import type { MockRequestHistoryStorage } from '@/shared/services/mock/MockRequestHistoryStorage';
import { findMockVendorName } from '@/shared/services/mock/MockVendorService';
import { simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import type {
  CancelRequestResult,
  CreateRequestInput,
  CreatedRequest,
  CustomerRequest,
  CustomerRequestDetails,
  RequestHistoryFilter,
  RequestService,
} from '@/shared/services/types/RequestService';
import { PAYMENT_STATUS_PAID } from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';
import { toPage, type Page, type PageRequest } from '@/shared/types/pagination';

const log = createLogger('MockRequestService');

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 60 * 24;

/**
 * Where invented references carry on from.
 *
 * ⚠️ `mockId` would have produced `REQ_1`, which is a fixture's name rather than
 * anything a customer would read out over the telephone. This continues the
 * seed's own numbering instead, so a created request looks like the ones already
 * in the list.
 *
 * Deterministic on purpose: a counter per instance, never a random string. A
 * reference that changed between runs could not be asserted on.
 */
const LAST_SEEDED_REFERENCE = 24082;

/** The number in a reference this mock issued, or 0 for one it did not. */
function referenceNumber(id: string): number {
  const match = /^REQ-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

export interface MockRequestServiceOptions {
  /**
   * Simulated latency. Defaults to `AppConfig.mock`; pass `NO_LATENCY` in tests
   * so a suite is not billed hundreds of milliseconds per call.
   */
  latency?: MockLatency;

  /**
   * Where accepted requests are kept between launches.
   *
   * Without it — or without `currentCustomerId` — the table is memory only and
   * every instance starts from the seed alone, which is what a test that is not
   * about restarts wants.
   */
  history?: MockRequestHistoryStorage;

  /**
   * Who is asking: the signed-in customer's id, or null when there is none.
   *
   * Asked on every call rather than once, because the customer can change
   * without the service being rebuilt — signing out and back in as somebody
   * else happens in one process. A backend knows this from the token; the mock
   * has to be told.
   */
  currentCustomerId?: () => Promise<string | null>;
}

/** A record and the order it arrived in, which breaks a tie and nothing else. */
interface StoredRequest {
  record: CustomerRequestDetails;
  sequence: number;
}

/**
 * A local calendar date some days from today, as `YYYY-MM-DD`.
 *
 * Built from local components rather than `toISOString`, which converts to UTC
 * first and would put an evening fixture on the wrong day east of Greenwich.
 */
function calendarDateFromToday(days: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The table as it stands before this session raised anything.
 *
 * A function rather than a constant so every instance gets its own records and
 * its own "minutes ago" — measured from the anchor it is given, not from when
 * the module happened to load.
 *
 * ⚠️ The anchor is not always now. The seed stands for requests raised before
 * anything this customer raised, and once their requests survive a restart that
 * has to stay true: a seed re-dated to "35 minutes ago" on every launch would
 * climb above a request they raised yesterday, and push it off Home's short list
 * altogether. So the table anchors the seed to the earlier of now and the oldest
 * saved request (`load`), and ordering can stay purely by `createdAt`.
 */
function seedRequests(anchorMs: number): CustomerRequestDetails[] {
  const minutesBefore = (minutes: number) => new Date(anchorMs - minutes * 60_000).toISOString();

  return [
    {
      id: 'REQ-24081',
      categoryId: 'cat_plumber',
      subCategoryId: 'sub_leak_repair',
      categoryName: 'Plumber',
      serviceName: 'Leak Repair',
      // Directed and not yet taken: a preference, and no assignment.
      preferredVendor: { id: 'ven_citywide_plumbing', name: 'Citywide Plumbing' },
      status: 'PENDING_VENDOR',
      priority: 'HIGH',
      preferredDate: calendarDateFromToday(1),
      preferredTime: '10:00',
      notes: 'Water is dripping steadily from the pipe under the kitchen sink.',
      address: {
        formattedAddress: 'Prestige Acropolis, 100 Feet Road, Indiranagar, Bengaluru 560038',
        latitude: 12.9719,
        longitude: 77.6412,
        addressLine: 'Prestige Acropolis, 100 Feet Road',
        locality: 'Indiranagar, Bengaluru',
        postalCode: '560038',
      },
      createdAt: minutesBefore(35),
    },
    {
      id: 'REQ-24079',
      categoryId: 'cat_painting',
      subCategoryId: 'sub_interior_paint',
      categoryName: 'Painting',
      serviceName: 'Interior Painting',
      // Received and not yet dispatched: section 21's first state.
      status: 'CREATED',
      priority: 'LOW',
      preferredDate: calendarDateFromToday(3),
      address: {
        formattedAddress: 'Brigade Road, Ashok Nagar, Bengaluru 560001',
        latitude: 12.9752,
        longitude: 77.6069,
      },
      createdAt: minutesBefore(2 * MINUTES_PER_HOUR),
    },
    {
      id: 'REQ-24076',
      categoryId: 'cat_ac_repair',
      subCategoryId: 'sub_ac_service',
      categoryName: 'AC Repair',
      serviceName: 'AC Servicing',
      vendorName: 'CoolAir Services',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      /*
        ⚠️ The second photograph will never load, deliberately.

        `.invalid` is reserved and resolves nowhere, so the details screen's
        failed-image state is reachable by opening this request rather than by
        editing a mock — the same reason one category and one service are left
        empty elsewhere.
      */
      imageUrls: [
        'https://picsum.photos/seed/req24076a/800/600',
        'https://images.fixora.invalid/req24076b.jpg',
      ],
      address: {
        formattedAddress: '27, 11th Main, 4th Block, Jayanagar, Bengaluru 560011',
        latitude: 12.9299,
        longitude: 77.5826,
        addressLine: '27, 11th Main, 4th Block',
        locality: 'Jayanagar, Bengaluru',
        postalCode: '560011',
      },
      createdAt: minutesBefore(6 * MINUTES_PER_HOUR),
    },
    {
      id: 'REQ-24070',
      categoryId: 'cat_carpenter',
      subCategoryId: 'sub_door_repair',
      categoryName: 'Carpenter',
      serviceName: 'Door Repair',
      // Open dispatch and nobody has taken it: the customer is told Fixora is
      // searching, and no professional is named anywhere.
      status: 'PENDING_VENDOR',
      priority: 'MEDIUM',
      preferredTime: '16:00',
      notes: 'The bedroom door has dropped on its hinges and scrapes the floor.',
      // Typed by hand and deliberately long, so the address wraps at 360dp.
      address: {
        formattedAddress:
          'Flat 1204, Tower B, Prestige Shantiniketan Apartments, Whitefield Main Road, near the ITPL back gate, Whitefield, Bengaluru 560066',
      },
      createdAt: minutesBefore(14 * MINUTES_PER_HOUR),
    },
    {
      id: 'REQ-24063',
      categoryId: 'cat_electrician',
      subCategoryId: 'sub_fan_repair',
      categoryName: 'Electrician',
      serviceName: 'Fan Repair',
      // The longest professional name in the vendor fixtures, asked for and
      // then assigned, so both rows are seen wrapping.
      preferredVendor: {
        id: 'ven_bright_spark',
        name: 'Bright Spark Electrical Services and Repairs',
      },
      vendorName: 'Bright Spark Electrical Services and Repairs',
      status: 'ACCEPTED',
      priority: 'EMERGENCY',
      preferredTime: '18:00',
      notes:
        'The ceiling fan in the bedroom makes a grinding noise and stops after about ten minutes. It started after a power cut last night, and the regulator gets warm to the touch.',
      // Typed by hand: a line of text and nothing a geocoder added.
      address: { formattedAddress: '17 Cross Lane, Devanahalli, Bengaluru 562110' },
      createdAt: minutesBefore(MINUTES_PER_DAY),
    },
    {
      id: 'REQ-24048',
      categoryId: 'cat_electrician',
      subCategoryId: 'sub_switch_repair',
      categoryName: 'Electrician',
      serviceName: 'Switch Repair',
      vendorName: 'N.S. Electricals',
      status: 'COMPLETED',
      priority: 'LOW',
      address: {
        formattedAddress: '9, Sector 2, HSR Layout, Bengaluru 560102',
        latitude: 12.9121,
        longitude: 77.6446,
      },
      // What the professional recorded on completing it (sections 36 and 37).
      payment: {
        finalAmountMinor: 45_000,
        currency: 'INR',
        paymentStatus: PAYMENT_STATUS_PAID,
        paymentMethodLabel: 'Cash',
      },
      createdAt: minutesBefore(3 * MINUTES_PER_DAY),
    },
    {
      id: 'REQ-24020',
      categoryId: 'cat_cleaning',
      subCategoryId: 'sub_deep_clean',
      categoryName: 'Cleaning',
      serviceName: 'Deep Home Cleaning',
      status: 'CANCELLED',
      priority: 'MEDIUM',
      preferredDate: calendarDateFromToday(-8),
      address: { formattedAddress: '58, 8th Cross, Malleshwaram, Bengaluru 560003' },
      createdAt: minutesBefore(9 * MINUTES_PER_DAY),
    },
    {
      id: 'REQ-24012',
      categoryId: 'cat_plumber',
      subCategoryId: 'sub_tap_fitting',
      categoryName: 'Plumber',
      serviceName: 'Tap Fitting',
      vendorName: 'Citywide Plumbing',
      /*
        Finished with no payment on record — closed before the record existed —
        so a completed request without one is reachable by opening it, and the
        details screen is seen saying nothing about payment.
      */
      status: 'CLOSED',
      priority: 'MEDIUM',
      address: { formattedAddress: '4, 2nd Main Road, Basavanagudi, Bengaluru 560004' },
      createdAt: minutesBefore(12 * MINUTES_PER_DAY),
    },
  ];
}

/** Newest first; arrival order only when two were raised in the same instant. */
function byNewest(a: StoredRequest, b: StoredRequest): number {
  return (
    Date.parse(b.record.createdAt) - Date.parse(a.record.createdAt) || b.sequence - a.sequence
  );
}

/**
 * The card's fields and nothing more.
 *
 * ⚠️ Projected explicitly rather than returned whole. A list endpoint that
 * happened to carry the address, the notes and the photographs of every request
 * would be putting all of them in front of a screen that shows none of them.
 */
function toSummary({ record }: StoredRequest): CustomerRequest {
  return {
    id: record.id,
    // The mock's id is its reference; the real backend keeps the two apart.
    reference: record.reference ?? record.id,
    serviceName: record.serviceName,
    ...(record.vendorName !== undefined ? { vendorName: record.vendorName } : {}),
    status: record.status,
    priority: record.priority,
    createdAt: record.createdAt,
    ...(record.preferredVendor ? { preferredVendor: { ...record.preferredVendor } } : {}),
  };
}

/**
 * A record as a caller receives it: with its reference, which in this mock is
 * its id (the real backend keeps the two apart). Added on the way out, never
 * stored, so a record saved on the device is exactly what was sent.
 */
function toOutgoing(record: CustomerRequestDetails): CustomerRequestDetails {
  return { ...copyDetails(record), reference: record.reference ?? record.id };
}

/**
 * Which section 21 statuses each section 23 view shows, as this mock answers it.
 *
 * ⚠️ The backend's decision, stood in for here. The owner confirmed on
 * 2026-09-21: on hold is still open, so it is active; not accepted is neither
 * under way nor cancelled, so it appears under All only; and a status section 21
 * does not name appears under All only — never as completed.
 */
const FILTER_STATUSES: Readonly<Record<Exclude<RequestHistoryFilter, 'all'>, ReadonlySet<string>>> =
  Object.freeze({
    active: new Set(['CREATED', 'PENDING_VENDOR', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD']),
    completed: new Set(['COMPLETED', 'CLOSED']),
    cancelled: new Set(['CANCELLED']),
  });

/**
 * The statuses a customer may cancel from, as this mock answers it.
 *
 * ⚠️ The backend's rule, stood in for. The owner decided on 21/10/2026 that a
 * customer may cancel only while no professional has accepted the request —
 * received, or waiting for a professional. The app keeps its own copy of the
 * rule for deciding what to show (`isCancellableState`); this one is the
 * server's refusal, so the app's is never the only one — as with reviews.
 */
const CANCELLABLE_STATUSES: ReadonlySet<string> = new Set(['CREATED', 'PENDING_VENDOR']);

/** What a cancelled request is, in section 21's word. */
const CANCELLED_STATUS = 'CANCELLED';

function matchesFilter(status: string, filter: RequestHistoryFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  const set = FILTER_STATUSES[filter];
  // Case and padding forgiven, as `requestStateOf` forgives them.
  return set !== undefined && set.has(status.trim().toUpperCase());
}

/** Copied all the way down, so a caller cannot edit the table by editing a result. */
function copyDetails(record: CustomerRequestDetails): CustomerRequestDetails {
  return {
    ...record,
    address: { ...record.address },
    ...(record.imageUrls ? { imageUrls: [...record.imageUrls] } : {}),
    ...(record.preferredVendor ? { preferredVendor: { ...record.preferredVendor } } : {}),
    ...(record.payment ? { payment: { ...record.payment } } : {}),
  };
}

export class MockRequestService implements RequestService {
  /** The request table, by reference. */
  private readonly requests = new Map<string, StoredRequest>();

  private lastReference = LAST_SEEDED_REFERENCE;

  private sequence = 0;

  /**
   * The references the seed holds. A change to one of those is never saved:
   * `load` prefers the seed over anything saved under its references, so a
   * saved copy would be written and then never read.
   */
  private seededIds: ReadonlySet<string> = new Set();

  private readonly latency: MockLatency | undefined;

  private readonly history: MockRequestHistoryStorage | undefined;

  private readonly currentCustomerId: (() => Promise<string | null>) | undefined;

  /**
   * Whose requests the table holds, and the load that put them there.
   *
   * Null until the first call. Held as a promise, so calls that arrive together
   * — Home's first render, a pull-to-refresh on top of it — share one load
   * rather than each reading storage and filling the table again.
   */
  private loaded: { customerId: string | null; ready: Promise<void> } | null = null;

  constructor(options: MockRequestServiceOptions = {}) {
    this.latency = options.latency;
    this.history = options.history;
    this.currentCustomerId = options.currentCustomerId;

    this.resetToSeed();
  }

  /**
   * Every public method goes through here rather than calling `simulateNetwork`
   * directly, so a method added later cannot quietly ignore the override.
   */
  private simulate<T>(produce: () => T | Promise<T>): Promise<T> {
    return this.latency ? simulateNetwork(produce, this.latency) : simulateNetwork(produce);
  }

  private store(record: CustomerRequestDetails): void {
    this.sequence += 1;
    this.requests.set(record.id, { record, sequence: this.sequence });
  }

  /** The seed and nothing else, numbering included, dated back from `anchorMs`. */
  private resetToSeed(anchorMs: number = Date.now()): void {
    this.requests.clear();
    this.sequence = 0;
    this.lastReference = LAST_SEEDED_REFERENCE;

    const seed = seedRequests(anchorMs);
    for (const record of seed) {
      this.store(record);
    }
    this.seededIds = new Set(seed.map(record => record.id));
  }

  /**
   * Whether this table knows who is asking — the way the app builds it, with
   * device storage and the session. Built without either (a test that is not
   * about customers) it is memory only and asks nobody.
   */
  private isScoped(): boolean {
    return this.history !== undefined && this.currentCustomerId !== undefined;
  }

  /**
   * Makes the table the asking customer's, and says who that is.
   *
   * Every public method awaits this before doing anything else, so nothing is
   * read or raised against a table that has not been restored. Null means
   * memory only: no history was configured, nobody is signed in, or there was
   * no telling who is.
   */
  private async prepare(): Promise<string | null> {
    const { history, currentCustomerId } = this;

    if (!history || !currentCustomerId) {
      return null;
    }

    let customerId: string | null = null;
    try {
      customerId = await currentCustomerId();
    } catch (error) {
      log.warn('Could not tell which customer is asking; requests stay in memory only', {
        error: String(error),
      });
    }

    if (!this.loaded || this.loaded.customerId !== customerId) {
      this.loaded = { customerId, ready: this.load(history, customerId) };
    }

    await this.loaded.ready;
    return customerId;
  }

  /**
   * The seed, plus what this customer raised before.
   *
   * ⚠️ A saved request comes back exactly as it was saved: the same reference,
   * the same status, the same timestamp. Nothing is re-issued, advanced or
   * re-dated, so a request that was waiting on a professional when the app
   * closed is still waiting when it opens — the stage the customer sees is
   * derived from that status again, never stored.
   */
  private async load(history: MockRequestHistoryStorage, customerId: string | null): Promise<void> {
    let saved: CustomerRequestDetails[] = [];

    if (customerId !== null) {
      try {
        saved = await history.read(customerId);
      } catch (error) {
        // The storage promises not to throw; the table does not bet on it.
        log.warn('Could not read request history; showing the seed alone', {
          error: String(error),
        });
      }
    }

    /*
      The seed dated back from the oldest saved request, when that is earlier
      than now, so everything the customer raised stays newer than the fixtures
      that stand for what came before it. See `seedRequests`.
    */
    const anchorMs = saved.reduce(
      (earliest, record) => Math.min(earliest, Date.parse(record.createdAt)),
      Date.now(),
    );

    this.resetToSeed(anchorMs);

    // Oldest first, so the arrival order that breaks a tie follows when the
    // requests were raised rather than where storage happened to keep them.
    const oldestFirst = [...saved].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );

    let restored = 0;

    for (const record of oldestFirst) {
      // A seeded reference belongs to the fixture. This mock never issues one,
      // so a saved record claiming it is not preferred over the seed.
      if (this.requests.has(record.id)) {
        continue;
      }

      this.store(copyDetails(record));
      // Numbering carries on after what was already issued, so a request raised
      // after a restart never takes a reference an earlier one holds.
      this.lastReference = Math.max(this.lastReference, referenceNumber(record.id));
      restored += 1;
    }

    // How many, never which: a reference leads straight back to an address.
    log.info('Mock request history restored', { restored });
  }

  /** The next reference nobody holds. */
  private nextReference(): string {
    do {
      this.lastReference += 1;
    } while (this.requests.has(`REQ-${this.lastReference}`));

    return `REQ-${this.lastReference}`;
  }

  /**
   * Keeps an accepted request — or an accepted change to one — for after a
   * restart, when there is a customer to keep it for.
   *
   * ⚠️ Called only once the request or the change has been accepted, and unable
   * to undo that. A write that fails leaves the record in the table for this
   * session and says so in the log; it does not turn a created or cancelled
   * request into a failed one, because the "backend" did accept it. What is lost
   * is this device's copy, and nothing on screen claims otherwise — the app has
   * never told a customer a request is saved anywhere.
   */
  private async remember(
    customerId: string | null,
    record: CustomerRequestDetails,
    change: 'created' | 'cancelled' = 'created',
  ): Promise<void> {
    if (!this.history || !this.currentCustomerId) {
      return;
    }

    if (customerId === null) {
      log.info('No signed-in customer; the request is kept in memory only');
      return;
    }

    let saved = false;
    try {
      saved = await this.history.save(customerId, copyDetails(record));
    } catch (error) {
      log.warn('Saving request history threw', { error: String(error) });
    }

    if (!saved) {
      log.warn('Mock request accepted but not saved on this device; it will not survive a restart', {
        change,
      });
    }
  }

  async listRecentRequests(limit: number): Promise<CustomerRequest[]> {
    await this.prepare();

    return this.simulate(() => {
      // Clamped rather than trusted. A negative or absurd limit is a caller's
      // mistake, and a mock that returns the whole table for one hides it until
      // the real endpoint refuses.
      const count = Math.max(0, Math.min(Math.trunc(limit), this.requests.size));

      log.info('Mock recent requests listed', { limit, count });

      return [...this.requests.values()].sort(byNewest).slice(0, count).map(toSummary);
    });
  }

  async listRequests(
    filter: RequestHistoryFilter,
    request: PageRequest,
  ): Promise<Page<CustomerRequest>> {
    await this.prepare();

    return this.simulate(() => {
      /*
        Refused rather than clamped. A page before the first or a page of no
        size is a caller's mistake, and answering it with something plausible
        would hide it until the real endpoint refuses.
      */
      if (
        !Number.isInteger(request.page) ||
        request.page < AppConfig.pagination.initialPage ||
        !Number.isInteger(request.pageSize) ||
        request.pageSize < 1
      ) {
        throw new AppError({ kind: 'validation', message: 'Mock request page is out of range' });
      }

      if (!(filter === 'all' || filter in FILTER_STATUSES)) {
        throw new AppError({ kind: 'validation', message: 'Mock request filter is not one section 23 names' });
      }

      /*
        Sorted, then filtered, then paged — every time, from the table.

        Nothing is remembered between pages, so page two is always the second
        page of the order as it stands. A request raised between two page reads
        shifts later pages by one; the list that reads them is what drops a
        repeat (`usePaginatedQuery`'s `getKey`).
      */
      const matching = [...this.requests.values()]
        .sort(byNewest)
        .filter(({ record }) => matchesFilter(record.status, filter))
        .map(toSummary);

      const page = toPage(matching, request);

      log.info('Mock request page listed', {
        filter,
        page: page.page,
        count: page.items.length,
        hasMore: page.hasMore,
      });

      return page;
    });
  }

  async getRequest(requestId: string): Promise<CustomerRequestDetails | null> {
    await this.prepare();

    return this.simulate(() => {
      const stored = this.requests.get(requestId);

      // Whether, never which. A reference is something a customer quotes, and
      // it has no more business in a log line than the address it leads to.
      log.info('Mock request read', { found: stored !== undefined });

      return stored ? toOutgoing(stored.record) : null;
    });
  }

  async createRequest(input: CreateRequestInput): Promise<CreatedRequest> {
    const customerId = await this.prepare();

    return this.simulate(async () => {
      /*
        Named the way a backend would name it: by looking the identifiers up.

        And refused the way a backend would refuse it. A request for a service
        the catalogue does not offer, or directed at somebody not offered for
        this service, is not something to store with a blank where the name
        should be — it is a request the server would never have accepted.
      */
      const names = findMockServiceNames(input.categoryId, input.subCategoryId);

      if (!names) {
        throw new AppError({
          kind: 'validation',
          message: 'Mock request refused: the service is not in the catalogue',
        });
      }

      const vendorName =
        input.vendorId === undefined
          ? undefined
          : findMockVendorName(input.subCategoryId, input.vendorId);

      if (input.vendorId !== undefined && vendorName === undefined) {
        throw new AppError({
          kind: 'validation',
          message: 'Mock request refused: the vendor is not offered for this service',
        });
      }

      const created: CreatedRequest = {
        id: this.nextReference(),
        /*
          Already waiting on a professional, whichever way it was routed.

          Section 18A.6's single-call form puts the vendor decision on this very
          call, so dispatch has begun by the time it returns — which section 21
          calls `PENDING_VENDOR` for both directed and open requests. The customer
          sees "Searching for a professional" or "Awaiting professional response"
          because the app derives that from whether a vendor was chosen; the
          "backend" stores one status either way, and never advances it.
        */
        status: 'PENDING_VENDOR',
        createdAt: new Date().toISOString(),
      };

      /*
        Stored as sent. Optional fields that were absent stay absent rather than
        arriving as `undefined` keys, so a record read back has exactly the shape
        of the payload that made it.
      */
      const record: CustomerRequestDetails = {
        id: created.id,
        categoryId: input.categoryId,
        subCategoryId: input.subCategoryId,
        categoryName: names.categoryName,
        serviceName: names.serviceName,
        status: created.status,
        priority: input.priority,
        createdAt: created.createdAt,
        ...(input.preferredDate !== undefined ? { preferredDate: input.preferredDate } : {}),
        ...(input.preferredTime !== undefined ? { preferredTime: input.preferredTime } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.imageUrls !== undefined ? { imageUrls: [...input.imageUrls] } : {}),
        address: { ...input.address },
        ...(input.vendorId !== undefined && vendorName !== undefined
          ? { preferredVendor: { id: input.vendorId, name: vendorName } }
          : {}),
      };

      /*
        Into the table only while it is still this customer's.

        The customer can change while the call is in flight — signing out
        mid-send — and a request one customer raised must never appear in the
        next one's list. It is still saved under the customer who raised it.
      */
      if (this.loaded === null || this.loaded.customerId === customerId) {
        this.store(record);
      }

      /*
        Saved after it was accepted, never before: every refusal above has
        already thrown, so nothing that was not created can reach storage. And
        awaited, so the success screen is not shown for a request an app killed
        a moment later would have forgotten.
      */
      await this.remember(customerId, record);

      /*
        Counted, never contents.

        Notes are whatever the customer typed about their own home, the image
        URLs point at photographs of it, and the address says where it is. None
        of them belongs in a log line, and a payload logged whole is the easiest
        way for all three to end up in a crash report. Nor does the reference:
        it is what a customer quotes, and it leads straight back to the rest.
        What is useful for debugging is the shape.
      */
      log.info('Mock request created', {
        categoryId: input.categoryId,
        subCategoryId: input.subCategoryId,
        priority: input.priority,
        hasPreferredDate: input.preferredDate !== undefined,
        hasPreferredTime: input.preferredTime !== undefined,
        imageCount: input.imageUrls?.length ?? 0,
        hasNotes: Boolean(input.notes),
        /*
          ⚠️ Whether, never where.

          The address is where somebody lives, and it is the most sensitive
          thing on this payload — so what is written down is that one arrived
          and whether it brought a point with it. The address never appears in a
          log line, here or anywhere.
        */
        hasCoordinates: input.address.latitude !== undefined,
        // Which dispatch the request went out on (section 18A), without naming
        // the vendor a particular customer chose.
        dispatch: input.vendorId === undefined ? 'open' : 'directed',
      });

      return { ...created, reference: created.id };
    });
  }

  async cancelRequest(requestId: string): Promise<CancelRequestResult> {
    const customerId = await this.prepare();

    return this.simulate(async () => {
      /*
        Refused the way a backend refuses a change from nobody.

        Only when the table can tell who is asking: built without storage and a
        session it is memory only, and every test that is not about customers
        cancels as anybody. Reads and creation stay lenient as they were; a
        change to a request has to be its owner's, and with no customer — or
        no telling who it is — there is no owner to check against.
      */
      if (this.isScoped() && customerId === null) {
        throw new AppError({ kind: 'unauthorized', message: 'Mock cancel refused: no customer session' });
      }

      /*
        The customer changed while the call was in the air — signed out, and
        somebody else's table is loading or loaded. The table below is not the
        asker's any more, so nothing in it is touched: the session that asked
        has gone, and that is the answer.
      */
      if (this.loaded !== null && this.loaded.customerId !== customerId) {
        throw new AppError({
          kind: 'unauthorized',
          message: 'Mock cancel refused: the customer changed during the call',
        });
      }

      /*
        By reference, in this customer's table. Another customer's request is
        not in it, so it is not found — the same answer `getRequest` gives, which
        neither confirms nor denies that it exists.
      */
      const stored = this.requests.get(requestId);

      if (!stored) {
        throw new AppError({ kind: 'notFound', message: 'Mock cancel refused: no such request' });
      }

      // Case and padding forgiven, as `requestStateOf` forgives them.
      const status = stored.record.status.trim().toUpperCase();

      // Already cancelled: the answer to a retry whose first answer was lost.
      // Nothing changed, so nothing is saved again.
      if (status === CANCELLED_STATUS) {
        log.info('Mock request already cancelled');
        return { outcome: 'cancelled', request: toOutgoing(stored.record) };
      }

      /*
        ⚠️ Checked and changed with nothing awaited in between.

        A professional accepting it meanwhile is the race this answers: the
        request has moved past waiting, and cancelling now would mean talking to
        that professional, which Phase 1 has no channel for. Two cancellations
        at once both reach this line; JavaScript runs one to the `set` below
        before the other resumes, so the second finds it cancelled above.
      */
      if (!CANCELLABLE_STATUSES.has(status)) {
        // The status is a backend constant, never a customer's detail.
        log.info('Mock cancel refused: the request is past waiting', { status });
        return { outcome: 'refused', reason: 'notCancellable' };
      }

      /*
        The status, and nothing else. The record has no place for when it was
        cancelled, and inventing one would be a field no backend has agreed to.
        Kept at its place in the order: cancelling does not make it newer.
      */
      const cancelled: CustomerRequestDetails = { ...stored.record, status: CANCELLED_STATUS };
      this.requests.set(requestId, { record: cancelled, sequence: stored.sequence });

      /*
        Saved for a request the customer raised, as its creation was, and
        awaited so the screen never shows a cancellation an app killed a moment
        later would forget. A seeded request's is not: see `seededIds`.
      */
      if (!this.seededIds.has(requestId)) {
        await this.remember(customerId, cancelled, 'cancelled');
      }

      // Never the reference: it leads straight back to an address.
      log.info('Mock request cancelled', { from: status });

      return { outcome: 'cancelled', request: toOutgoing(cancelled) };
    });
  }
}
