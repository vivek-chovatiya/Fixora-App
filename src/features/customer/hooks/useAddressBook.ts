/**
 * useAddressBook
 *
 * The customer's saved addresses and every change to them (PROJECT_BIBLE.md
 * section 18, Phase 3D-9).
 *
 * ⚠️ The service's answer is the list. Every mutation returns the whole
 * collection — because setting a default clears another, and deleting one can
 * promote another — so this hook adopts what came back rather than editing a
 * copy it is holding. Nothing here recomputes ordering or the default flag; a
 * second opinion on either is how a list with two defaults appears.
 *
 * ⚠️ Nothing is shown as done before it is done. There is no optimistic update:
 * the list changes when the service says it changed, and until then the action
 * that is running is the one that is disabled. An address book that showed a
 * deletion which then failed would be lying about the customer's own records.
 *
 * ⚠️ A failed change does not empty the list. Loading failures and change
 * failures are kept apart — the first means there is nothing to show, the
 * second means what is shown is still correct and one action did not work —
 * so a failed delete leaves the addresses on screen with a message above them.
 *
 * One change at a time, whichever it is.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { getService } from '@/shared/services/ServiceRegistry';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import type { SavedAddress } from '@/shared/services/types/AddressBookService';
import { AppError } from '@/shared/types/error';

export interface AddressBook {
  addresses: SavedAddress[];
  /** The first read, before there is anything to draw. */
  isLoading: boolean;
  /** Set when the list itself could not be read. */
  error: AppError | null;
  reload: () => void;

  /** The address a change is running against, so only its row shows busy. */
  changingId: string | null;
  isChanging: boolean;
  /** Set when a change failed. The list on screen is still correct. */
  changeError: AppError | null;
  dismissChangeError: () => void;

  remove: (id: string) => void;
  setDefault: (id: string) => void;
}

export function useAddressBook(): AddressBook {
  const list = useServiceQuery<SavedAddress[]>(
    useCallback(() => getService('addressBook').listAddresses(), []),
    [],
  );

  /*
    Seeded from the read, then owned here.

    A mutation answers with the new collection, and re-reading afterwards would
    be a second round trip for something already in hand — and a window in which
    the screen shows the old list.
  */
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  useEffect(() => {
    if (list.data) {
      setAddresses(list.data);
    }
  }, [list.data]);

  const [changingId, setChangingId] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<AppError | null>(null);

  const inFlight = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback((id: string, action: () => Promise<SavedAddress[]>): void => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setChangingId(id);
    setChangeError(null);

    void (async () => {
      try {
        const next = await action();
        if (mountedRef.current) {
          setAddresses(next);
        }
      } catch (caught) {
        const appError = AppError.from(caught);
        if (mountedRef.current) {
          // The list is untouched: what is on screen is still what is stored.
          setChangeError(appError);
        }
      } finally {
        inFlight.current = false;
        if (mountedRef.current) {
          setChangingId(null);
        }
      }
    })();
  }, []);

  const remove = useCallback(
    (id: string) => run(id, () => getService('addressBook').deleteAddress(id)),
    [run],
  );

  const setDefault = useCallback(
    (id: string) => run(id, () => getService('addressBook').setDefaultAddress(id)),
    [run],
  );

  const dismissChangeError = useCallback(() => setChangeError(null), []);

  return {
    addresses,
    isLoading: list.isLoading,
    error: list.error,
    reload: list.retry,
    changingId,
    isChanging: changingId !== null,
    changeError,
    dismissChangeError,
    remove,
    setDefault,
  };
}
