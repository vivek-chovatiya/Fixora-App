/**
 * RejectRequestDialog
 *
 * Asks once before a request is declined (PROJECT_BIBLE.md section 33, Phase
 * 3E-4). Accepting is not asked about — it is the answer a vendor most wants
 * to give quickly — but rejecting takes the request out of their list, so it
 * gets a second thought.
 *
 * The shared `ConfirmDialog`, worded for this: Cancel first, Reject in the
 * danger tone, and while the rejection is being sent the dialog stays, says so,
 * and cannot be dismissed — closing half-way would leave the vendor not knowing
 * whether it happened. The caller closes it when the service has answered.
 */

import React, { memo } from 'react';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { ConfirmDialog } from '@/shared/components';

const COPY = VENDOR_COPY.answer;

export interface RejectRequestDialogProps {
  visible: boolean;
  /** The rejection is being sent. */
  isRejecting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function RejectRequestDialogComponent({
  visible,
  isRejecting,
  onCancel,
  onConfirm,
}: RejectRequestDialogProps) {
  return (
    <ConfirmDialog
      visible={visible}
      title={COPY.rejectTitle}
      message={COPY.rejectMessage}
      cancelLabel={COPY.rejectCancel}
      cancelHint={COPY.rejectCancelHint}
      confirmLabel={COPY.rejectConfirm}
      confirmHint={COPY.rejectConfirmHint}
      confirmVariant="danger"
      isConfirming={isRejecting}
      onCancel={onCancel}
      onConfirm={onConfirm}
      testID="vendor-reject-dialog"
    />
  );
}

export const RejectRequestDialog = memo(RejectRequestDialogComponent);
