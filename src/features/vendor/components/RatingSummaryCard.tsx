/**
 * RatingSummaryCard
 *
 * The figures above a vendor's reviews (PROJECT_BIBLE.md section 41): the
 * average, drawn large with its stars, how many reviews it comes from, and —
 * under them — the breakdown: one row per number of stars, "5 ★ ▬▬▬ 80%".
 *
 * ⚠️ It draws what it is given. The figures are the service's and the words
 * are `presentRatingSummary`'s and `presentRatingBreakdown`'s; there is nothing
 * here to add up, so the card can never disagree with the backend about a
 * vendor's rating. No trend or period.
 *
 * ⚠️ Every bar is the same length, so bars can be compared down the card. The
 * star column and the percentage column take the room their text needs — never
 * a fixed width, so a large font setting cannot clip "100%" — and the bar has
 * the rest. The percentage column is held open at the width of "100%" in every
 * row by an invisible copy of it; without that, a row reading "0%" would get a
 * longer bar than one reading "100%". Track and fill are theme tokens: the
 * fill is the amber of a filled star, the track the stronger border grey.
 *
 * ⚠️ Each breakdown row is one stop for a screen reader — "5 stars, 80
 * percent, 12 reviews" — and the bar inside it is hidden: a bar has no words,
 * and the row already says what it shows.
 *
 * ⚠️ One stop for a screen reader, said as a number: "Rating 4.3 out of 5,
 * based on 4 reviews." The stars are the same glyphs the customer chose with
 * (`StarRating`), and are hidden from assistive technology here so the rating
 * is not said a second time as "4 out of 5 stars" — which, for an average of
 * 4.3, would also be wrong.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type {
  RatingBreakdownRowPresentation,
  RatingSummaryPresentation,
} from '@/features/vendor/constants/reviewPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { Card, Icon, ProgressBar, StarRating, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.reviews;

export interface RatingSummaryCardProps {
  summary: RatingSummaryPresentation;
  /** Section 41's breakdown, drawn under the average. Null or absent: none drawn. */
  breakdown?: readonly RatingBreakdownRowPresentation[] | null;
  testID?: string;
}

interface BreakdownRowProps {
  row: RatingBreakdownRowPresentation;
  testID?: string;
}

function BreakdownRow({ row, testID }: BreakdownRowProps) {
  const theme = useTheme();

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={row.spoken} testID={testID}>
      <View
        style={[styles.row, { gap: theme.spacing.sm }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <View style={[styles.row, { gap: theme.spacing.xxs }]}>
          <Text variant="body" style={styles.figure}>
            {row.stars}
          </Text>
          <Icon name="star" size="xs" color="warning" />
        </View>

        {/* Silent: the row is the one stop and already says the percentage. */}
        <ProgressBar
          value={row.percent / 100}
          fillColor="warning"
          thickness="sm"
          style={styles.track}
          fillTestID={testID ? `${testID}-fill` : undefined}
        />

        <View>
          <Text
            variant="body"
            color="textSecondary"
            align="right"
            style={styles.figure}
            testID={testID ? `${testID}-percent` : undefined}>
            {row.percentText}
          </Text>
          {/*
            Never seen, and takes no height: its width — "100%" at whatever size
            the font is — is what every row's column is, so every bar matches.
          */}
          <Text
            variant="body"
            style={[
              styles.figure,
              styles.sizer,
              { height: theme.spacing.none, opacity: theme.opacity.transparent },
            ]}>
            {COPY.breakdownPercentWidest}
          </Text>
        </View>
      </View>
    </View>
  );
}

function RatingSummaryCardComponent({ summary, breakdown, testID }: RatingSummaryCardProps) {
  const theme = useTheme();

  return (
    <Card bordered shadow="sm" testID={testID} style={{ gap: theme.spacing.lg }}>
      <View accessible accessibilityRole="text" accessibilityLabel={summary.spoken}>
        <View
          style={{ gap: theme.spacing.sm }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Text variant="overline" color="textTertiary">
            {COPY.summaryTitle}
          </Text>

          {/* Wraps under a very large font rather than pushing the stars off the card. */}
          <View style={[styles.figures, { columnGap: theme.spacing.lg, rowGap: theme.spacing.xs }]}>
            <Text variant="display" testID={testID ? `${testID}-average` : undefined}>
              {summary.average}
            </Text>

            <View style={{ gap: theme.spacing.xxs }}>
              <StarRating value={summary.stars} size="md" />
              <Text
                variant="body"
                color="textSecondary"
                testID={testID ? `${testID}-count` : undefined}>
                {summary.count}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {breakdown && breakdown.length > 0 ? (
        <View
          style={{ gap: theme.spacing.sm }}
          testID={testID ? `${testID}-breakdown` : undefined}>
          {breakdown.map(row => (
            <BreakdownRow
              key={row.stars}
              row={row}
              testID={testID ? `${testID}-breakdown-${row.stars}` : undefined}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    // The bar takes whatever the two text columns leave.
    flex: 1,
  },
  figure: {
    // Every digit the same width, so "1" and "5" start their bars level.
    fontVariant: ['tabular-nums'],
  },
  sizer: {
    overflow: 'hidden',
  },
});

export const RatingSummaryCard = memo(RatingSummaryCardComponent);
