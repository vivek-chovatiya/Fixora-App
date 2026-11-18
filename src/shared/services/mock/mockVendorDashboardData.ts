/**
 * MOCK VENDOR DASHBOARD DATA — DEVELOPMENT ONLY
 *
 * The work a mock vendor has, so the dashboard can be built before there is a
 * request list behind it (Phase 3E-2). Fixtures, not records: nothing here was
 * raised by a real customer and none of it survives into a production build.
 *
 * ⚠️ Deterministic. Every job is written out; nothing is random and nothing
 * changes by itself — no timer moves a request from waiting to accepted, because
 * that would show a vendor a dispatch system that does not exist yet. The only
 * input is the clock, which turns "ninety minutes ago" into a timestamp so the
 * ages on the cards stay believable whenever the app is opened.
 *
 * ⚠️ Per vendor, by id. One vendor's jobs are reachable only through that
 * vendor's id, and a vendor nobody has written fixtures for has no work — which
 * is the truth for a business that has just finished setting up.
 *
 * The scenarios are named so a test can ask for each state a dashboard must
 * draw — nothing, only waiting, only under way, only finished, and all three —
 * without inventing data of its own.
 *
 * ⚠️ An open request is one request, whoever is looking at it (Phase 3E-4). The
 * open (broadcast) requests below are offered to more than one vendor by the
 * same reference — which is what lets one vendor accept one and the next be
 * told it is taken. What anybody did about a request is not here; that is
 * `MockVendorRequestBook`, applied on top.
 */

import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';

export type MockDashboardScenario =
  | 'empty'
  | 'pendingOnly'
  | 'activeOnly'
  | 'completedOnly'
  | 'mixed'
  /** A vendor who has only just set up: the open requests in their trade, and nothing of their own. */
  | 'openOnly';

/** Every job a vendor has, already in the order the dashboard previews it. */
export interface MockVendorWork {
  /** Waiting for the vendor, newest first. */
  pending: VendorJobSummary[];
  /** Under way, the furthest along first. */
  active: VendorJobSummary[];
  /** Finished, most recently finished first. */
  completed: VendorJobSummary[];
}

const MS_PER_MINUTE = 60_000;
const HOUR = 60;
const DAY = 24 * HOUR;

/** A job as the fixture writes it: ages in minutes instead of timestamps. */
interface JobSeed extends Omit<VendorJobSummary, 'createdAt' | 'completedAt'> {
  raisedMinutesAgo: number;
  completedMinutesAgo?: number;
}

const PENDING: readonly JobSeed[] = [
  {
    id: 'REQ-31042',
    serviceName: 'Switchboard repair',
    customerName: 'Asha Patel',
    locality: 'Koramangala',
    priority: 'EMERGENCY',
    status: 'PENDING_VENDOR',
    dispatch: 'broadcast',
    raisedMinutesAgo: 12,
  },
  {
    id: 'REQ-31038',
    serviceName: 'Ceiling fan installation',
    customerName: 'Rahul Menon',
    locality: 'HSR Layout',
    priority: 'MEDIUM',
    status: 'PENDING_VENDOR',
    dispatch: 'directed',
    raisedMinutesAgo: 55,
  },
  {
    // The stress case: every field long enough to wrap or truncate at 360dp.
    id: 'REQ-2026-BLR-EAST-0031021',
    serviceName: 'Full house wiring inspection before tenancy handover',
    customerName: 'Venkata Subrahmanya Lakshmi Narasimhamurthy-Ramachandran',
    locality: 'Hoysala Nagar, Indiranagar 2nd Stage Extension',
    priority: 'HIGH',
    status: 'PENDING_VENDOR',
    dispatch: 'broadcast',
    raisedMinutesAgo: 3 * HOUR,
  },
  {
    id: 'REQ-30987',
    serviceName: 'Light fitting replacement',
    customerName: 'Neha Sharma',
    // No locality: the backend does not always say, and the card must cope.
    priority: 'LOW',
    status: 'PENDING_VENDOR',
    raisedMinutesAgo: 9 * HOUR,
  },
];

const ACTIVE: readonly JobSeed[] = [
  {
    id: 'REQ-30954',
    serviceName: 'Inverter installation',
    customerName: 'Imran Sheikh',
    locality: 'BTM Layout',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    raisedMinutesAgo: DAY + 2 * HOUR,
  },
  {
    id: 'REQ-30961',
    serviceName: 'MCB replacement',
    customerName: 'Divya Rao',
    locality: 'Koramangala',
    priority: 'MEDIUM',
    status: 'ACCEPTED',
    raisedMinutesAgo: 20 * HOUR,
  },
];

const COMPLETED: readonly JobSeed[] = [
  {
    id: 'REQ-30912',
    serviceName: 'Geyser wiring',
    customerName: 'Karthik Iyer',
    locality: 'HSR Layout',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    raisedMinutesAgo: 2 * DAY,
    completedMinutesAgo: DAY + 4 * HOUR,
  },
  {
    id: 'REQ-30876',
    serviceName: 'Doorbell installation',
    customerName: 'Sana Khan',
    locality: 'Indiranagar',
    priority: 'LOW',
    status: 'CLOSED',
    raisedMinutesAgo: 4 * DAY,
    completedMinutesAgo: 3 * DAY,
  },
  {
    id: 'REQ-30833',
    serviceName: 'Socket replacement',
    customerName: 'Joseph Mathew',
    locality: 'Koramangala',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    raisedMinutesAgo: 6 * DAY,
    completedMinutesAgo: 5 * DAY,
  },
  {
    id: 'REQ-30790',
    serviceName: 'Earthing check',
    customerName: 'Pooja Nair',
    locality: 'BTM Layout',
    priority: 'HIGH',
    status: 'CLOSED',
    raisedMinutesAgo: 9 * DAY,
    completedMinutesAgo: 8 * DAY,
  },
  {
    id: 'REQ-30744',
    serviceName: 'Tube light replacement',
    customerName: 'Arjun Das',
    locality: 'HSR Layout',
    priority: 'LOW',
    status: 'COMPLETED',
    raisedMinutesAgo: 12 * DAY,
    completedMinutesAgo: 11 * DAY,
  },
];

const SCENARIOS: Readonly<Record<MockDashboardScenario, Record<keyof MockVendorWork, readonly JobSeed[]>>> =
  Object.freeze({
    empty: { pending: [], active: [], completed: [] },
    pendingOnly: { pending: PENDING, active: [], completed: [] },
    activeOnly: { pending: [], active: ACTIVE, completed: [] },
    completedOnly: { pending: [], active: [], completed: COMPLETED },
    mixed: { pending: PENDING, active: ACTIVE, completed: COMPLETED },
    // Broadcast only: a directed request was the customer choosing somebody else.
    openOnly: {
      pending: PENDING.filter(seed => seed.dispatch === 'broadcast'),
      active: [],
      completed: [],
    },
  });

/**
 * Which vendor has which work.
 *
 * Ravi (`usr_vendor_1`) has been trading a while. Meena (`usr_vendor_2`) has
 * just set up in the same trade: she is offered the same two open requests Ravi
 * is, and nothing else of his — not the request a customer sent him directly,
 * not his work under way, not his finished jobs. That is what makes both "the
 * first to accept wins" and "Vendor B sees nothing of Vendor A's own" checkable
 * by signing in rather than by reading this file (Phase 3E-4; until then Meena
 * had nothing at all). Any vendor registered in the app has nothing.
 */
const VENDOR_SCENARIOS: Readonly<Record<string, MockDashboardScenario>> = Object.freeze({
  usr_vendor_1: 'mixed',
  usr_vendor_2: 'openOnly',
});

export function mockScenarioFor(vendorId: string): MockDashboardScenario {
  return VENDOR_SCENARIOS[vendorId] ?? 'empty';
}

function stamp(seed: JobSeed, nowMs: number): VendorJobSummary {
  const { raisedMinutesAgo, completedMinutesAgo, ...job } = seed;

  return {
    ...job,
    // This "backend" quotes its requests by their ids, so each id is its reference too.
    reference: job.id,
    createdAt: new Date(nowMs - raisedMinutesAgo * MS_PER_MINUTE).toISOString(),
    ...(completedMinutesAgo === undefined
      ? {}
      : { completedAt: new Date(nowMs - completedMinutesAgo * MS_PER_MINUTE).toISOString() }),
  };
}

/** A scenario's work, timestamped against the given clock. Fresh objects each call. */
export function buildMockVendorWork(scenario: MockDashboardScenario, nowMs: number): MockVendorWork {
  const seeds = SCENARIOS[scenario];

  return {
    pending: seeds.pending.map(seed => stamp(seed, nowMs)),
    active: seeds.active.map(seed => stamp(seed, nowMs)),
    completed: seeds.completed.map(seed => stamp(seed, nowMs)),
  };
}
