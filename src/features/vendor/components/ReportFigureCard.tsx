/**
 * ReportFigureCard
 *
 * One figure on the vendor's report (PROJECT_BIBLE.md section 42): its glyph,
 * the figure drawn large, and what it counts — and, for the average rating,
 * its stars and how many ratings it comes from.
 *
 * ⚠️ It draws what it is given. The figure and every word are the report's
 * presentation (`presentVendorReport`); there is nothing here to add up, so a
 * card can never disagree with the server about a count.
 *
 * ⚠️ One stop for a screen reader, said as one phrase: "Completed requests,
 * 12". Everything inside is hidden from assistive technology, so the figure is
 * not said again on its own and a rating's stars are not read as "4 out of 5
 * stars" under an average of 4.3.
 *
 * Not the dashboard's `StatTile`, though it looks like one on purpose: that
 * tile is private to the locked dashboard, sits three to a row on one line,
 * and never carries stars or a second line. These sit two to a row, wrap, and
 * the rating needs both — a sibling, not a merge, so neither screen can move
 * the other. Sized by the grid it is placed in (`style`), never by a number;
 * its words wrap rather than truncate, so a large font grows the card instead
 * of cutting a figure off.
 *
 * Since Phase 3E-15 the dashboard draws its Today's Requests and Rating with
 * it too (section 30): the same figure, the same card, on both screens. There
 * the rating opens Reviews, so the card can be a button (`onPress`): then the
 * card itself is the one stop, says the same phrase with a hint, and carries a
 * chevron — never a button wrapped round a separate block, which a screen
 * reader would stop on twice. Without `onPress` it is exactly what it was.
 */

import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card, Icon, StarRating, Text } from '@/shared/components';
import { SUBTLE_INK, useTheme, type IconName, type SubtleTint } from '@/shared/theme';

export interface ReportFigureCardProps {
  /** What the figure counts, under it: "Completed". */
  label: string;
  /** The figure, drawn large. Absent when there is none — a rating with no ratings. */
  value?: string;
  /** Whole stars beside the figure. Only for the average rating. */
  stars?: number;
  /** A line under the label: "from 21 ratings", or what stands in for a missing figure. */
  note?: string;
  /** The whole card as one phrase. */
  spoken: string;
  icon: IconName;
  /**
   * The glyph disc's tint. The glyph takes that tint's own ink from
   * `SUBTLE_INK` (3G-4) — never a tone colour, which is under 4.5:1 on its
   * own tint in at least one theme — so the pair cannot be mismatched.
   */
  tint: SubtleTint;
  /** The card's place in the grid. */
  style?: StyleProp<ViewStyle>;
  /** Makes the whole card a button to somewhere, said as `spoken` with this hint. */
  onPress?: () => void;
  accessibilityHint?: string;
  testID?: string;
}

function ReportFigureCardComponent({
  label,
  value,
  stars,
  note,
  spoken,
  icon,
  tint,
  style,
  onPress,
  accessibilityHint,
  testID,
}: ReportFigureCardProps) {
  const theme = useTheme();
  const part = (name: string) => (testID ? `${testID}-${name}` : undefined);

  const glyph = (
    <View
      style={[
        styles.glyph,
        {
          width: theme.spacing.xxxl,
          height: theme.spacing.xxxl,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors[tint],
        },
      ]}>
      <Icon name={icon} size="sm" color={SUBTLE_INK[tint]} />
    </View>
  );

  const body = (
    <View
      style={{ gap: theme.spacing.sm }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {onPress ? (
        <View style={styles.glyphRow}>
          {glyph}
          {/* Affordance only; the card is the target. */}
          <Icon name="forward" size="sm" color="textTertiary" />
        </View>
      ) : (
        glyph
      )}

      {value !== undefined ? (
        // Wraps under a very large font rather than pushing the stars off the card.
        <View style={[styles.figure, { columnGap: theme.spacing.md, rowGap: theme.spacing.xs }]}>
          <Text variant="h1" testID={part('value')}>
            {value}
          </Text>
          {stars !== undefined ? <StarRating value={stars} size="sm" /> : null}
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="caption" color="textSecondary" testID={part('label')}>
          {label}
        </Text>
        {note ? (
          <Text
            // Standing in for a missing figure, it is the card's message, not a footnote.
            variant={value === undefined ? 'bodyStrong' : 'caption'}
            color={value === undefined ? 'textPrimary' : 'textSecondary'}
            testID={part('note')}>
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Card
        bordered
        shadow="sm"
        style={style}
        onPress={onPress}
        accessibilityLabel={spoken}
        accessibilityHint={accessibilityHint}
        testID={testID}>
        {body}
      </Card>
    );
  }

  return (
    <Card bordered shadow="sm" style={style} testID={testID}>
      <View accessible accessibilityRole="text" accessibilityLabel={spoken}>
        {body}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  figure: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});

export const ReportFigureCard = memo(ReportFigureCardComponent);
