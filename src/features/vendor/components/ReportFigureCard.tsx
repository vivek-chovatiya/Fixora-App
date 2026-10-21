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
 */

import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card, Icon, StarRating, Text } from '@/shared/components';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

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
  tint: keyof ColorTokens;
  tintBackground: keyof ColorTokens;
  /** The card's place in the grid. */
  style?: StyleProp<ViewStyle>;
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
  tintBackground,
  style,
  testID,
}: ReportFigureCardProps) {
  const theme = useTheme();
  const part = (name: string) => (testID ? `${testID}-${name}` : undefined);

  return (
    <Card bordered shadow="sm" style={style} testID={testID}>
      <View accessible accessibilityRole="text" accessibilityLabel={spoken}>
        <View
          style={{ gap: theme.spacing.sm }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <View
            style={[
              styles.glyph,
              {
                width: theme.spacing.xxxl,
                height: theme.spacing.xxxl,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors[tintBackground],
              },
            ]}>
            <Icon name={icon} size="sm" color={tint} />
          </View>

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
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  figure: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});

export const ReportFigureCard = memo(ReportFigureCardComponent);
