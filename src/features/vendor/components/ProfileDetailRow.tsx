/**
 * ProfileDetailRow
 *
 * One read-only fact about the vendor: a label and its value, read as one
 * phrase by a screen reader ("Phone, +91 90000 00001") rather than as two stops.
 *
 * Used by the setup form, for the contact details that come from the account,
 * and by the Profile tab for everything it shows.
 */

import React, { memo } from 'react';
import { View } from 'react-native';

import { Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface ProfileDetailRowProps {
  label: string;
  value: string;
  /** Drawn quieter when the value is a stand-in ("Not added yet") rather than data. */
  muted?: boolean;
  testID?: string;
}

function ProfileDetailRowComponent({ label, value, muted = false, testID }: ProfileDetailRowProps) {
  const theme = useTheme();

  return (
    <View
      style={{ gap: theme.spacing.xxs }}
      accessible
      accessibilityLabel={`${label}, ${value}`}
      testID={testID}>
      <Text variant="caption" color="textTertiary">
        {label}
      </Text>
      <Text variant="body" color={muted ? 'textTertiary' : 'textPrimary'}>
        {value}
      </Text>
    </View>
  );
}

export const ProfileDetailRow = memo(ProfileDetailRowComponent);
