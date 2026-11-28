/**
 * CopyButton
 *
 * A small button that puts one value on the clipboard, drawn beside the value
 * it copies, and says "Copied" beside itself for a moment when it has (T135,
 * 28/11/2026: the request reference, on the customer's and the vendor's
 * request details).
 *
 * Shared because both sides copy the same `REQ-…` and must say so the same way;
 * the words are the caller's, from its own copy file, as `RequestPhotoStrip`
 * takes them.
 *
 * Copying goes through `getClipboard()`, the route `core/clipboard` sets for
 * every screen and component: nothing here knows which clipboard package is
 * underneath, and a test swaps it with `setClipboard`. Nothing is logged on
 * either outcome — the only detail worth having would be the value.
 *
 * ⚠️ The spoken name says what is copied ("Copy reference REQ-…"), not just
 * "Copy": the glyph is all a sighted person needs, and a screen reader landing
 * on the button has nothing else to go on. The confirmation is a word, shown
 * and announced (polite), and the glyph changes shape with it — never colour
 * alone (PROJECT_BIBLE.md section 46). It goes back to rest after
 * `duration.copiedHold`; a second press restarts the wait rather than stacking
 * a second one.
 *
 * ⚠️ A failure is a toast, not the word beside the button. It is a sentence —
 * what failed and what to do instead — and a sentence squeezed in next to the
 * value would push the value it is about out of shape. The toast layer is the
 * app's place for an act that did not work (`useCancelRequest` raises its
 * failures there too), so a screen using this needs `ToastProvider` above it,
 * which the app always has.
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getClipboard } from '@/core/clipboard/Clipboard';
import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useToast } from '@/shared/components/ToastProvider';
import { useTheme } from '@/shared/theme';

export interface CopyButtonProps {
  /** Exactly what lands on the clipboard. */
  value: string;
  /** Spoken name, naming what is copied: "Copy reference REQ-…". */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** The word shown beside the button once the value is on the clipboard. */
  copiedLabel: string;
  /** The toast raised when it could not be copied. */
  failedMessage: string;
  /** Lands on the button; the confirmation is `${testID}-copied`. */
  testID?: string;
}

function CopyButtonComponent({
  value,
  accessibilityLabel,
  accessibilityHint,
  copiedLabel,
  failedMessage,
  testID,
}: CopyButtonProps) {
  const theme = useTheme();
  const { showToast } = useToast();

  const [copied, setCopied] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** False once the button has gone: a copy answering after that changes nothing. */
  const mountedRef = useRef(true);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  // A timer that outlives the button would set state on nothing.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearHold();
    };
  }, [clearHold]);

  const holdMs = theme.animation.duration.copiedHold;

  const copy = useCallback(() => {
    getClipboard()
      .copy(value)
      .then(
        () => {
          if (!mountedRef.current) {
            return;
          }
          clearHold();
          setCopied(true);
          holdTimer.current = setTimeout(() => {
            holdTimer.current = null;
            setCopied(false);
          }, holdMs);
        },
        () => {
          // Not logged; see the file header.
          if (!mountedRef.current) {
            return;
          }
          clearHold();
          setCopied(false);
          showToast({ message: failedMessage, tone: 'danger', icon: 'error' });
        },
      );
  }, [clearHold, failedMessage, holdMs, showToast, value]);

  return (
    <View style={[styles.row, { gap: theme.spacing.xs }]}>
      {copied ? (
        <Text
          variant="caption"
          color="textSecondary"
          numberOfLines={1}
          accessibilityLiveRegion="polite"
          testID={testID ? `${testID}-copied` : undefined}>
          {copiedLabel}
        </Text>
      ) : null}

      <Pressable
        onPress={copy}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        // The drawn disc stays small beside a line of text; the slop takes the
        // target to the accessibility floor (36 + 4 + 4 = 44).
        hitSlop={theme.spacing.xs}
        style={({ pressed }) => [
          styles.disc,
          {
            padding: theme.spacing.sm,
            borderRadius: theme.radius.full,
            // The secondary button's tonal fill and its pressed step, so the two
            // read as the same family. Pressed steps the fill rather than fading
            // the glyph: in dark mode `border` and `surfaceAlt` are one value.
            backgroundColor: pressed ? theme.colors.borderStrong : theme.colors.surfaceAlt,
          },
        ]}
        testID={testID}>
        <Icon name={copied ? 'selected' : 'copy'} size="md" color="textPrimary" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const CopyButton = memo(CopyButtonComponent);
