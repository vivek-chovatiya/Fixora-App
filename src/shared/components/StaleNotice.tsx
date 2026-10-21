/**
 * StaleNotice
 *
 * Said above a list that could not be refreshed: what is on screen is from
 * before the attempt, and here is the way to try again.
 *
 * ⚠️ A notice, not an error page. The list underneath is still real and still
 * useful, so it stays; this only stops it passing for current. It is drawn in
 * the warning tone with its own glyph and says so in words, and it is announced
 * when it appears, because a failed pull gives a screen-reader user no other
 * sign that anything happened.
 *
 * The reason is `AppError.userMessage` — the same sentence `ErrorState` shows for
 * that kind of failure — so a dropped connection reads here as it does everywhere
 * else in the app. The service's own `message` is never drawn.
 *
 * Shared once it had a consumer outside its feature. Written for the vendor's
 * request list (3E-3) and reused by the vendor's reviews and team, it now also
 * stands over customer Home and the categories screen, whose failed pulls used
 * to say nothing at all. Moved unchanged apart from how it is spoken (below);
 * the old vendor path is a re-export.
 *
 * ⚠️ Spoken as sentences, each closed once. Seen on device (3E-6): the parts
 * were joined with ". ", which doubled the full stop the message already ends
 * with, and a screen reader said "…may be out of date.. No internet connection".
 * `spokenSentences` closes a part with a full stop only when it does not already
 * end in sentence punctuation — so a title without one still reads as its own
 * sentence, and a message with one is not given a second.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';
import type { AppError } from '@/shared/types/error';

/** A part that already ends a sentence: a full stop, a question, an exclamation or an ellipsis. */
const SENTENCE_END = /[.!?…]$/;

/**
 * The parts, as one passage a screen reader can say: blanks dropped, each part
 * a sentence exactly once, one space between them. Exported for its test.
 */
export function spokenSentences(parts: ReadonlyArray<string | null | undefined>): string {
  return parts
    .map(part => part?.trim() ?? '')
    .filter(part => part.length > 0)
    .map(part => (SENTENCE_END.test(part) ? part : `${part}.`))
    .join(' ');
}

export interface StaleNoticeProps {
  title: string;
  message: string;
  /** Why the refresh failed. Only its user-facing sentence is drawn. */
  error: AppError | null;
  retryLabel: string;
  retryHint: string;
  onRetry: () => void;
  isRetrying: boolean;
  testID?: string;
}

function StaleNoticeComponent({
  title,
  message,
  error,
  retryLabel,
  retryHint,
  onRetry,
  isRetrying,
  testID,
}: StaleNoticeProps) {
  const theme = useTheme();
  const reason = error?.userMessage;

  return (
    <Card
      bordered
      background="warningSubtle"
      shadow="none"
      style={{ gap: theme.spacing.md }}
      testID={testID}>
      <View
        style={[styles.row, { gap: theme.spacing.sm }]}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={spokenSentences([title, message, reason])}>
        {/* Words and glyph in the tint's own ink (3G-4): `warning` is 2.9:1 here in light. */}
        <Icon name="warning" size="md" color="onWarningSubtle" />
        <View style={[styles.copy, { gap: theme.spacing.xxs }]}>
          <Text variant="bodyStrong" color="onWarningSubtle">
            {title}
          </Text>
          <Text variant="caption" color="onWarningSubtle">
            {reason ? `${message} ${reason}` : message}
          </Text>
        </View>
      </View>

      <SecondaryButton
        label={retryLabel}
        icon="retry"
        onPress={onRetry}
        isLoading={isRetrying}
        fullWidth
        accessibilityHint={retryHint}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
  },
});

export const StaleNotice = memo(StaleNoticeComponent);
