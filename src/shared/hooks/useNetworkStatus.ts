/**
 * useNetworkStatus
 *
 * Whether the device is offline, kept current for as long as the caller is
 * mounted. The app-wide offline banner is its consumer; a screen never reaches
 * the network service itself (CLAUDE.md section 4).
 *
 *   const { isOffline } = useNetworkStatus();
 *
 * It starts online and stays online until the platform says otherwise, by the
 * rule in `types/NetworkStatusService.ts`: not knowing yet is not offline. So
 * the first frame never shows a warning that the first answer withdraws.
 *
 * It subscribes before it asks, so a change that lands between the two is not
 * lost; and once the subscription has spoken, the answer to the question is
 * ignored, because it may have been read before that change.
 *
 * ⚠️ It never retries anything on reconnect. Each screen keeps its own Try
 * again: a reload triggered here would fire on every mounted screen at the
 * moment the connection comes back, which is the moment it can least take it.
 *
 * ⚠️ The returned object only changes when `isOffline` does. The platform
 * reports changes this hook does not care about — a new wifi network, a
 * different cellular generation — and each would otherwise re-render the
 * caller for nothing.
 */

import { useEffect, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { getService } from '@/shared/services/ServiceRegistry';
import type { NetworkState } from '@/shared/services/types/NetworkStatusService';

const log = createLogger('useNetworkStatus');

const ONLINE: NetworkState = Object.freeze({ isOffline: false });

export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>(ONLINE);

  useEffect(() => {
    const network = getService('networkStatus');

    // Both guard against an answer arriving after unmount, or after a fresher one.
    let isActive = true;
    let hasHeardChange = false;

    const keep = (next: NetworkState) => {
      setState(current => (current.isOffline === next.isOffline ? current : next));
    };

    const unsubscribe = network.subscribe(next => {
      if (!isActive) {
        return;
      }
      hasHeardChange = true;
      keep(next);
    });

    network.getCurrent().then(
      current => {
        if (isActive && !hasHeardChange) {
          keep(current);
        }
      },
      // Not knowing is online, so there is nothing to show; it is still said,
      // because a platform that cannot answer is worth knowing about.
      error => {
        log.warn('Could not read the network state', { error });
      },
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  return state;
}
