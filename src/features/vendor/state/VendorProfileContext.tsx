/**
 * VendorProfileContext
 *
 * The signed-in vendor's business profile, for the vendor application only
 * (Phase 3E-1).
 *
 * ⚠️ Local to the vendor tree, not Redux. Two places need the profile — the
 * navigator, to decide whether setup comes first, and the screens that show or
 * edit it — and both live under `VendorNavigator`; nothing in the customer
 * application or in auth ever asks (constitution section 12). The service owns
 * the data; this only holds the last answer so the tree and the screens agree.
 *
 * ⚠️ Mounted per vendor. `VendorNavigator` keys it by the session's vendor id,
 * and signing out unmounts the whole vendor tree, so one vendor's profile
 * cannot outlive their session in memory and be shown to the next.
 *
 * `adopt` is how a save becomes the answer: the service returns the stored
 * profile, and adopting it is what moves a vendor out of setup — there is no
 * navigation call anywhere in the save flow, exactly as signing in has none.
 *
 * ⚠️ `inLine` is the one line every operation on this vendor's profile waits
 * in — the profile form's save, and every read and change of the shop images
 * (section 38) — one at a time, in the order asked, and each adopts its answer
 * inside its own turn. So the profile here only ever moves forward: an older
 * read or answer can never be adopted after a newer one. It lives here, not on
 * a screen, because the work outlives the screen that asked for it — a save
 * still in the air when Shop images is left must finish before the screen
 * opened next reads anything, or that screen would read past it and then send
 * a list without it.
 *
 * ⚠️ One line per vendor session. The provider is keyed by the vendor and
 * unmounted at sign-out, and an operation whose turn comes after that is
 * refused (`cancelled`) rather than run — so nothing one vendor asked for can
 * run in, or adopt into, another's session. (What a screen does when its own
 * operation's turn comes after the screen has gone is the screen's to decide.)
 *
 * ⚠️ A change to "accepting new requests" is claimed here, not in the hook that
 * makes it (`useAcceptingRequests`). Profile's switch and the dashboard's notice
 * each hold that hook; with the claim and the value asked for kept per hook, a
 * change started on one was not busy on the other, which could send the same
 * change a second time and say so twice (review finding, 21/10/2026). One claim
 * per vendor session, so both show the change in the air and only one is ever
 * sent.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { VendorProfile } from '@/shared/services/types/VendorProfileService';
import { AppError } from '@/shared/types/error';

export interface VendorProfileState {
  /** Undefined until the first load has answered. */
  profile: VendorProfile | undefined;
  isLoading: boolean;
  error: AppError | null;
  retry: () => void;
  /** Makes a profile the service just returned the current one. */
  adopt: (profile: VendorProfile) => void;
  /**
   * Runs an operation on this vendor's profile after every one already asked
   * for has finished, and answers with its result. Adopt its answer inside the
   * operation, so adoption keeps the line's order. Rejects with `cancelled`,
   * without running it, if the vendor's session has ended by its turn.
   */
  inLine: <T>(operation: () => Promise<T>) => Promise<T>;
  /**
   * "Accepting new requests" as asked for while a change to it is in line or
   * sent; null otherwise. The same for every screen of this vendor's session.
   */
  pendingAccepting: boolean | null;
  /**
   * Claims the one change to "accepting new requests" that may be in the air,
   * asking for `accepting`. False, and nothing claimed, while another holds it.
   */
  beginAcceptingChange: (accepting: boolean) => boolean;
  /** Gives the claim back once the change has answered or been refused. */
  endAcceptingChange: () => void;
}

const VendorProfileContext = createContext<VendorProfileState | null>(null);

export function VendorProfileProvider({ children }: { children: ReactNode }) {
  const query = useServiceQuery<VendorProfile>(
    useCallback(() => getService('vendorProfile').getProfile(), []),
    [],
  );

  const [adopted, setAdopted] = useState<VendorProfile | null>(null);

  const adopt = useCallback((profile: VendorProfile) => setAdopted(profile), []);

  /** The last operation in line; the next one waits for it. */
  const line = useRef<Promise<unknown>>(Promise.resolve());
  /** False once this vendor's session — this provider — has gone. */
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const inLine = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const run = line.current.then(() => {
      if (!live.current) {
        throw new AppError({ kind: 'cancelled', message: 'Vendor profile: the session has ended' });
      }
      return operation();
    });
    // A failure is the caller's to handle, and never stops the line.
    line.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  // The ref refuses a second claim before state can say the first is held.
  const acceptingClaimed = useRef(false);
  const [pendingAccepting, setPendingAccepting] = useState<boolean | null>(null);

  const beginAcceptingChange = useCallback((accepting: boolean) => {
    if (acceptingClaimed.current) {
      return false;
    }
    acceptingClaimed.current = true;
    setPendingAccepting(accepting);
    return true;
  }, []);

  const endAcceptingChange = useCallback(() => {
    acceptingClaimed.current = false;
    // An answer that lands after the session has gone has nothing to clear.
    if (live.current) {
      setPendingAccepting(null);
    }
  }, []);

  const value = useMemo<VendorProfileState>(
    () => ({
      profile: adopted ?? query.data,
      isLoading: query.isLoading && !adopted,
      error: adopted ? null : query.error,
      retry: query.retry,
      adopt,
      inLine,
      pendingAccepting,
      beginAcceptingChange,
      endAcceptingChange,
    }),
    [
      adopt,
      adopted,
      inLine,
      pendingAccepting,
      beginAcceptingChange,
      endAcceptingChange,
      query.data,
      query.error,
      query.isLoading,
      query.retry,
    ],
  );

  return <VendorProfileContext.Provider value={value}>{children}</VendorProfileContext.Provider>;
}

export function useVendorProfile(): VendorProfileState {
  const context = useContext(VendorProfileContext);
  if (!context) {
    throw new Error('useVendorProfile must be used inside VendorProfileProvider.');
  }
  return context;
}
