/**
 * RequestWorkAction
 *
 * The next step for one accepted job (PROJECT_BIBLE.md sections 35 and 36,
 * Phase 3E-5) — on its card in the list, and on its details screen: "Start
 * work" while it is accepted, "Mark completed" while it is in progress.
 *
 * ⚠️ The caller says which step, from `nextWorkStep`; this component knows no
 * statuses and draws whichever button it is told to. Completed work gets
 * nothing, because the caller passes no step.
 *
 * ⚠️ Says which job it moves. A screen reader hears "Start work on Switchboard
 * repair, Ref REQ-31042", not a bare "Start work" repeated down a list; the
 * spoken name starts with the words on the button, so voice control still
 * finds it. The button is the primary one with its own glyph — the step is in
 * the words, not the colour.
 *
 * One full-width button: it never shares a row, so it is never squeezed.
 */

import React, { memo, useCallback } from 'react';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { PrimaryButton } from '@/shared/components';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import type {
  VendorRequestAction,
  VendorWorkStep,
} from '@/shared/services/types/VendorRequestService';

const COPY = VENDOR_COPY.work;

export interface RequestWorkActionProps {
  job: Pick<VendorJobSummary, 'id' | 'reference' | 'serviceName'>;
  step: VendorWorkStep;
  /** The action being sent for this job, if one is: the button shows progress for its own step. */
  answering: VendorRequestAction | null;
  /** An action is in the air — for this job or another — so the button waits. */
  disabled: boolean;
  /**
   * Starts at once; completing opens the completion form (the final amount and
   * the payment record), so the caller decides what each press does.
   */
  onStep: (requestId: string, step: VendorWorkStep) => void;
}

function RequestWorkActionComponent({ job, step, answering, disabled, onStep }: RequestWorkActionProps) {
  // Said only when the backend gave one — never the database id in its place.
  const reference = job.reference ? `${VENDOR_COPY.job.referencePrefix} ${job.reference}` : undefined;
  const press = useCallback(() => onStep(job.id, step), [job.id, onStep, step]);

  return step === 'start' ? (
    <PrimaryButton
      label={COPY.start}
      icon="startWork"
      onPress={press}
      isLoading={answering === 'start'}
      disabled={disabled}
      fullWidth
      accessibilityLabel={COPY.startSpoken(job.serviceName, reference)}
      accessibilityHint={COPY.startHint}
    />
  ) : (
    <PrimaryButton
      label={COPY.complete}
      icon="completeWork"
      onPress={press}
      isLoading={answering === 'complete'}
      disabled={disabled}
      fullWidth
      accessibilityLabel={COPY.completeSpoken(job.serviceName, reference)}
      accessibilityHint={COPY.completeHint}
    />
  );
}

export const RequestWorkAction = memo(RequestWorkActionComponent);
