/**
 * CompleteWorkDialog
 *
 * Asks once before a job is marked completed (PROJECT_BIBLE.md section 36,
 * Phase 3E-5). Completing is the last thing that can be done to a job — there
 * is no step back from it — so it gets a second thought; starting does not,
 * because it is the step a vendor most wants to take quickly.
 *
 * Shown by the completion form (`CompleteWorkScreen`) once the final amount and
 * payment have passed their checks — the last question before the completion
 * and its payment record are sent, so its words say the payment details are
 * saved too.
 *
 * The shared `ConfirmDialog`, worded for this: Cancel first, Complete in the
 * primary tone — finishing work is not destructive, so not red — and while the
 * completion is being sent the dialog stays, says so, and cannot be dismissed.
 * The caller closes it when the service has answered.
 */

import React, { memo } from 'react';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { ConfirmDialog } from '@/shared/components';

const COPY = VENDOR_COPY.work;

export interface CompleteWorkDialogProps {
  visible: boolean;
  /** The completion is being sent. */
  isCompleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function CompleteWorkDialogComponent({
  visible,
  isCompleting,
  onCancel,
  onConfirm,
}: CompleteWorkDialogProps) {
  return (
    <ConfirmDialog
      visible={visible}
      title={COPY.completeTitle}
      message={COPY.completeMessage}
      cancelLabel={COPY.completeCancel}
      cancelHint={COPY.completeCancelHint}
      confirmLabel={COPY.completeConfirm}
      confirmHint={COPY.completeConfirmHint}
      confirmVariant="primary"
      isConfirming={isCompleting}
      onCancel={onCancel}
      onConfirm={onConfirm}
      testID="vendor-complete-dialog"
    />
  );
}

export const CompleteWorkDialog = memo(CompleteWorkDialogComponent);
