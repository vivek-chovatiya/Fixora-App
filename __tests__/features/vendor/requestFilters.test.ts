/**
 * What each request filter means (PROJECT_BIBLE.md section 31, Phase 3E-3).
 *
 * Pinned, because "All" is the one a list gets wrong quietly:
 *
 * - All is the work, in the order pending → active → completed, each group
 *   under a heading with its count; an empty group is left out, not drawn empty
 * - All never holds what the vendor declined (owner decision, 2026-10-21):
 *   Rejected is a filter of its own, offered last
 * - Pending, Active, Completed and Rejected are that group alone, in the
 *   service's order, with no heading
 * - a filter never reorders, drops or duplicates a request
 */

import {
  VENDOR_REQUEST_FILTERS,
  vendorRequestLinesFor,
  type VendorRequestLine,
} from '@/features/vendor/constants/requestFilters';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import type { VendorRequestList } from '@/shared/services/types/VendorRequestService';

function job(id: string, status = 'PENDING_VENDOR'): VendorJobSummary {
  return {
    id,
    serviceName: `Service ${id}`,
    customerName: 'A Customer',
    priority: 'MEDIUM',
    status,
    createdAt: '2026-09-30T10:00:00.000Z',
  };
}

const MIXED: VendorRequestList = {
  pending: [job('P1'), job('P2')],
  active: [job('A1', 'IN_PROGRESS')],
  completed: [job('C1', 'COMPLETED'), job('C2', 'CLOSED'), job('C3', 'COMPLETED')],
  rejected: [job('R2', 'REJECTED'), job('R1', 'REJECTED')],
};

const EMPTY: VendorRequestList = { pending: [], active: [], completed: [], rejected: [] };

const describeLine = (line: VendorRequestLine) =>
  line.kind === 'heading' ? `# ${line.title} (${line.count})` : line.job.id;

describe('vendor request filters', () => {
  it('offers All, Pending, Active, Completed and Rejected, in that order', () => {
    expect(VENDOR_REQUEST_FILTERS.map(filter => filter.value)).toEqual([
      'all',
      'pending',
      'active',
      'completed',
      'rejected',
    ]);
  });

  it('leaves what was declined out of All — it is not work — whatever else there is', () => {
    const everything = vendorRequestLinesFor(MIXED, 'all').map(describeLine);

    expect(everything).not.toContain('R1');
    expect(everything).not.toContain('R2');
    expect(everything.filter(line => line.startsWith('#'))).toEqual([
      '# Pending (2)',
      '# Active (1)',
      '# Completed (3)',
    ]);
    // Only declined requests: All has nothing to show, and says so.
    expect(vendorRequestLinesFor({ ...EMPTY, rejected: MIXED.rejected }, 'all')).toEqual([]);
  });

  it('shows everything under All, grouped and counted, pending first', () => {
    expect(vendorRequestLinesFor(MIXED, 'all').map(describeLine)).toEqual([
      '# Pending (2)',
      'P1',
      'P2',
      '# Active (1)',
      'A1',
      '# Completed (3)',
      'C1',
      'C2',
      'C3',
    ]);
  });

  it('leaves an empty group out of All rather than drawing an empty heading', () => {
    const list = { ...MIXED, active: [] };

    expect(vendorRequestLinesFor(list, 'all').map(describeLine)).toEqual([
      '# Pending (2)',
      'P1',
      'P2',
      '# Completed (3)',
      'C1',
      'C2',
      'C3',
    ]);
  });

  it.each([
    ['pending', ['P1', 'P2']],
    ['active', ['A1']],
    ['completed', ['C1', 'C2', 'C3']],
    ['rejected', ['R2', 'R1']],
  ] as const)('shows only the %s group, in the service’s order, with no heading', (filter, ids) => {
    expect(vendorRequestLinesFor(MIXED, filter).map(describeLine)).toEqual(ids);
  });

  it.each(['all', 'pending', 'active', 'completed', 'rejected'] as const)(
    'has nothing to show under %s when there are no requests',
    filter => {
      expect(vendorRequestLinesFor(EMPTY, filter)).toEqual([]);
    },
  );

  it('has nothing to show under a filter whose group is empty, whatever else there is', () => {
    expect(vendorRequestLinesFor({ ...MIXED, active: [] }, 'active')).toEqual([]);
  });

  it('counts every request exactly once under All', () => {
    const requests = vendorRequestLinesFor(MIXED, 'all').filter(line => line.kind === 'request');

    expect(requests).toHaveLength(6);
    expect(new Set(requests.map(line => line.key)).size).toBe(6);
  });

  it('keeps its keys unique even if the backend lists one request in two groups', () => {
    const twice = { ...MIXED, active: [job('P1', 'ACCEPTED')] };
    const keys = vendorRequestLinesFor(twice, 'all').map(line => line.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
