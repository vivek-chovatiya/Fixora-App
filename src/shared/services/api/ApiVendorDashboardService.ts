/**
 * ApiVendorDashboardService
 *
 * VendorDashboardService against the real backend (Phase 4A, 17/11/2026;
 * PROJECT_BIBLE.md section 30). The backend has no dashboard endpoint, so the
 * dashboard is composed on the device from the one answer that holds the
 * vendor's work: `POST /requests/list`, every page, sorted into its groups by
 * `vendorWork.ts` — the same reader, the same groups and the same order the
 * request list uses.
 *
 * ⚠️ A derivation from real data, not an invented contract: the counts are the
 * lengths of the groups the list shows, and the previews their first few. No
 * figure here exists that the request list does not also show, so the two
 * cannot disagree. When a dashboard endpoint exists it replaces this read and
 * nothing above the service moves.
 *
 * ⚠️ The whole list is read to count it, at most `AppConfig.api.fullListMaxPages`
 * pages. Every open request this vendor has not declined is in it, of every
 * category (the backend checks the category on accept, not on listing), so it
 * grows with the marketplace — a recorded backend gap.
 *
 * Only the first of the request list's two answers is read: the open requests
 * this vendor declined (`declined: true`) are the rejected group, which a
 * dashboard does not show.
 *
 * Scoped by the session, as `ApiVendorRequestService` is; the rejected group is
 * not on a dashboard (it is not work the vendor has).
 */

import type { AuthUser } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import { groupVendorWork } from '@/shared/services/api/vendorWork';
import type {
  VendorDashboard,
  VendorDashboardService,
} from '@/shared/services/types/VendorDashboardService';
import { AppError } from '@/shared/types/error';

export interface ApiVendorDashboardServiceOptions {
  /** The signed-in account, or null. Asked on every call. */
  currentUser: () => Promise<AuthUser | null>;
}

export class ApiVendorDashboardService extends BaseApiService implements VendorDashboardService {
  private readonly currentUser: () => Promise<AuthUser | null>;

  constructor(options: ApiVendorDashboardServiceOptions) {
    super('/requests');
    this.currentUser = options.currentUser;
  }

  async getDashboard(previewLimit: number): Promise<VendorDashboard> {
    const user = await this.currentUser();
    if (!user || user.role !== 'vendor') {
      throw new AppError({ kind: 'unauthorized', message: 'Vendor dashboard: no vendor session' });
    }

    const list = await this.postAllPages('/list', {});
    const work = groupVendorWork(list.items, user.id);
    // A limit that is not a usable number previews nothing rather than everything.
    const limit = Number.isFinite(previewLimit) ? Math.max(0, Math.floor(previewLimit)) : 0;

    return {
      counts: {
        pending: work.pending.length,
        active: work.active.length,
        completed: work.completed.length,
        // Past the page ceiling the counts are of what was read: "at least".
        ...(list.truncated ? { isLowerBound: true } : {}),
      },
      pending: work.pending.slice(0, limit),
      active: work.active.slice(0, limit),
      recentlyCompleted: work.completed.slice(0, limit),
    };
  }
}
