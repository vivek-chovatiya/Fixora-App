/**
 * VendorReviewCard
 *
 * One customer review, as the vendor it is about reads it (PROJECT_BIBLE.md
 * section 41): who wrote it, the stars, when, which job, and what they said.
 *
 * ⚠️ Read-only, and nothing on it suggests otherwise. It is not a button and
 * holds none — section 41: "Vendor cannot edit customer reviews" — and there is
 * no reply, report or contact beside it.
 *
 * ⚠️ One block for a screen reader, so a name, a rating and a comment are never
 * heard apart from each other (`presentVendorReview` writes the sentence). The
 * stars are the customer's own `StarRating`, filled against outlined — shape,
 * not colour — and hidden inside the block so they are not said twice.
 *
 * ⚠️ The comment is drawn whole. Section 24's ceiling (500 characters) is a
 * paragraph, which wraps on any phone; cutting it short would put a "more"
 * control on a screen that otherwise has nothing to press, and Fixora has no
 * expand pattern to reuse. A long name wraps to two lines and is then cut off
 * on screen, never in what is spoken. The name is already shortened to a first
 * name and last initial by `presentVendorReview` (owner decision, 21/10/2026):
 * this card never sees the surname, and must never be handed it.
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { presentVendorReview } from '@/features/vendor/constants/reviewPresentation';
import { Card, StarRating, Text } from '@/shared/components';
import type { VendorReview } from '@/shared/services/types/ReviewService';
import { useTheme } from '@/shared/theme';

export interface VendorReviewCardProps {
  review: VendorReview;
  testID?: string;
}

function VendorReviewCardComponent({ review, testID }: VendorReviewCardProps) {
  const theme = useTheme();
  const shown = useMemo(() => presentVendorReview(review), [review]);

  return (
    <Card bordered shadow="sm" testID={testID}>
      <View accessible accessibilityRole="text" accessibilityLabel={shown.spoken}>
        <View
          style={{ gap: theme.spacing.sm }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {shown.customerName ? (
            <Text
              variant="bodyStrong"
              numberOfLines={2}
              testID={testID ? `${testID}-customer` : undefined}>
              {shown.customerName}
            </Text>
          ) : null}

          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <StarRating value={review.rating} size="sm" />
            {shown.date ? (
              <Text variant="caption" color="textTertiary" numberOfLines={1} style={styles.shrinks}>
                {shown.date}
              </Text>
            ) : null}
          </View>

          <Text
            variant="caption"
            color="textSecondary"
            numberOfLines={2}
            testID={testID ? `${testID}-context` : undefined}>
            {shown.context}
          </Text>

          {shown.comment ? (
            <Text variant="body" testID={testID ? `${testID}-comment` : undefined}>
              {shown.comment}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shrinks: {
    // One line beside the stars; truncates rather than pushing them off the card.
    flexShrink: 1,
  },
});

export const VendorReviewCard = memo(VendorReviewCardComponent);
