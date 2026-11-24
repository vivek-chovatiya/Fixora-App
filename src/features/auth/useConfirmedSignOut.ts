import { useCallback } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useDialog } from '@/shared/components';

/** Every "Log out" entry point asks the same question before ending the session. */
export function useConfirmedSignOut() {
  const { signOut } = useAuth();
  const { confirm } = useDialog();
  return useCallback(async () => {
    if (await confirm({ title: 'Log out?', message: 'You will need to log in again to continue.', confirmLabel: 'Log out', destructive: true })) {
      await signOut();
    }
  }, [confirm, signOut]);
}
