/**
 * The offline rule, and the only file that speaks to NetInfo.
 *
 * The rule is one-sided on purpose: only the platform saying `false` outright
 * makes the device offline. `null` — not decided yet, which is exactly what
 * NetInfo reports at startup and while it probes — must read as online, or the
 * banner flashes at every launch and every network change for somebody whose
 * requests are working. The table below pins both directions, including the
 * captive-portal case (connected, internet unreachable), which is offline.
 *
 * NetInfo here is the library's own jest mock (jest.setup.js).
 */

import NetInfo from '@react-native-community/netinfo';

import {
  DeviceNetworkStatusService,
  toNetworkState,
  type ConnectivitySnapshot,
} from '@/shared/services/device/DeviceNetworkStatusService';
import type { NetworkState } from '@/shared/services/types/NetworkStatusService';

const netInfo = NetInfo as unknown as {
  fetch: jest.Mock;
  addEventListener: jest.Mock;
};

describe('toNetworkState — when the device counts as offline', () => {
  it.each<[string, ConnectivitySnapshot, boolean]>([
    ['connected and reachable', { isConnected: true, isInternetReachable: true }, false],
    ['connected, reachability not decided yet', { isConnected: true, isInternetReachable: null }, false],
    ['connected, reachability not reported', { isConnected: true }, false],
    ['nothing known yet (startup)', { isConnected: null, isInternetReachable: null }, false],
    ['no connection', { isConnected: false, isInternetReachable: false }, true],
    ['no connection, reachability not decided', { isConnected: false, isInternetReachable: null }, true],
    ['connected but the internet is unreachable', { isConnected: true, isInternetReachable: false }, true],
    ['connection unknown, internet unreachable', { isConnected: null, isInternetReachable: false }, true],
  ])('%s', (_case, snapshot, isOffline) => {
    expect(toNetworkState(snapshot)).toEqual({ isOffline });
  });

  it('answers with nothing but isOffline', () => {
    const state = toNetworkState({ isConnected: false, isInternetReachable: false });

    // The library's type, details and SSID stay behind the service.
    expect(Object.keys(state)).toEqual(['isOffline']);
  });
});

describe('DeviceNetworkStatusService', () => {
  afterEach(() => {
    netInfo.fetch.mockClear();
    netInfo.addEventListener.mockClear();
  });

  it('reads the current state through NetInfo.fetch and applies the rule', async () => {
    netInfo.fetch.mockResolvedValueOnce({
      type: 'none',
      isConnected: false,
      isInternetReachable: false,
      details: null,
    });

    await expect(new DeviceNetworkStatusService().getCurrent()).resolves.toEqual({
      isOffline: true,
    });
    expect(netInfo.fetch).toHaveBeenCalledTimes(1);
  });

  it('passes each change on in its own terms, and hands back NetInfo’s unsubscribe', () => {
    const unsubscribe = jest.fn();
    netInfo.addEventListener.mockReturnValueOnce(unsubscribe);
    const heard: NetworkState[] = [];

    const stop = new DeviceNetworkStatusService().subscribe(state => heard.push(state));
    const handler = netInfo.addEventListener.mock.calls[0][0] as (state: unknown) => void;

    handler({ type: 'wifi', isConnected: true, isInternetReachable: false, details: {} });
    handler({ type: 'wifi', isConnected: true, isInternetReachable: null, details: {} });

    expect(heard).toEqual([{ isOffline: true }, { isOffline: false }]);

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
