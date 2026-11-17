/**
 * useErrorToast
 *
 * Raises a toast whenever a new failure arrives.
 *
 * This is the replacement for an inline `<ErrorState fullScreen={false} />` in a
 * form: one line, in the screen that owns the operation, instead of a block
 * competing with the form's own controls for the fold.
 *
 * It renders `error.userMessage` and nothing else. The kind picks the icon and
 * the tint, so a rejected code and a dropped connection stay visually distinct
 * without any screen deciding what a failure looks like.
 *
 * Colocated with the toast rather than filed under hooks, because it is part of
 * that surface and not a general utility.
 */

import { useEffect, useRef } from 'react';

import { ERROR_PRESENTATION } from '@/shared/components/errorPresentation';
import { useToast } from '@/shared/components/ToastProvider';
import type { AppError } from '@/shared/types/error';

export function useErrorToast(error: AppError | null | undefined): void {
  const { showToast, hideToast } = useToast();

  /**
   * Which failure has already been announced.
   *
   * Identity is the test, not equality: a service that rejects twice with the
   * same message produces two AppError instances, and the user needs to see
   * that their second attempt also failed. Holding the instance also keeps an
   * unrelated re-render — an appearance change, say — from raising a message
   * about an attempt the user made minutes ago.
   */
  const announced = useRef<AppError | null>(null);

  useEffect(() => {
    if (!error) {
      /**
       * The failure has been withdrawn — the operation was retried, or a resend
       * replaced the code the message was about. Either way the toast now
       * describes an attempt that no longer exists, and letting it sit out its
       * dwell would leave the user reading about something already undone.
       */
      if (announced.current !== null) {
        announced.current = null;
        hideToast();
      }
      return;
    }

    if (announced.current === error) {
      return;
    }

    announced.current = error;

    const { tone, icon } = ERROR_PRESENTATION[error.kind];

    showToast({ message: error.userMessage, tone, icon });
  }, [error, showToast, hideToast]);
}
