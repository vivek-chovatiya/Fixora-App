/**
 * Confirmed actions laid over the last read of the request list (Phases 3E-4
 * and 3E-5): what `applySettledAnswers` shows and when `pruneSettledAnswers`
 * lets the service's read take over.
 *
 * Pinned here:
 *
 * - accept moves a request from Pending to the end of Active; reject moves it
 *   to the top of Rejected (2026-10-21); one no longer this vendor's to answer
 *   leaves the list; start changes it in place; complete moves it to the top of
 *   Completed
 * - a second action before the read caught up builds on the first
 * - a read that no longer shows the request where and as it was before the
 *   action has caught up: the entry stops applying and is pruned
 * - neither input is changed
 */

import {
  applySettledAnswers,
  pruneSettledAnswers,
  type SettledAnswers,
  type SettledChange,
} from '@/features/vendor/hooks/useVendorRequests';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import type { VendorRequestList } from '@/shared/services/types/VendorRequestService';

function job(id: string, status: string): VendorJobSummary {
  return {
    id,
    serviceName: `Service ${id}`,
    customerName: 'Customer',
    priority: 'MEDIUM',
    status,
    createdAt: '2026-10-05T10:00:00.000Z',
  };
}

const READ: VendorRequestList = {
  pending: [job('P1', 'PENDING_VENDOR'), job('P2', 'PENDING_VENDOR')],
  active: [job('A1', 'IN_PROGRESS'), job('A2', 'ACCEPTED')],
  completed: [job('C1', 'COMPLETED')],
  rejected: [job('R1', 'REJECTED')],
};

const ids = (list: VendorRequestList) => ({
  pending: list.pending.map(item => `${item.id}:${item.status}`),
  active: list.active.map(item => `${item.id}:${item.status}`),
  completed: list.completed.map(item => `${item.id}:${item.status}`),
  rejected: list.rejected.map(item => `${item.id}:${item.status}`),
});

const settled = (...entries: Array<[string, SettledChange]>): SettledAnswers => new Map(entries);

describe('applySettledAnswers', () => {
  it('shows the read as it is with nothing settled', () => {
    expect(applySettledAnswers(READ, new Map())).toBe(READ);
  });

  it('moves an accepted request from Pending to the end of Active', () => {
    const shown = applySettledAnswers(
      READ,
      settled([
        'P1',
        {
          from: { group: 'pending', status: 'PENDING_VENDOR' },
          to: { group: 'active', request: job('P1', 'ACCEPTED') },
        },
      ]),
    );

    expect(ids(shown)).toEqual({
      pending: ['P2:PENDING_VENDOR'],
      active: ['A1:IN_PROGRESS', 'A2:ACCEPTED', 'P1:ACCEPTED'],
      completed: ['C1:COMPLETED'],
      rejected: ['R1:REJECTED'],
    });
  });

  it('moves a rejected request from Pending to the top of Rejected, the latest declined first', () => {
    const shown = applySettledAnswers(
      READ,
      settled([
        'P2',
        {
          from: { group: 'pending', status: 'PENDING_VENDOR' },
          to: { group: 'rejected', request: job('P2', 'REJECTED') },
        },
      ]),
    );

    expect(ids(shown)).toEqual({
      pending: ['P1:PENDING_VENDOR'],
      active: ['A1:IN_PROGRESS', 'A2:ACCEPTED'],
      completed: ['C1:COMPLETED'],
      rejected: ['P2:REJECTED', 'R1:REJECTED'],
    });
  });

  it('takes a request that is no longer this vendor’s to answer out of the list', () => {
    const shown = applySettledAnswers(
      READ,
      settled(['P2', { from: { group: 'pending', status: 'PENDING_VENDOR' }, to: null }]),
    );

    expect(ids(shown).pending).toEqual(['P1:PENDING_VENDOR']);
    expect(ids(shown).active).toEqual(['A1:IN_PROGRESS', 'A2:ACCEPTED']);
    expect(ids(shown).rejected).toEqual(['R1:REJECTED']);
  });

  it('does not list a rejection twice once the read already has it declined', () => {
    // The read has caught up with the rejection in Rejected, but not yet in Pending.
    const both: VendorRequestList = { ...READ, rejected: [job('P2', 'REJECTED'), job('R1', 'REJECTED')] };
    const shown = applySettledAnswers(
      both,
      settled([
        'P2',
        {
          from: { group: 'pending', status: 'PENDING_VENDOR' },
          to: { group: 'rejected', request: job('P2', 'REJECTED') },
        },
      ]),
    );

    expect(ids(shown).pending).toEqual(['P1:PENDING_VENDOR']);
    expect(ids(shown).rejected).toEqual(['P2:REJECTED', 'R1:REJECTED']);
  });

  it('changes started work in place', () => {
    const shown = applySettledAnswers(
      READ,
      settled([
        'A2',
        {
          from: { group: 'active', status: 'ACCEPTED' },
          to: { group: 'active', request: job('A2', 'IN_PROGRESS') },
        },
      ]),
    );

    expect(ids(shown).active).toEqual(['A1:IN_PROGRESS', 'A2:IN_PROGRESS']);
  });

  it('moves completed work from Active to the top of Completed', () => {
    const shown = applySettledAnswers(
      READ,
      settled([
        'A1',
        {
          from: { group: 'active', status: 'IN_PROGRESS' },
          to: { group: 'completed', request: job('A1', 'COMPLETED') },
        },
      ]),
    );

    expect(ids(shown)).toEqual({
      pending: ['P1:PENDING_VENDOR', 'P2:PENDING_VENDOR'],
      active: ['A2:ACCEPTED'],
      completed: ['A1:COMPLETED', 'C1:COMPLETED'],
      rejected: ['R1:REJECTED'],
    });
  });

  it('builds a second action on the first before the read caught up: accepted, then completed', () => {
    const shown = applySettledAnswers(
      READ,
      settled([
        'P1',
        {
          from: { group: 'pending', status: 'PENDING_VENDOR' },
          to: { group: 'completed', request: job('P1', 'COMPLETED') },
        },
      ]),
    );

    expect(ids(shown).pending).toEqual(['P2:PENDING_VENDOR']);
    expect(ids(shown).completed).toEqual(['P1:COMPLETED', 'C1:COMPLETED']);
  });

  it('lets a read that has caught up win', () => {
    const caughtUp: VendorRequestList = { ...READ, active: [job('A1', 'IN_PROGRESS'), job('A2', 'IN_PROGRESS')] };
    const change: SettledChange = {
      from: { group: 'active', status: 'ACCEPTED' },
      // Whatever the entry says, the read is newer.
      to: { group: 'completed', request: job('A2', 'COMPLETED') },
    };

    expect(ids(applySettledAnswers(caughtUp, settled(['A2', change])))).toEqual(ids(caughtUp));
  });

  it('changes neither the read nor the entries', () => {
    const before = JSON.stringify(READ);
    const entries = settled(['P1', { from: { group: 'pending', status: 'PENDING_VENDOR' }, to: null }]);

    applySettledAnswers(READ, entries);

    expect(JSON.stringify(READ)).toBe(before);
    expect(entries.size).toBe(1);
  });
});

describe('pruneSettledAnswers', () => {
  const started: SettledChange = {
    from: { group: 'active', status: 'ACCEPTED' },
    to: { group: 'active', request: job('A2', 'IN_PROGRESS') },
  };

  it('keeps an entry while the read still shows the request as it was', () => {
    const entries = settled(['A2', started]);

    expect(pruneSettledAnswers(entries, READ)).toBe(entries);
  });

  it('drops it once the read shows the request changed, moved or gone', () => {
    const entries = settled(['A2', started]);

    expect(pruneSettledAnswers(entries, { ...READ, active: [job('A2', 'IN_PROGRESS')] }).size).toBe(0);
    expect(pruneSettledAnswers(entries, { ...READ, active: [] }).size).toBe(0);
  });

  it('drops an answered request once the read no longer has it waiting (3E-4)', () => {
    const entries = settled(['P1', { from: { group: 'pending', status: 'PENDING_VENDOR' }, to: null }]);

    expect(pruneSettledAnswers(entries, { ...READ, pending: [job('P2', 'PENDING_VENDOR')] }).size).toBe(0);
  });

  it('drops a rejection once the read lists it declined rather than waiting (2026-10-21)', () => {
    const entries = settled([
      'P1',
      {
        from: { group: 'pending', status: 'PENDING_VENDOR' },
        to: { group: 'rejected', request: job('P1', 'REJECTED') },
      },
    ]);
    const caughtUp: VendorRequestList = {
      ...READ,
      pending: [job('P2', 'PENDING_VENDOR')],
      rejected: [job('P1', 'REJECTED'), job('R1', 'REJECTED')],
    };

    expect(pruneSettledAnswers(entries, READ)).toBe(entries);
    expect(pruneSettledAnswers(entries, caughtUp).size).toBe(0);
  });
});
