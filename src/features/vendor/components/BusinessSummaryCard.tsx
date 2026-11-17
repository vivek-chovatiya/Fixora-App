/**
 * BusinessSummaryCard
 *
 * The business this dashboard belongs to — its picture, its name, what it does
 * and where — and the way to the Profile tab.
 *
 * ⚠️ A summary, not an editor. Nothing here is typed into; pressing it opens the
 * profile, where editing lives (Phase 3E-1). The card is the button, so the card
 * carries the whole sentence and the rows inside it are hidden from assistive
 * technology rather than read a second time.
 *
 * A long business name takes two lines and then truncates; the spoken label
 * always has the whole of it. Services and area are left out, not shown blank,
 * when the profile has none to show.
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { Avatar, Card, Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.dashboard;

export interface BusinessSummaryCardProps {
  businessName: string;
  imageUrl?: string;
  /** Category names, already resolved. Empty while they load or when there are none. */
  services: string[];
  serviceArea?: string;
  onPress: () => void;
  testID?: string;
}

function BusinessSummaryCardComponent({
  businessName,
  imageUrl,
  services,
  serviceArea,
  onPress,
  testID,
}: BusinessSummaryCardProps) {
  const theme = useTheme();
  const serviceText = services.join(', ');

  const spokenLabel = useMemo(
    () =>
      [
        businessName,
        serviceText ? `${COPY.businessServicesLabel}: ${serviceText}` : '',
        serviceArea ? `${COPY.businessAreaLabel}: ${serviceArea}` : '',
      ]
        .filter(Boolean)
        .join('. '),
    [businessName, serviceArea, serviceText],
  );

  return (
    <Card
      bordered
      shadow="sm"
      onPress={onPress}
      accessibilityLabel={spokenLabel}
      accessibilityHint={COPY.businessHint}
      testID={testID}>
      <View
        style={[styles.row, { gap: theme.spacing.md }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Avatar uri={imageUrl} name={businessName} size="md" fallbackIcon="business" />

        <View style={[styles.copy, { gap: theme.spacing.xxs }]}>
          <Text variant="bodyStrong" numberOfLines={2} testID={testID ? `${testID}-name` : undefined}>
            {businessName}
          </Text>

          {serviceText ? (
            <Text variant="caption" color="textSecondary" numberOfLines={2}>
              {serviceText}
            </Text>
          ) : null}

          {serviceArea ? (
            <View style={[styles.line, { gap: theme.spacing.xxs }]}>
              <Icon name="location" size="xs" color="textTertiary" />
              <Text variant="caption" color="textTertiary" numberOfLines={1} style={styles.shrinks}>
                {serviceArea}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Affordance only; the card is the target. */}
        <Icon name="forward" size="sm" color="textTertiary" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    // Takes the slack, so a long name wraps inside the card instead of pushing
    // the chevron off it.
    flex: 1,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shrinks: {
    flexShrink: 1,
  },
});

export const BusinessSummaryCard = memo(BusinessSummaryCardComponent);
