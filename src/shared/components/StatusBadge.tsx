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
 *
 * ⚠️ The words are 12sp caption, so they need 4.5:1 on their tint in both
 * themes (Phase 3G-4, 21/10/2026, measured from the theme by the suite). A
 * tone's own colour is not readable on its own tint — danger was 3.9:1 light
 * and 3.3:1 dark, info 4.2 / 4.0, success 3.0 and warning 2.9 in light — so
 * each coloured tint has its own ink: `onDangerSubtle`, `onInfoSubtle`,
 * `onSuccessSubtle`, `onWarningSubtle` (5.5–9.0:1). The neutral grey was
 * 4.4:1 in light, and is now `textSecondary` — the same grey family, one step
 * darker in light and the very same value in dark (6.9 / 5.8).
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { SUBTLE_INK, useTheme, type ColorTokens, type IconName } from '@/shared/theme';

/** Semantic emphasis, not a status. */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface TonePalette {
  background: keyof ColorTokens;
  foreground: keyof ColorTokens;
}

/** The tone's tint, and that tint's own ink from the theme's one table (3G-4). */
function toneOf(tone: StatusTone): TonePalette {
  const background = `${tone}Subtle` as const;
  return { background, foreground: SUBTLE_INK[background] };
}

const TONES: Readonly<Record<StatusTone, TonePalette>> = {
  neutral: toneOf('neutral'),
  info: toneOf('info'),
  success: toneOf('success'),
  warning: toneOf('warning'),
  danger: toneOf('danger'),
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
