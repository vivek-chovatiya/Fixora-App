/**
 * RequestAnswerActions
 *
 * Accept and Reject for one waiting request (PROJECT_BIBLE.md section 33,
 * Phase 3E-4) — on its card in the list, and on its details screen.
 *
 * ⚠️ Drawn only for a request that is waiting. The caller decides that with
 * `isAwaitingAnswer`; this component has no idea of status and would offer the
 * buttons for anything it was handed.
 *
 * ⚠️ Told apart by more than colour. Accept is the filled primary button with a
 * tick; Reject is the quieter secondary one with a crossed circle — different
 * words, different glyphs, different weight. Neither is red: declining work is
 * the vendor's call, not an alarm (section 49.1), and the dialog that confirms
 * it is where the strong colour goes.
 *
 * ⚠️ Each says which request it answers. A screen reader moving down a list
 * hears "Accept Switchboard repair, Ref REQ-31042", not five identical
 * "Accept"s; the spoken name starts with the word on the button, so voice
 * control still finds it.
 *
 * Side by side where they fit and stacked where they do not, each always a
 * full-size target and never squeezed: a button keeps its own width and the row
 * wraps, rather than the label being cut short (the 3E-1 lesson).
 */

import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import type { VendorRequestAction } from '@/shared/services/types/VendorRequestService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.answer;

export interface RequestAnswerActionsProps {
  job: Pick<VendorJobSummary, 'id' | 'reference' | 'serviceName'>;
  /** The action being sent for this request, if one is: an Accept or Reject in the air shows progress. */
  answering: VendorRequestAction | null;
  /** An answer is in the air — for this request or another — so neither can be pressed. */
  disabled: boolean;
  onAccept: (requestId: string) => void;
  /** Asks first; the caller shows the confirmation. */
  onReject: (requestId: string) => void;
  testID?: string;
}

function RequestAnswerActionsComponent({
  job,
  answering,
  disabled,
  onAccept,
  onReject,
  testID,
}: RequestAnswerActionsProps) {
  const theme = useTheme();
  // Said only when the backend gave one — never the database id in its place.
  const reference = job.reference ? `${VENDOR_COPY.job.referencePrefix} ${job.reference}` : undefined;

  const accept = useCallback(() => onAccept(job.id), [job.id, onAccept]);
  const reject = useCallback(() => onReject(job.id), [job.id, onReject]);

  return (
    <View style={[styles.actions, { gap: theme.spacing.sm }]} testID={testID}>
      <PrimaryButton
        label={COPY.accept}
        icon="accept"
        onPress={accept}
        isLoading={answering === 'accept'}
        disabled={disabled}
        accessibilityLabel={COPY.acceptSpoken(job.serviceName, reference)}
        accessibilityHint={COPY.acceptHint}
        style={styles.action}
      />
      <SecondaryButton
        label={COPY.reject}
        icon="reject"
        onPress={reject}
        isLoading={answering === 'reject'}
        disabled={disabled}
        accessibilityLabel={COPY.rejectSpoken(job.serviceName, reference)}
        accessibilityHint={COPY.rejectHint}
        style={styles.action}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  action: {
    // Its own width first, then a share of what is left: two that fit sit side
    // by side, two that do not wrap onto lines of their own at full width.
    flexGrow: 1,
    flexBasis: 'auto',
  },
});

export const RequestAnswerActions = memo(RequestAnswerActionsComponent);
