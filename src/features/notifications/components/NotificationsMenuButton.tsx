/**
 * NotificationsMenuButton
 *
 * The three dots in the inbox's top corner (T133, 28/11/2026), opening what can
 * be done to the whole inbox — "Mark all as read" and "Clear all", in the
 * screen's `OptionsSheet`.
 *
 * Drawn as `BackButton` and `NotificationBell` are — a raised, ringed disc at
 * the 44dp touch-target floor — because it is the same kind of thing: a control
 * in a screen's top corner, across the bar from the way back. ⚠️ That makes
 * three copies of one disc (each with a different glyph, and the bell with a
 * badge). Folding them into one shared control is a change to the back button
 * every pushed screen draws, so it was left for a change of its own rather
 * than made in passing here.
 *
 * Presentational: it is handed a press and its words, and opens nothing
 * itself. A glyph is not a name, so the spoken label says what it opens.
 */

import React, { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { Icon } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = NOTIFICATIONS_COPY.inbox;

export interface NotificationsMenuButtonProps {
  onPress: () => void;
  testID?: string;
}

function NotificationsMenuButtonComponent({ onPress, testID }: NotificationsMenuButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={COPY.menu}
      accessibilityHint={COPY.menuHint}
      style={({ pressed }) => [
        styles.target,
        theme.shadows.sm,
        {
          width: theme.hitSlop.minTarget,
          height: theme.hitSlop.minTarget,
          borderRadius: theme.radius.full,
          backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.borderStrong,
        },
      ]}
      testID={testID}>
      <Icon name="more" size="lg" color="textPrimary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const NotificationsMenuButton = memo(NotificationsMenuButtonComponent);
