/**
 * useSavedAddressEditor
 *
 * The two service calls the Add / Edit Address screen makes (Phase 3D-9), and
 * the seam that screen is allowed to touch: a screen never reaches the service
 * registry itself (CLAUDE.md section 4). The screen called `getService`
 * directly until 21/10/2026, when the import-boundary test
 * (`__tests__/architecture/importBoundaries.test.ts`) found it; that test now
 * pins the rule for every screen.
 *
 * ⚠️ The record is read from the service, not passed in. A copy handed along
 * in params can be stale by the time it is saved — another change may have
 * moved the default or replaced the fields since the list drew it.
 *
 * Behaviour is exactly the screen's before the move: the same read, made only
 * when editing, and the same create-or-update.
 */

import { useCallback } from 'react';

import {
  useServiceMutation,
  type UseServiceMutationResult,
} from '@/shared/hooks/useServiceMutation';
import { useServiceQuery, type UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type {
  SavedAddress,
  SavedAddressInput,
} from '@/shared/services/types/AddressBookService';

export interface SavedAddressEditor {
  /** The customer's saved addresses, read only when an existing one is being edited. */
  saved: UseServiceQueryResult<SavedAddress[]>;
  /** Creates the address, or replaces the one being edited. Answers with the whole book. */
  save: UseServiceMutationResult<[SavedAddressInput], SavedAddress[]>;
}

export function useSavedAddressEditor(addressId: string | undefined): SavedAddressEditor {
  const isEditing = addressId !== undefined;

  const saved = useServiceQuery<SavedAddress[]>(
    useCallback(() => getService('addressBook').listAddresses(), []),
    [],
    { enabled: isEditing },
  );

  const save = useServiceMutation<[SavedAddressInput], SavedAddress[]>(
    useCallback(
      (input: SavedAddressInput) =>
        addressId
          ? getService('addressBook').updateAddress(addressId, input)
          : getService('addressBook').createAddress(input),
      [addressId],
    ),
  );

  return { saved, save };
}
