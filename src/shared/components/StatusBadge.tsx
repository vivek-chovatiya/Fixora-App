/**
 * StatusBadge
 *
 * A compact pill for request status, vendor approval, payment state and priority.
 *
 * Deliberately takes a `label` and a `tone` rather than a status enum.
 * PROJECT_BIBLE.md section 21 forbids the frontend inventing statuses — statuses
 * come from the backend — so hardcoding a status list here would bake business
 * data into a presentation component and require a release whenever the backend
 * added one.
 *
 * Mapping a backend status onto a tone and a human label belongs to the feature
 * module that owns that status.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

/** Semantic emphasis, not a status. */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface TonePalette {
  background: keyof ColorTokens;
  foreground: keyof ColorTokens;
}

const TONES: Readonly<Record<StatusTone, TonePalette>> = {
  neutral: { background: 'neutralSubtle', foreground: 'neutral' },
  info: { background: 'infoSubtle', foreground: 'info' },
  success: { background: 'successSubtle', foreground: 'success' },
  warning: { background: 'warningSubtle', foreground: 'warning' },
  danger: { background: 'dangerSubtle', foreground: 'danger' },
};

export interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  icon?: IconName;
  testID?: string;
}

function StatusBadgeComponent({ label, tone = 'neutral', icon, testID }: StatusBadgeProps) {
  const theme = useTheme();
  const palette = TONES[tone];

  return (
    <View
      testID={testID}
      // Announced as one unit, so a screen reader does not read the icon and
      // label as two unrelated items.
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors[palette.background],
          borderRadius: theme.radius.full,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          gap: theme.spacing.xs,
        },
      ]}>
      {icon ? <Icon name={icon} size="xs" color={palette.foreground} /> : null}
      <Text variant="caption" color={palette.foreground}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});

export const StatusBadge = memo(StatusBadgeComponent);
