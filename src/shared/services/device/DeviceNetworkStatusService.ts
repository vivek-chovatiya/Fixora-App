/**
 * DeviceNetworkStatusService
 *
 * The real implementation, backed by @react-native-community/netinfo.
 *
 * It lives under `device/` beside `DevicePermissionService` for the same
 * reason: whether the phone has a connection is the device's answer in every
 * build, so the mock/live switch in ServiceRegistry does not apply to it. A
 * mock backend still runs on a phone that can lose its signal.
 *
 * This file is the only place in the application that imports NetInfo.
 * Everything above it speaks in `NetworkState`.
 *
 * On Android, NetInfo answers reachability from the platform itself (the
 * network's "validated" capability), so with the default configuration it
 * sends no request of its own to find out. Keep it that way: switching on its
 * JavaScript probe would make the app call a third-party URL every minute.
 *
 * ⚠️ `toNetworkState` is the whole rule, and it is deliberately one-sided. Only
 * an explicit `false` makes the device offline; `null` or a missing value — the
 * platform has not decided yet — counts as online
 * (`types/NetworkStatusService.ts` says why).
 */

import NetInfo from '@react-native-community/netinfo';

import type {
  NetworkState,
  NetworkStateListener,
  NetworkStatusService,
} from '@/shared/services/types/NetworkStatusService';

/**
 * The two fields of NetInfo's state the rule reads. Declared here rather than
 * taken from the library so the rule can be tested with plain objects, and so a
 * wider library type cannot quietly widen what the rule depends on.
 */
export interface ConnectivitySnapshot {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}

/** Offline only when the platform has said so outright. Exported for its test. */
export function toNetworkState(snapshot: ConnectivitySnapshot): NetworkState {
  return {
    isOffline: snapshot.isConnected === false || snapshot.isInternetReachable === false,
  };
}

export class DeviceNetworkStatusService implements NetworkStatusService {
  async getCurrent(): Promise<NetworkState> {
    return toNetworkState(await NetInfo.fetch());
  }

  subscribe(listener: NetworkStateListener): () => void {
    return NetInfo.addEventListener(state => listener(toNetworkState(state)));
  }
}
