/**
 * MockVendorDashboardService
 *
 * Stands in for the dashboard endpoint until there is one (Phase 3E-2). It
 * answers as a backend would: from the session, per vendor, with the whole
 * count of each group and only as many previews as it was asked for.
 *
 * ⚠️ Read-only. The fixtures are rebuilt from `mockVendorDashboardData` on every
 * call; the one thing held between calls is the vendors' answers (Phase 3E-4),
 * and that is not held here — it is the `MockVendorRequestBook` the request mock
 * writes to, handed to both, so a request accepted in the list is counted as
 * active here and one rejected is not counted at all. No storage, no timers.
 *
 * ⚠️ Not connected to the customer's mock requests. A request a customer raises
 * in this app does not appear on a vendor's dashboard: matching and dispatch
 * are the backend's (PROJECT_BIBLE.md section 18A.1) and simulating them here
 * would be inventing them. The two mocks meet when the backend does.
 */

import type { AuthUser } from '@/features/auth/types';
import {
  applyVendorAnswers,
  MockVendorRequestBook,
} from '@/shared/services/mock/MockVendorRequestBook';
import {
  buildMockVendorWork,
  mockScenarioFor,
  type MockDashboardScenario,
} from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY, simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import type {
  VendorDashboard,
  VendorDashboardService,
} from '@/shared/services/types/VendorDashboardService';
import { AppError } from '@/shared/types/error';

export interface MockVendorDashboardServiceOptions {
  /** Simulated latency. Pass `NO_LATENCY` in tests. */
  latency?: MockLatency;

  /** The signed-in account, or null. Asked on every call. */
  currentUser?: () => Promise<AuthUser | null>;

  /** Which fixture a vendor gets. Defaults to the table beside the fixtures. */
  scenarioFor?: (vendorId: string) => MockDashboardScenario;

  /** Injectable clock, so a test can pin the ages on the cards. */
  now?: () => number;

  /** Who answered what — the request mock's. A fresh, empty book when not given. */
  book?: MockVendorRequestBook;
}

export class MockVendorDashboardService implements VendorDashboardService {
  private readonly latency: MockLatency;
  private readonly currentUser?: () => Promise<AuthUser | null>;
  private readonly scenarioFor: (vendorId: string) => MockDashboardScenario;
  private readonly now: () => number;
  private readonly book: MockVendorRequestBook;

  constructor(options: MockVendorDashboardServiceOptions = {}) {
    this.latency = options.latency ?? NO_LATENCY;
    this.currentUser = options.currentUser;
    this.scenarioFor = options.scenarioFor ?? mockScenarioFor;
    this.now = options.now ?? (() => Date.now());
    this.book = options.book ?? new MockVendorRequestBook();
  }

  async getDashboard(previewLimit: number): Promise<VendorDashboard> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();
      const work = applyVendorAnswers(
        vendor.id,
        buildMockVendorWork(this.scenarioFor(vendor.id), this.now()),
        this.book,
      );

      // A limit that is not a usable number previews nothing rather than everything.
      const limit = Number.isFinite(previewLimit) ? Math.max(0, Math.floor(previewLimit)) : 0;

      return {
        counts: {
          pending: work.pending.length,
          active: work.active.length,
          completed: work.completed.length,
        },
        pending: work.pending.slice(0, limit),
        active: work.active.slice(0, limit),
        recentlyCompleted: work.completed.slice(0, limit),
      };
    }, this.latency);
  }

  /** What an authenticated vendor endpoint does to anybody else. */
  private async requireVendor(): Promise<AuthUser> {
    const user = (await this.currentUser?.()) ?? null;
    if (!user || user.role !== 'vendor') {
      throw new AppError({
        kind: 'unauthorized',
        message: 'Mock vendor dashboard: no vendor session',
      });
    }

    return user;
  }
}
