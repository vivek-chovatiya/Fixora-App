/**
 * VendorDashboardService
 *
 * What the vendor's dashboard shows about their work (PROJECT_BIBLE.md section
 * 30; Phase 3E-2): how much is waiting, how much is under way, how much is
 * done, and a few of each to look at.
 *
 * ⚠️ A summary, not the request list. It carries counts and short previews and
 * nothing a vendor acts on — accepting, rejecting and moving work along belong
 * to the request list and its details (sections 31–36) and will have a service
 * of their own. Nothing here can change a request.
 *
 * ⚠️ The service sorts work into its three groups; the app does not. Which
 * backend statuses count as "waiting for this vendor", "under way" or "done" is
 * the backend's knowledge (section 21: the frontend never invents statuses, and
 * section 34: it follows backend transitions). The dashboard is handed three
 * lists and draws them. Each job still carries its own status verbatim, because
 * "Accepted" and "In progress" are both under way and a vendor needs to see
 * which.
 *
 * ⚠️ No business identity. The business name, its services and its area are
 * the vendor profile's (`VendorProfileService`), and a second copy here would
 * be a second answer that could disagree with the first.
 *
 * Scoped by the session: the backend knows which vendor is asking from the
 * token, so no vendor id is passed and none can be asked for.
 */

import type { RequestStatus } from '@/shared/services/types/RequestService';

/**
 * How a waiting request reached this vendor (section 31.1).
 *
 * `directed` — the customer chose this vendor; it is theirs to take or decline.
 * `broadcast` — open dispatch; other vendors can see it and may take it first.
 *
 * Routing, not status (section 21). Optional because section 31.1 says "if the
 * backend distinguishes these": when it does not, the field is absent and the
 * request is simply new.
 */
export type VendorJobDispatch = 'directed' | 'broadcast';

/**
 * One request, as much of it as a dashboard preview shows.
 *
 * Section 31's card fields — reference, service, customer, priority, date,
 * status — and the locality, so a vendor can tell roughly where a job is.
 *
 * ⚠️ Never the address. Where exactly the work is belongs to the request's
 * details (section 32), behind the vendor opening it; a dashboard is glanced at
 * in public and its records are logged and cached more freely.
 */
export interface VendorJobSummary {
  /** Backend reference, the one the customer quotes too. */
  id: string;
  /** Rendered, never matched against a known list (section 11). */
  serviceName: string;
  customerName: string;
  /** The neighbourhood only. Absent when the backend does not say. */
  locality?: string;
  /** Backend constant (section 15), shown through `presentPriority`. */
  priority: string;
  /** Backend status (section 21), exactly as it was sent. */
  status: RequestStatus;
  /** Only on waiting requests, and only when the backend says. */
  dispatch?: VendorJobDispatch;
  /** ISO-8601 instant the customer raised it. */
  createdAt: string;
  /** ISO-8601 instant the work was finished. Present on completed work. */
  completedAt?: string;
  /**
   * ISO-8601 instant this vendor declined it. Only on a request they rejected
   * (the request list's `rejected` group, and the request opened from it), and
   * only when the backend says — never on a dashboard, which does not show what
   * was declined.
   */
  rejectedAt?: string;
}

/** The whole of each group, however few of them are previewed. */
export interface VendorDashboardCounts {
  /** Waiting for this vendor to take or decline. */
  pending: number;
  /** Taken, and not finished. */
  active: number;
  completed: number;
}

export interface VendorDashboard {
  counts: VendorDashboardCounts;
  /** The most recent waiting requests, newest first. */
  pending: VendorJobSummary[];
  /** Work under way, the furthest along first. */
  active: VendorJobSummary[];
  /** The latest finished work, most recently finished first. */
  recentlyCompleted: VendorJobSummary[];
}

export interface VendorDashboardService {
  /**
   * The signed-in vendor's dashboard.
   *
   * `previewLimit` caps each preview list — the counts are always the whole of
   * each group. Sent to the service rather than trimmed on arrival, for the
   * reason customer Home sends its limit: a summary should not fetch a page to
   * throw most of it away.
   *
   * A vendor with no work gets zero counts and empty lists, not an error.
   * Rejects with `unauthorized` without a signed-in vendor.
   */
  getDashboard(previewLimit: number): Promise<VendorDashboard>;
}
