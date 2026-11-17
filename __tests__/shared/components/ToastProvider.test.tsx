/**
 * ToastProvider owns the one toast slot and the timer that withdraws it. What is
 * pinned here is that the timer never outlives the provider.
 *
 * Found in review: unmounting cleared the timer of a toast already showing, but
 * a toast raised after the provider had gone — a save that answers once the
 * tree above it is gone; in a suite, a test torn down with a save still in the
 * air — started a dwell timer that nothing could ever clear, to fire into a
 * provider that was no longer there.
 *
 * The dwell timer is told apart by its delay, the theme's toast duration: the
 * toast's own entrance and exit run on Reanimated's frames, which fake timers
 * also count and which are not the provider's to clear.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { ToastProvider, useToast, type ToastContextValue } from '@/shared/components';
import { ThemeProvider, duration } from '@/shared/theme';

const DWELL = duration.toast;

let toast: ToastContextValue;

/** Hands the test the toast calls a screen would make. */
function Raiser() {
  toast = useToast();
  return null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

function mount() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <Raiser />
        </ToastProvider>
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const shown = () =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === 'toast').length > 0;

  const unmount = () => {
    act(() => {
      renderer.unmount();
    });
    mounted.splice(mounted.indexOf(renderer), 1);
  };

  return { shown, unmount };
}

let setTimeoutSpy: jest.SpyInstance;
let clearTimeoutSpy: jest.SpyInstance;

/** The dwell timers started since the spies were last cleared, by the ids they returned. */
function dwellTimers(): unknown[] {
  return setTimeoutSpy.mock.calls
    .map((call, index) => ({ delay: call[1], id: setTimeoutSpy.mock.results[index]?.value }))
    .filter(timer => timer.delay === DWELL)
    .map(timer => timer.id);
}

beforeEach(() => {
  jest.useFakeTimers();
  setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
  clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
});

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  setTimeoutSpy.mockRestore();
  clearTimeoutSpy.mockRestore();
  jest.useRealTimers();
});

describe('ToastProvider — its timer', () => {
  it('starts one dwell timer for a toast, and replaces it for the next', () => {
    const view = mount();

    act(() => {
      toast.showToast({ message: 'Saved', tone: 'success', icon: 'success' });
    });
    expect(view.shown()).toBe(true);
    const [first] = dwellTimers();
    expect(dwellTimers()).toHaveLength(1);

    act(() => {
      toast.showToast({ message: 'Saved again' });
    });
    expect(dwellTimers()).toHaveLength(2);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(first);
  });

  it('clears the dwell timer when it goes with a toast still showing', () => {
    const view = mount();
    act(() => {
      toast.showToast({ message: 'Saved' });
    });
    const [dwell] = dwellTimers();

    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(dwell);
  });

  it('ignores a toast raised after it has gone, and starts no timer for it', () => {
    const view = mount();
    const { showToast } = toast;
    view.unmount();
    setTimeoutSpy.mockClear();
    const pending = jest.getTimerCount();

    // A save answering after the tree above it has gone.
    expect(() => showToast({ message: 'Saved', tone: 'success', icon: 'success' })).not.toThrow();

    expect(dwellTimers()).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(pending);
  });

  it('still shows toasts under StrictMode, whose effects are taken down and put back', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <React.StrictMode>
          <ThemeProvider>
            <ToastProvider>
              <Raiser />
            </ToastProvider>
          </ThemeProvider>
        </React.StrictMode>,
      );
    });
    mounted.push(renderer);

    act(() => {
      toast.showToast({ message: 'Saved' });
    });

    expect(
      renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === 'toast'),
    ).not.toHaveLength(0);
    expect(dwellTimers()).toHaveLength(1);
  });

  it('takes no notice of a hide after it has gone', () => {
    const view = mount();
    const { hideToast } = toast;
    view.unmount();
    setTimeoutSpy.mockClear();

    expect(() => hideToast()).not.toThrow();
    expect(dwellTimers()).toHaveLength(0);
  });
});
