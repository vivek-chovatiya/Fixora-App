/**
 * MockNetworkStatusService
 *
 * A connection that a test can switch off and on, without a radio.
 *
 * ⚠️ It is not registered by `configureServices`, in either branch. Unlike the
 * backend mocks beside it, this one does not stand in for something that does
 * not exist yet: the device's answer is real in every build, so the app always
 * runs `DeviceNetworkStatusService`. This exists so the banner and the hook can
 * be tested against the rule rather than against the library's own mock.
 *
 * No simulated latency, unlike the backend mocks. The platform answers from
 * memory, and a delay here would only slow the tests down.
 */

import type {
  NetworkState,
  NetworkStateListener,
  NetworkStatusService,
} from '@/shared/services/types/NetworkStatusService';

export class MockNetworkStatusService implements NetworkStatusService {
  private state: NetworkState;
  private readonly listeners = new Set<NetworkStateListener>();

  constructor(initial: NetworkState = { isOffline: false }) {
    this.state = initial;
  }

  async getCurrent(): Promise<NetworkState> {
    return this.state;
  }

  subscribe(listener: NetworkStateListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /** What the platform would do on a change: remember it and tell everyone listening. */
  setOffline(isOffline: boolean): void {
    this.state = { isOffline };
    this.listeners.forEach(listener => listener(this.state));
  }

  /** How many subscriptions are open, so a test can prove one was closed. */
  listenerCount(): number {
    return this.listeners.size;
  }
}
