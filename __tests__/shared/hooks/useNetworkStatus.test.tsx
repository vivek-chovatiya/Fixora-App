/**
 * useNetworkStatus: online until told otherwise, and current while mounted.
 *
 * Pinned here: one subscription per mount, closed on unmount; the first
 * frame is online whatever the platform will say (not knowing is not offline);
 * an answer to "what is it now?" that arrives after a change was heard is
 * ignored, because it may describe the moment before that change; a platform
 * that cannot answer leaves the app online; and a report that does not change
 * `isOffline` does not hand the caller a new object.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { MockNetworkStatusService } from '@/shared/services/mock/MockNetworkStatusService';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  NetworkState,
  NetworkStateListener,
  NetworkStatusService,
} from '@/shared/services/types/NetworkStatusService';

let latest: NetworkState;

function Probe() {
  latest = useNetworkStatus();
  return null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function mount() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<Probe />);
  });
  mounted.push(renderer);
  return renderer;
}

afterEach(async () => {
  // Unmounted even when an assertion failed part-way (CLAUDE.md section 7).
  while (mounted.length > 0) {
    const renderer = mounted.pop()!;
    await act(async () => {
      renderer.unmount();
    });
  }
  resetServices();
  jest.restoreAllMocks();
});

/** A service whose two answers the test releases by hand. */
function controlledService() {
  let resolveCurrent!: (state: NetworkState) => void;
  let rejectCurrent!: (error: Error) => void;
  let listener: NetworkStateListener | null = null;
  const unsubscribe = jest.fn(() => {
    listener = null;
  });

  const service: NetworkStatusService = {
    getCurrent: jest.fn(
      () =>
        new Promise<NetworkState>((resolve, reject) => {
          resolveCurrent = resolve;
          rejectCurrent = reject;
        }),
    ),
    subscribe: jest.fn((next: NetworkStateListener) => {
      listener = next;
      return unsubscribe;
    }),
  };

  return {
    service,
    unsubscribe,
    answer: (state: NetworkState) => resolveCurrent(state),
    fail: (error: Error) => rejectCurrent(error),
    emit: (state: NetworkState) => listener?.(state),
  };
}

describe('useNetworkStatus', () => {
  it('is online on the first frame, before the platform has answered', async () => {
    const network = controlledService();
    registerService('networkStatus', network.service);

    await mount();

    expect(latest).toEqual({ isOffline: false });
  });

  it('takes the current state when the platform answers', async () => {
    registerService('networkStatus', new MockNetworkStatusService({ isOffline: true }));

    await mount();

    expect(latest).toEqual({ isOffline: true });
  });

  it('follows every change while mounted', async () => {
    const network = new MockNetworkStatusService();
    registerService('networkStatus', network);
    await mount();

    await act(async () => {
      network.setOffline(true);
    });
    expect(latest.isOffline).toBe(true);

    await act(async () => {
      network.setOffline(false);
    });
    expect(latest.isOffline).toBe(false);
  });

  it('subscribes once per mount and closes the subscription on unmount', async () => {
    const network = new MockNetworkStatusService();
    const subscribe = jest.spyOn(network, 'subscribe');
    registerService('networkStatus', network);

    const renderer = await mount();
    await act(async () => {
      renderer.update(<Probe />);
    });

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(network.listenerCount()).toBe(1);

    await act(async () => {
      renderer.unmount();
    });
    mounted.splice(mounted.indexOf(renderer), 1);

    expect(network.listenerCount()).toBe(0);
  });

  it('ignores a late answer once a change has been heard', async () => {
    const network = controlledService();
    registerService('networkStatus', network.service);
    await mount();

    // The connection drops while the first read is still out…
    await act(async () => {
      network.emit({ isOffline: true });
    });
    // …and that read comes back describing the moment before.
    await act(async () => {
      network.answer({ isOffline: false });
    });

    expect(latest.isOffline).toBe(true);
  });

  it('stays online, and says so in the log, when the platform cannot answer', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const network = controlledService();
    registerService('networkStatus', network.service);
    await mount();

    await act(async () => {
      network.fail(new Error('native module unavailable'));
    });

    expect(latest).toEqual({ isOffline: false });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('keeps the same object when a report does not change isOffline', async () => {
    const network = new MockNetworkStatusService();
    registerService('networkStatus', network);
    await mount();
    const before = latest;

    await act(async () => {
      // A new wifi network, say: still online.
      network.setOffline(false);
    });

    expect(latest).toBe(before);
  });
});
