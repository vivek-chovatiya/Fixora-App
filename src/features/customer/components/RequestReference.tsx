/**
 * RequestReference
 *
 * The reference a customer quotes, and the control that copies it
 * (PROJECT_BIBLE.md section 19).
 *
 * ⚠️ It shows what it is given and never makes one up. The screens that draw it
 * only do so when the backend returned a reference; a number invented by the app
 * is a number a customer might quote to somebody who has never heard of it.
 *
 * The copy control is the shared `CopyButton` since T135 (28/11/2026): a small
 * glyph button beside the reference, spoken as "Copy reference REQ-…", that
 * says "Copied" beside itself for a moment and raises a toast if the copy
 * fails. It was a labelled secondary button that said "Copied" for good; the
 * vendor's request details copy the same reference now, and the two must read
 * alike. Copying still goes through `getClipboard()`, inside that button.
 *
 * Moved out of the success screen when request details needed it too, so that
 * the reference reads, copies and fails identically on both.
 *
 * Content only, no surface: each screen decides what card it sits in.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { CopyButton, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.requestSubmitted;

export interface RequestReferenceProps {
  /** The backend's reference. Callers draw nothing at all when there is none. */
  reference: string;
  /**
   * Lands on the node that announces the reference; the copy button is
   * `${testID}-copy`.
   */
  testID?: string;
}

function RequestReferenceComponent({ reference, testID }: RequestReferenceProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={[styles.line, { gap: theme.spacing.md }]}>
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${COPY.referenceLabel}: ${reference}`}
          style={[styles.grow, { gap: theme.spacing.xxs }]}
          testID={testID}>
          <Text variant="caption" color="textSecondary">
            {COPY.referenceLabel}
          </Text>
          <Text variant="h3">{reference}</Text>
        </View>

        <CopyButton
          value={reference}
          accessibilityLabel={COPY.copyReference(reference)}
          accessibilityHint={COPY.copyHint}
          copiedLabel={COPY.copied}
          failedMessage={COPY.copyFailed}
          testID={testID ? `${testID}-copy` : undefined}
        />
      </View>

      <Text variant="caption" color="textSecondary">
        {COPY.referenceHint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    // The button sits level with the two lines it copies, not with the first.
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
});

export const RequestReference = memo(RequestReferenceComponent);
