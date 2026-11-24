/**
 * Re-runs a refresh when a screen regains focus (e.g. after returning from a
 * detail screen where the status changed). Skips the very first focus, which the
 * initial load already covers.
 */

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

export function useRefreshOnFocus(refresh: () => void) {
  const first = useRef(true);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refreshRef.current();
    }, []),
  );
}
