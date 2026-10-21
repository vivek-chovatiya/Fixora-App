/**
 * VendorWorkSync
 *
 * Tells every screen showing the vendor's work that it has changed (Phase
 * 3E-4) — a number that goes up, and nothing else.
 *
 * The dashboard, the request list and a request's details each read the work
 * for themselves, and stay mounted underneath one another: the list sits under
 * the details it opened, the dashboard under the tab beside it. Without this, a
 * request accepted on the details screen would still be waiting in the list
 * behind it and counted as waiting on the dashboard — two screens contradicting
 * a third in the same session. With it, a screen that answered a request says
 * so once, and each of the others reads the service again.
 *
 * ⚠️ A signal, not a store. It holds no requests and no counts; the service
 * stays the only answer to what the work is, and each screen keeps reading it
 * in its own way (the list keeps its stale notice, the dashboard its retry).
 * A cache shared between them is what this deliberately avoids building.
 *
 * Mounted inside `VendorProfileProvider`, which is keyed by the vendor, so the
 * count starts again for each vendor and nothing carries from one to the next.
 */

import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface VendorWorkSyncState {
  /** Goes up by one each time the work changes. Compare, never interpret. */
  revision: number;
  /** Says the work has changed: a request was answered, or turned out to have moved on. */
  workChanged: () => void;
}

const VendorWorkSyncContext = createContext<VendorWorkSyncState | null>(null);

export function VendorWorkSyncProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);

  const workChanged = useCallback(() => setRevision(current => current + 1), []);

  const value = useMemo<VendorWorkSyncState>(() => ({ revision, workChanged }), [revision, workChanged]);

  return <VendorWorkSyncContext.Provider value={value}>{children}</VendorWorkSyncContext.Provider>;
}

export function useVendorWorkSync(): VendorWorkSyncState {
  const context = useContext(VendorWorkSyncContext);
  if (!context) {
    throw new Error('useVendorWorkSync must be used inside VendorWorkSyncProvider.');
  }
  return context;
}
