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
 * Copying goes through `getClipboard()`, the same route `VendorOtpScreen` takes:
 * a component that imported a clipboard package would be one that has to be
 * rewritten when the package is, and one that cannot be tested without a native
 * module. Nothing is logged on either outcome — the only detail worth having
 * would be the value, and a reference in a log is a reference in a crash report.
 *
 * Moved out of the success screen when request details needed it too, so that
 * the reference reads, copies and fails identically on both.
 *
 * Content only, no surface: each screen decides what card it sits in.
 */

import React, { memo, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getClipboard } from '@/core/clipboard/Clipboard';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { Button, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.requestSubmitted;

export interface RequestReferenceProps {
  /** The backend's reference. Callers draw nothing at all when there is none. */
  reference: string;
  /** Lands on the node that announces the reference. */
  testID?: string;
}

function RequestReferenceComponent({ reference, testID }: RequestReferenceProps) {
  const theme = useTheme();

  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copyReference = useCallback(() => {
    void (async () => {
      try {
        await getClipboard().copy(reference);
        setCopied(true);
        setCopyFailed(false);
      } catch {
        // Not logged; see the file header.
        setCopyFailed(true);
      }
    })();
  }, [reference]);

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

        <Button
          label={copied ? COPY.copied : COPY.copy}
          variant="secondary"
          icon={copied ? 'selected' : 'copy'}
          onPress={copyReference}
          accessibilityHint={COPY.copyHint}
        />
      </View>

      <Text variant="caption" color="textSecondary">
        {COPY.referenceHint}
      </Text>

      {copyFailed ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {COPY.copyFailed}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  grow: {
    flex: 1,
  },
});

export const RequestReference = memo(RequestReferenceComponent);
