/**
 * NotificationBell
 *
 * The way into the inbox from the top of Customer Home and the Vendor
 * Dashboard (PROJECT_BIBLE.md section 57), with how many are unread.
 *
 * Drawn as `BackButton` is — a raised, ringed disc at the 44dp touch-target
 * floor — because it is the same kind of thing: a control in a screen's top
 * corner. A bare glyph on a page is a mark; a disc under it is a control.
 *
 * ⚠️ Presentational. It is handed a count and a press handler and knows
 * neither where it leads nor how the count is read — the screen navigates and
 * `useUnreadNotifications` reads, so the bell cannot drift between the two
 * applications that draw it.
 *
 * ⚠️ The badge is not the only way the count is said. It is hidden inside the
 * button, whose spoken name carries the exact number ("Notifications, 12
 * unread") where the badge stops at "9+"; with no count — none unread, or the
 * read failed — there is no badge and the name is "Notifications".
 *
 * The badge is `danger` — the navigation theme's `notification` colour, so the
 * app has one notification red — with `onDanger` digits.
 *
 * ⚠️ Not `textInverse`: that is near-black in dark mode, 4.2:1 on this red,
 * under the 4.5:1 that text this small needs. White is 4.8:1 in both themes,
 * and `DangerButton` labels with it too since 21/10/2026.
 */

import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { presentUnreadBadge } from '@/features/notifications/constants/notificationPresentation';
import { Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = NOTIFICATIONS_COPY.bell;

export interface NotificationBellProps {
  /** Unread notifications, or null when unknown. Null and zero draw no badge. */
  unreadCount: number | null;
  /** Usually opens the inbox. The bell never navigates itself. */
  onPress: () => void;
  testID?: string;
}

function NotificationBellComponent({ unreadCount, onPress, testID }: NotificationBellProps) {
  const theme = useTheme();
  const { badge, spoken } = presentUnreadBadge(unreadCount);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={COPY.hint}
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
      <Icon name="notifications" size="lg" color="textPrimary" />

      {badge ? (
        <View
          // Inside the button, which already says the number in words.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.badge,
            {
              // At least a circle; "9+" widens it into a capsule rather than squeezing.
              minWidth: theme.spacing.xl,
              minHeight: theme.spacing.xl,
              paddingHorizontal: theme.spacing.xs,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.danger,
            },
          ]}
          testID={testID ? `${testID}-badge` : undefined}>
          <Text variant="label" color="onDanger" numberOfLines={1}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    // On the bell's shoulder, inside the disc's square, so nothing draws outside
    // the touch target or is clipped by the row the bell sits in.
    position: 'absolute',
    top: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const NotificationBell = memo(NotificationBellComponent);
