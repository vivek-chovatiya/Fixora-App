/**
 * Toggle
 *
 * Themed on/off switch. The platform default thumb (teal on many Android skins)
 * clashed with the brand colour, so every switch goes through here.
 */

import React, { memo } from 'react';
import { Platform, Switch } from 'react-native';

import { useTheme } from '@/shared/theme';

export interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  /** Use the success colour for "on" (e.g. availability) instead of the brand colour. */
  tone?: 'primary' | 'success';
}

function ToggleComponent({ value, onValueChange, disabled, testID, accessibilityLabel, tone = 'primary' }: ToggleProps) {
  const theme = useTheme();
  const on = tone === 'success' ? theme.colors.success : theme.colors.primary;
  return (
    <Switch
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      thumbColor={Platform.OS === 'android' ? theme.colors.surface : undefined}
      trackColor={{ true: on, false: theme.colors.borderStrong }}
      ios_backgroundColor={theme.colors.borderStrong}
      {...(Platform.OS === 'web' ? ({ activeThumbColor: theme.colors.surface } as object) : {})}
    />
  );
}

export const Toggle = memo(ToggleComponent);
