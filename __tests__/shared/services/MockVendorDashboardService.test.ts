/**
 * The mock vendor dashboard (PROJECT_BIBLE.md section 30, Phase 3E-2).
 *
 * It stands in for a backend, so what is pinned here is the backend's side:
 *
 * - every state a dashboard must draw is reachable: nothing, only waiting, only
 *   under way, only finished, and all three
 * - counts are the whole of each group; previews are capped by the caller
 * - the answer is deterministic — the only input besides the vendor is the clock
 * - it is scoped to the signed-in vendor, and one never sees another's work
 * - it refuses without a vendor, and a customer is not a vendor
 * - a preview never carries an address
 */

import type { AuthUser } from '@/features/auth/types';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import {
  mockScenarioFor,
  type MockDashboardScenario,
} from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { AppError } from '@/shared/types/error';

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const MEENA: AuthUser = { ...RAVI, id: 'usr_vendor_2', firstName: 'Meena', phone: '9000000002' };

const ASHA: AuthUser = { ...RAVI, id: 'usr_customer_1', firstName: 'Asha', role: 'customer' };

/** Noon on a fixed day, so every age on every card is a known number. */
const NOW = new Date('2026-09-30T12:00:00.000Z').getTime();

let user: AuthUser | null;

function service(scenario?: MockDashboardScenario) {
  return new MockVendorDashboardService({
    latency: NO_LATENCY,
    currentUser: async () => user,
    now: () => NOW,
    ...(scenario ? { scenarioFor: () => scenario } : {}),
  });
}

async function kindOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (caught) {
    return AppError.from(caught).kind;
  }
  return 'resolved';
}

beforeEach(() => {
  user = RAVI;
});

describe('MockVendorDashboardService — the states a dashboard must draw', () => {
  it('answers a vendor with no work with zeros and empty lists, not an error', async () => {
    await expect(service('empty').getDashboard(3)).resolves.toEqual({
      counts: { pending: 0, active: 0, completed: 0 },
      pending: [],
      active: [],
      recentlyCompleted: [],
    });
  });

  it('can hold only waiting requests', async () => {
    const dashboard = await service('pendingOnly').getDashboard(3);

    expect(dashboard.counts).toEqual({ pending: 4, active: 0, completed: 0 });
    expect(dashboard.pending).toHaveLength(3);
    expect(dashboard.active).toEqual([]);
    expect(dashboard.recentlyCompleted).toEqual([]);
  });

  it('can hold only work under way', async () => {
    const dashboard = await service('activeOnly').getDashboard(3);

    expect(dashboard.counts).toEqual({ pending: 0, active: 2, completed: 0 });
    expect(dashboard.active.map(job => job.status)).toEqual(['IN_PROGRESS', 'ACCEPTED']);
  });

  it('can hold only finished work', async () => {
    const dashboard = await service('completedOnly').getDashboard(3);

    expect(dashboard.counts).toEqual({ pending: 0, active: 0, completed: 5 });
    expect(dashboard.recentlyCompleted).toHaveLength(3);
    expect(dashboard.recentlyCompleted.every(job => job.completedAt !== undefined)).toBe(true);
  });

  it('holds all three at once', async () => {
    const dashboard = await service('mixed').getDashboard(3);

    expect(dashboard.counts).toEqual({ pending: 4, active: 2, completed: 5 });
    expect(dashboard.pending).toHaveLength(3);
    expect(dashboard.active).toHaveLength(2);
    expect(dashboard.recentlyCompleted).toHaveLength(3);
  });
});

describe('MockVendorDashboardService — counts and previews', () => {
  it('counts the whole group however few are previewed', async () => {
    const one = await service('mixed').getDashboard(1);

    expect(one.pending).toHaveLength(1);
    expect(one.counts.pending).toBe(4);
  });

  it('previews everything when the limit is larger than the group', async () => {
    const all = await service('mixed').getDashboard(50);

    expect(all.pending).toHaveLength(4);
    expect(all.recentlyCompleted).toHaveLength(5);
  });

  it.each([0, -2, Number.NaN])('previews nothing for a limit of %p', async limit => {
    const dashboard = await service('mixed').getDashboard(limit);

    expect(dashboard.pending).toEqual([]);
    expect(dashboard.counts.pending).toBe(4);
  });

  it('lists waiting requests newest first and finished work latest first', async () => {
    const dashboard = await service('mixed').getDashboard(50);

    const raised = dashboard.pending.map(job => Date.parse(job.createdAt));
    expect(raised).toEqual([...raised].sort((a, b) => b - a));

    const finished = dashboard.recentlyCompleted.map(job => Date.parse(job.completedAt ?? ''));
    expect(finished).toEqual([...finished].sort((a, b) => b - a));
  });

  it('says how a waiting request arrived when it knows, and nothing when it does not', async () => {
    const { pending } = await service('mixed').getDashboard(50);

    expect(pending.map(job => job.dispatch)).toEqual(['broadcast', 'directed', 'broadcast', undefined]);
  });

  it('never carries an address — the locality at most', async () => {
    const dashboard = await service('mixed').getDashboard(50);
    const jobs = [...dashboard.pending, ...dashboard.active, ...dashboard.recentlyCompleted];

    for (const job of jobs) {
      expect(Object.keys(job)).not.toEqual(expect.arrayContaining(['address']));
      expect(Object.keys(job)).not.toEqual(expect.arrayContaining(['formattedAddress']));
    }
  });
});

describe('MockVendorDashboardService — deterministic', () => {
  it('gives the same answer every time for the same vendor and clock', async () => {
    const first = await service('mixed').getDashboard(3);
    const second = await service('mixed').getDashboard(3);

    expect(second).toEqual(first);
  });

  it('dates every job from the clock it is given', async () => {
    const { pending } = await service('mixed').getDashboard(1);

    // The newest waiting request was raised twelve minutes before "now".
    expect(Date.parse(pending[0].createdAt)).toBe(NOW - 12 * 60_000);
  });

  it('hands back fresh objects, so a caller cannot edit the fixtures', async () => {
    const dashboards = service('mixed');
    const first = await dashboards.getDashboard(3);
    first.pending[0].serviceName = 'changed';
    first.pending.length = 0;

    const second = await dashboards.getDashboard(3);
    expect(second.pending).toHaveLength(3);
    expect(second.pending[0].serviceName).not.toBe('changed');
  });
});

describe('MockVendorDashboardService — whose dashboard', () => {
  it('gives the seeded vendor work, the second only the open requests, and everybody else none', () => {
    expect(mockScenarioFor('usr_vendor_1')).toBe('mixed');
    // Since 3E-4: the same open requests as the first, so one can be taken from the other.
    expect(mockScenarioFor('usr_vendor_2')).toBe('openOnly');
    expect(mockScenarioFor('usr_vendor_just_registered')).toBe('empty');
  });

  it('never shows one vendor another vendor’s work', async () => {
    // The default table, one service instance, as the running app has it.
    const dashboards = service();

    const ravi = await dashboards.getDashboard(3);
    expect(ravi.counts.pending).toBe(4);

    // Only the two requests that were sent to everybody — none of Ravi's own.
    user = MEENA;
    const meena = await dashboards.getDashboard(3);
    expect(meena.counts).toEqual({ pending: 2, active: 0, completed: 0 });
    expect(meena.pending.map(job => job.id)).toEqual(['REQ-31042', 'REQ-2026-BLR-EAST-0031021']);
    expect(meena.pending.every(job => job.dispatch === 'broadcast')).toBe(true);
    expect(meena.active).toEqual([]);
    expect(meena.recentlyCompleted).toEqual([]);

    user = RAVI;
    await expect(dashboards.getDashboard(3)).resolves.toEqual(ravi);
  });

  it('refuses when nobody is signed in', async () => {
    user = null;

    expect(await kindOf(() => service('mixed').getDashboard(3))).toBe('unauthorized');
  });

  it('refuses a customer', async () => {
    user = ASHA;

    expect(await kindOf(() => service('mixed').getDashboard(3))).toBe('unauthorized');
  });
});
