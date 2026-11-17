/**
 * useAnalytics is how a screen records a section 54 event without touching the
 * registry. Two things about it must not change:
 *
 * - with no analytics service registered — any suite that resets the registry —
 *   `track` does nothing and throws nothing, so adding an event to a screen can
 *   never break that screen's tests or the screen;
 * - `track` is the same function on every render and in every component, so it
 *   is safe in a dependency array and cannot make an effect re-run (and resend).
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useAnalytics, type UseAnalyticsResult } from '@/shared/hooks/useAnalytics';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';

const seen: UseAnalyticsResult['track'][] = [];

/** `label` exists to be changed, which is what makes the second render happen. */
function Probe(_props: { label: string }) {
  const { track } = useAnalytics();
  seen.push(track);
  return null;
}

let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
  seen.length = 0;
  resetServices();
});

describe('useAnalytics', () => {
  it('does nothing, and throws nothing, when no analytics service is registered', () => {
    resetServices();
    act(() => {
      renderer = ReactTestRenderer.create(<Probe label="one" />);
    });

    expect(() => seen[0]('category_selected', { categoryId: 'cat_1' })).not.toThrow();
    expect(seen[0]('app_opened')).toBeUndefined();
  });

  it('records through the registered service', () => {
    const analytics = { track: jest.fn(), identify: jest.fn() };
    registerService('analytics', analytics);
    act(() => {
      renderer = ReactTestRenderer.create(<Probe label="one" />);
    });

    seen[0]('category_selected', { categoryId: 'cat_1' });

    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith('category_selected', { categoryId: 'cat_1' });
  });

  it('gives the same track on every render and in every component', () => {
    act(() => {
      renderer = ReactTestRenderer.create(<Probe label="one" />);
    });
    act(() => {
      renderer?.update(<Probe label="two" />);
    });
    let elsewhere: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      elsewhere = ReactTestRenderer.create(<Probe label="elsewhere" />);
    });
    act(() => {
      elsewhere?.unmount();
    });

    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(1);
  });
});
