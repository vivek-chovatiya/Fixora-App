/**
 * VendorOption
 *
 * One vendor, as something to choose.
 *
 * ⚠️ Every line is the backend's. PROJECT_BIBLE.md section 18A.3 says display
 * only what the backend provides and infer none of it, so the rating is drawn
 * rather than computed, the distance is a label rather than a calculation, and
 * availability is the backend's sentence rather than the app's reading of a
 * timetable. A vendor arriving with nothing but a name renders as a name — that
 * is a new vendor, not a broken row.
 *
 * The identifier is never drawn and never spoken. It is what gets submitted, and
 * it is the one thing on the card the customer has no use for.
 *
 * Rating and review count are one line, not two. "4.8" alone flatters a vendor
 * with three reviews, and section 46's rule about meaning that rests on a single
 * signal applies to numbers as much as to colour.
 */

import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { SelectableCard } from '@/features/customer/components/SelectableCard';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { Avatar, Icon, Text } from '@/shared/components';
import type { EligibleVendor } from '@/shared/services/types/VendorService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.preferredVendor;

export interface VendorOptionProps {
  vendor: EligibleVendor;
  selected: boolean;
  onSelect: (vendorId: string) => void;
  testID?: string;
}

/** One decimal, because that is how a rating out of five is read aloud. */
function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * The card's spoken name: everything drawn on it, in reading order, as a
 * sentence. Assembled here rather than left to the children, because the card
 * is one control and a control has one name.
 */
function describe(vendor: EligibleVendor): string {
  const parts = [vendor.name];

  if (vendor.rating !== undefined) {
    parts.push(
      vendor.reviewCount === undefined
        ? `${formatRating(vendor.rating)} ${COPY.ratingUnit}`
        : `${formatRating(vendor.rating)} ${COPY.ratingUnit}, ${vendor.reviewCount} ${COPY.reviewsUnit}`,
    );
  }

  if (vendor.areaLabel) {
    parts.push(vendor.areaLabel);
  }

  if (vendor.availabilityLabel) {
    parts.push(vendor.availabilityLabel);
  }

  return parts.join('. ');
}

function VendorOptionComponent({ vendor, selected, onSelect, testID }: VendorOptionProps) {
  const theme = useTheme();

  const handlePress = useCallback(() => onSelect(vendor.id), [onSelect, vendor.id]);

  const hasMeta = vendor.rating !== undefined || Boolean(vendor.areaLabel);

  return (
    <SelectableCard
      selected={selected}
      onPress={handlePress}
      accessibilityLabel={describe(vendor)}
      accessibilityHint={COPY.vendorHint}
      testID={testID}>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <Avatar uri={vendor.imageUrl} name={vendor.name} size="md" fallbackIcon="business" />

        <View style={[styles.body, { gap: theme.spacing.xxs }]}>
          <Text variant="bodyStrong">{vendor.name}</Text>

          {hasMeta ? (
            <View style={[styles.meta, { gap: theme.spacing.sm }]}>
              {vendor.rating !== undefined ? (
                <View style={[styles.rating, { gap: theme.spacing.xxs }]}>
                  <Icon name="star" size="xs" color="warning" />
                  <Text variant="caption" color="textSecondary">
                    {vendor.reviewCount === undefined
                      ? formatRating(vendor.rating)
                      : `${formatRating(vendor.rating)} (${vendor.reviewCount})`}
                  </Text>
                </View>
              ) : null}

              {vendor.areaLabel ? (
                <Text variant="caption" color="textSecondary">
                  {vendor.areaLabel}
                </Text>
              ) : null}
            </View>
          ) : null}

          {vendor.availabilityLabel ? (
            <Text variant="caption" color="textTertiary">
              {vendor.availabilityLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </SelectableCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    // Wraps rather than clipping, so a long area label keeps the rating beside
    // it on the narrowest screen instead of pushing it out of the card.
    flexWrap: 'wrap',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export const VendorOption = memo(VendorOptionComponent);
