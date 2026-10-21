/**
 * DashboardFigure
 *
 * One of the figures the vendor dashboard reads on its own — Today's Requests
 * and Rating (PROJECT_BIBLE.md section 30, Phase 3E-15) — in whichever state
 * its own read is in: a placeholder while it is first read, the figure, or a
 * small failure with its own Try again.
 *
 * ⚠️ Each figure stands alone. The work, today's requests and the rating are
 * three reads; one failing or being slow must never blank or hold back the
 * others, so each draws its own wait and its own failure, in its own place,
 * and a retry here reads this figure and nothing else. A read that fails while
 * the figure is on screen is not drawn here at all: the figure stays, and the
 * dashboard's one notice says it may be out of date.
 *
 * ⚠️ Half the row, except a failure, which takes the whole row. Calculated at
 * 360dp: half is (360 − 2 × 16 − 8) / 2 = 160dp, 128dp inside the card's
 * padding, and a capsule button's own padding (2 × 24), the retry glyph and
 * "Try again" at 16sp come to about 150dp — it would not fit. The whole row
 * leaves 296dp. The figure next to a failure then takes a row of its own too,
 * which is the wrap doing its job, not a second layout.
 *
 * The figure itself is the report's card (`ReportFigureCard`), so a figure
 * reads the same here as on Reports. ⚠️ Its placeholder is that card's frame
 * — the same card, padding and gaps, holding a glyph-sized disc and two bars
 * one `h1` line and one `caption` line high — so it is the card's height by
 * construction, from the theme, with no number of its own to drift (CLAUDE.md
 * section 5): 2 × `spacing.lg` + `spacing.xxxl` + 2 × `spacing.sm` + the two
 * line heights. A rating whose stars wrap under the average at 360dp grows a
 * line when it lands; the placeholder is the one-line shape. The failure is said as one passage and
 * announced when it appears, as `ErrorState` is; only `userMessage` is drawn,
 * and the retry is offered only for a failure worth retrying (the
 * `ErrorState` rule — a refusal would only fail again).
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ReportFigureCard,
  type ReportFigureCardProps,
} from '@/features/vendor/components/ReportFigureCard';
import { Card, ERROR_PRESENTATION, Icon, SecondaryButton, Skeleton, Text } from '@/shared/components';
import { spokenSentences } from '@/shared/components/StaleNotice';
import { useTheme } from '@/shared/theme';
import type { AppError } from '@/shared/types/error';

export interface DashboardFigureProps {
  /** The figure, once its read has answered. Undefined until then. */
  figure: Omit<ReportFigureCardProps, 'style' | 'testID'> | undefined;
  /** The read failed with nothing to show. Null otherwise — including while it is read again. */
  error: AppError | null;
  /** Names the placeholder: "Loading your rating". */
  loadingLabel: string;
  /** Over the failure: "We could not load your rating". */
  failedTitle: string;
  retryLabel: string;
  /** The retry as it is said — it must still contain `retryLabel`, for voice control. */
  retrySpoken: string;
  retryHint: string;
  onRetry: () => void;
  testID: string;
}

function DashboardFigureComponent({
  figure,
  error,
  loadingLabel,
  failedTitle,
  retryLabel,
  retrySpoken,
  retryHint,
  onRetry,
  testID,
}: DashboardFigureProps) {
  const theme = useTheme();

  if (figure) {
    return <ReportFigureCard {...figure} style={styles.half} testID={testID} />;
  }

  if (error) {
    const presentation = ERROR_PRESENTATION[error.kind];

    return (
      <Card
        bordered
        shadow="none"
        style={[styles.whole, { gap: theme.spacing.md }]}
        testID={`${testID}-error`}>
        <View
          style={[styles.row, { gap: theme.spacing.sm }]}
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={spokenSentences([failedTitle, error.userMessage])}>
          <Icon name={presentation.icon} size="md" color={presentation.tone} />
          <View style={[styles.copy, { gap: theme.spacing.xxs }]}>
            <Text variant="bodyStrong">{failedTitle}</Text>
            <Text variant="caption" color="textSecondary">
              {error.userMessage}
            </Text>
          </View>
        </View>

        {error.isRetryable ? (
          <SecondaryButton
            label={retryLabel}
            icon="retry"
            onPress={onRetry}
            accessibilityLabel={retrySpoken}
            accessibilityHint={retryHint}
            style={styles.start}
          />
        ) : null}
      </Card>
    );
  }

  // Neither a figure nor a failure: the first read, or a retry after a failure, is out.
  const { h1, caption } = theme.typography.variants;
  return (
    <View
      style={styles.half}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={loadingLabel}
      accessibilityState={{ busy: true }}
      testID={`${testID}-loading`}>
      {/* ReportFigureCard's frame and gaps, with bars where its glyph, figure and label go. */}
      <Card bordered shadow="sm" style={{ gap: theme.spacing.sm }}>
        <Skeleton width={theme.spacing.xxxl} height={theme.spacing.xxxl} radiusToken="full" />
        <Skeleton width="40%" height={h1.lineHeight ?? theme.typography.lineHeight.xxxl} />
        <Skeleton width="70%" height={caption.lineHeight ?? theme.typography.lineHeight.sm} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  half: {
    // Two to a row: 40% each leaves room for the gap, and growing fills the rest.
    flexGrow: 1,
    flexBasis: '40%',
  },
  whole: {
    flexBasis: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  copy: {
    // Takes the slack, so the words wrap inside the card instead of running off it.
    flex: 1,
  },
  start: {
    // The button's own width, at the start of the card: a small retry, not a banner.
    alignSelf: 'flex-start',
  },
});

export const DashboardFigure = memo(DashboardFigureComponent);
