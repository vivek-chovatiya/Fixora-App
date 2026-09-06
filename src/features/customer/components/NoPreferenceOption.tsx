/**
 * NoPreferenceOption
 *
 * Choosing nobody in particular — open dispatch (PROJECT_BIBLE.md section 18A).
 *
 * ⚠️ Not a vendor, and deliberately not shaped like one. Section 18A.5 says
 * skipping must be a first-class, visible action rather than a hidden path, and
 * 18A says most customers are expected to take it — but a fake vendor card
 * called "Any available professional" would put a non-existent business in a
 * list of real ones, and the identifier it would need is exactly the sentinel
 * the request contract refuses to carry.
 *
 * So it is a real option in the same group, with the same selection chrome, and
 * an icon rather than an avatar: it is an action, not a business.
 *
 * It is always present. Section 18A.4 requires an empty or failed vendor list to
 * leave submission open, and this is what makes that true — it does not depend
 * on the query having succeeded.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SelectableCard } from '@/features/customer/components/SelectableCard';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.preferredVendor;

export interface NoPreferenceOptionProps {
  selected: boolean;
  onSelect: () => void;
  testID?: string;
}

function NoPreferenceOptionComponent({ selected, onSelect, testID }: NoPreferenceOptionProps) {
  const theme = useTheme();

  return (
    <SelectableCard
      selected={selected}
      onPress={onSelect}
      accessibilityLabel={`${COPY.noPreferenceTitle}. ${COPY.noPreferenceMessage}`}
      accessibilityHint={COPY.noPreferenceHint}
      testID={testID}>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <View
          style={[
            styles.glyph,
            {
              backgroundColor: theme.colors.primarySubtle,
              borderRadius: theme.radius.full,
              width: theme.spacing.giant,
              height: theme.spacing.giant,
            },
          ]}>
          <Icon name="team" size="md" color="primary" />
        </View>

        <View style={[styles.body, { gap: theme.spacing.xxs }]}>
          <Text variant="bodyStrong">{COPY.noPreferenceTitle}</Text>
          <Text variant="caption" color="textSecondary">
            {COPY.noPreferenceMessage}
          </Text>
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
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
});

export const NoPreferenceOption = memo(NoPreferenceOptionComponent);
