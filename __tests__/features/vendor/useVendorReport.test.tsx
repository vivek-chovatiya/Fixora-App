/**
 * useVendorReport, render by render (PROJECT_BIBLE.md section 42).
 *
 * The screen suite sees the report once everything has settled; this one
 * records every render the hook goes through, because the mistake it guards
 * against lives between them. When the period changes, the shared query still
 * holds the old period's figures — or its failure — for the render before the
 * new read starts, and keeps the old figures beside a failure of the new one.
 * Pinned here:
 *
 * - no render ever shows one period's figures, or its failure, under another
 * - the new period reads as loading from the very first render after the choice
 * - the service is asked for the chosen key only, and a retry asks for it again
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import {
  DEFAULT_REPORT_PERIOD,
  useVendorReport,
  type VendorReportState,
} from '@/features/vendor/hooks/useVendorReport';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  VendorReport,
  VendorReportPeriod,
  VendorReportService,
} from '@/shared/services/types/VendorReportService';
import { AppError } from '@/shared/types/error';

interface Rendered {
  period: VendorReportPeriod;
  /** Whose figures were handed to the screen, by the period they say they are for. */
  shown?: VendorReportPeriod;
  isLoading: boolean;
  failed: boolean;
  isStale: boolean;
}

const reportFor = (period: VendorReportPeriod, total: number): VendorReport => ({
  period,
  totalRequests: total,
  completedRequests: 0,
  rejectedRequests: 0,
  cancelledRequests: 0,
  averageRating: null,
  ratingCount: 0,
});

const offline = () => new AppError({ kind: 'network', message: 'offline' });

function held<T>() {
  let land!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    land = resolve;
    fail = reject;
  });
  return { promise, land, fail };
}

let renders: Rendered[];
let latest: VendorReportState;
let getReport: jest.Mock<Promise<VendorReport>, [VendorReportPeriod]>;
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

function Probe() {
  const state = useVendorReport();
  latest = state;
  renders.push({
    period: state.period,
    shown: state.report?.period,
    isLoading: state.isLoading,
    failed: state.error !== null,
    isStale: state.isStale,
  });
  return null;
}

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {});
  }
}

async function mount() {
  await act(async () => {
    mounted.push(ReactTestRenderer.create(<Probe />));
  });
  await flush();
}

async function choose(period: VendorReportPeriod) {
  await act(async () => {
    latest.selectPeriod(period);
  });
  await flush();
}

beforeEach(() => {
  resetServices();
  renders = [];
  getReport = jest.fn(async (period: VendorReportPeriod) => reportFor(period, 7));
  registerService('vendorReports', { getReport } as unknown as VendorReportService);
});

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
  resetServices();
});

describe('useVendorReport — one period at a time, on every render', () => {
  it('opens on Today, loading from the first render', async () => {
    await mount();

    expect(DEFAULT_REPORT_PERIOD).toBe('today');
    expect(renders[0]).toMatchObject({ period: 'today', isLoading: true, failed: false });
    expect(renders[0].shown).toBeUndefined();
    expect(latest.report).toEqual(reportFor('today', 7));
    expect(getReport.mock.calls).toEqual([['today']]);
  });

  it('never renders the old period’s figures under the new choice, not even before its read starts', async () => {
    await mount();
    const week = held<VendorReport>();
    getReport.mockReturnValueOnce(week.promise);
    renders = [];

    await choose('week');

    // The first render after the choice already says loading, with nothing shown.
    expect(renders[0]).toMatchObject({ period: 'week', isLoading: true });
    expect(renders[0].shown).toBeUndefined();
    for (const render of renders) {
      expect(render.shown).toBeUndefined();
    }

    await act(async () => {
      week.land(reportFor('week', 15));
    });
    await flush();

    expect(latest.report).toEqual(reportFor('week', 15));
    for (const render of renders) {
      expect([undefined, render.period]).toContain(render.shown);
    }
  });

  it('never renders the old period’s failure under the new choice', async () => {
    getReport.mockRejectedValueOnce(offline());
    await mount();
    expect(latest.error).not.toBeNull();
    const week = held<VendorReport>();
    getReport.mockReturnValueOnce(week.promise);
    renders = [];

    await choose('week');

    for (const render of renders) {
      expect(render).toMatchObject({ period: 'week', failed: false, isLoading: true });
    }

    await act(async () => {
      week.land(reportFor('week', 15));
    });
    await flush();
    expect(latest.error).toBeNull();
    expect(latest.report?.period).toBe('week');
  });

  it('turns the new period’s failure into an error, never a stale report of the old one', async () => {
    await mount();
    getReport.mockRejectedValueOnce(offline());
    renders = [];

    await choose('week');

    expect(latest.report).toBeUndefined();
    expect(latest.error?.kind).toBe('network');
    expect(latest.isStale).toBe(false);
    for (const render of renders) {
      expect(render.shown).toBeUndefined();
      expect(render.isStale).toBe(false);
    }
  });

  it('keeps the newest choice whatever order the answers arrive in', async () => {
    await mount();
    const week = held<VendorReport>();
    const month = held<VendorReport>();
    getReport.mockReturnValueOnce(week.promise).mockReturnValueOnce(month.promise);
    renders = [];

    await choose('week');
    await choose('month');
    await act(async () => {
      month.land(reportFor('month', 48));
    });
    await flush();
    await act(async () => {
      week.land(reportFor('week', 15));
    });
    await flush();

    expect(latest.period).toBe('month');
    expect(latest.report).toEqual(reportFor('month', 48));
    for (const render of renders) {
      expect([undefined, render.period]).toContain(render.shown);
    }
  });

  it('files an answer under the period it was asked for, whatever label the server put on it', async () => {
    // Which read an answer belongs to is known here; the label inside it is the server's to get wrong.
    getReport.mockImplementation(async () => reportFor('today', 3));
    await mount();
    await choose('week');

    expect(latest.report).toEqual(reportFor('today', 3));
    expect(latest.period).toBe('week');
  });
});

describe('useVendorReport — asking again', () => {
  it('retries the chosen period', async () => {
    await mount();
    getReport.mockRejectedValueOnce(offline());
    await choose('month');
    expect(latest.error).not.toBeNull();

    await act(async () => {
      latest.retry();
    });
    await flush();

    expect(getReport.mock.calls).toEqual([['today'], ['month'], ['month']]);
    expect(latest.report).toEqual(reportFor('month', 7));
  });

  it('keeps the period and the figures through a failed pull, and says they are stale', async () => {
    await mount();
    await choose('week');
    getReport.mockRejectedValueOnce(offline());

    await act(async () => {
      latest.refresh();
    });
    await flush();

    expect(latest.period).toBe('week');
    expect(latest.report).toEqual(reportFor('week', 7));
    expect(latest.error).toBeNull();
    expect(latest.isStale).toBe(true);
    expect(latest.staleError?.kind).toBe('network');
  });

  it('reads nothing when the chosen period is chosen again', async () => {
    await mount();

    await choose('today');

    expect(getReport).toHaveBeenCalledTimes(1);
  });
});
