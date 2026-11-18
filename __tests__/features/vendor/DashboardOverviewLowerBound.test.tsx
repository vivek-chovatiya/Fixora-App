/**
 * The dashboard's counts when the app could not read the whole list (code
 * review, 17/11/2026): past `AppConfig.api.fullListMaxPages` pages the service
 * says each count is only a lower bound (`VendorDashboardCounts.isLowerBound`),
 * and the overview draws "400+" and says "at least 400 …" — never a silently
 * low number that looks exact. Whole counts are drawn exactly as before.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { DashboardOverview } from '@/features/vendor/components/DashboardOverview';
import { presentTodayRequests } from '@/features/vendor/constants/reportPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { VendorDashboardCounts } from '@/shared/services/types/VendorDashboardService';
import { ThemeProvider } from '@/shared/theme';

const COPY = VENDOR_COPY.dashboard;

let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

async function render(counts: VendorDashboardCounts) {
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <DashboardOverview counts={counts} />
      </ThemeProvider>,
    );
  });
  const tree = renderer as ReactTestRenderer.ReactTestRenderer;
  return {
    drawn: (key: string) => tree.root.findByProps({ testID: `dashboard-stat-${key}-count` }).props.children,
    said: (label: string) => tree.root.findAll(node => node.props.accessibilityLabel === label).length > 0,
  };
}

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
});

it('draws and says whole counts exactly', async () => {
  const screen = await render({ pending: 4, active: 2, completed: 9 });

  expect(screen.drawn('pending')).toBe('4');
  expect(screen.drawn('active')).toBe('2');
  expect(screen.drawn('completed')).toBe('9');
  expect(screen.said(COPY.pendingSpoken(4))).toBe(true);
});

it('draws "N+" and says "at least" for every count that is only a lower bound', async () => {
  const screen = await render({ pending: 400, active: 1, completed: 599, isLowerBound: true });

  expect(screen.drawn('pending')).toBe('400+');
  expect(screen.drawn('active')).toBe('1+');
  expect(screen.drawn('completed')).toBe('599+');
  expect(screen.said(`at least ${COPY.pendingSpoken(400)}`)).toBe(true);
  expect(screen.said(`at least ${COPY.completedSpoken(599)}`)).toBe(true);
  expect(screen.said(COPY.pendingSpoken(400))).toBe(false);
});

describe('Today’s requests', () => {
  it('is drawn and said exactly when whole', () => {
    expect(presentTodayRequests({ totalRequests: 4 })).toEqual({
      value: '4',
      spoken: COPY.todaySpoken('4'),
    });
  });

  it('is drawn "N+" and said "at least N" when only a lower bound, like the other counts', () => {
    expect(presentTodayRequests({ totalRequests: 400, isLowerBound: true })).toEqual({
      value: '400+',
      spoken: COPY.todaySpoken('at least 400'),
    });
  });
});
