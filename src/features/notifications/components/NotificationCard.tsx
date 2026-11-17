/**
 * NotificationCard
 *
 * One notification in the inbox (PROJECT_BIBLE.md section 57): its icon, its
 * title, a little of its body, and when it came.
 *
 * ⚠️ Unread is never said by colour alone (section 46). An unread title is set
 * in the strong weight, a dot sits beside it, and the icon's disc takes the
 * brand tint; read, all three go quiet. To a screen reader the card begins
 * "Unread." — the dot itself is hidden, being decoration once that is said.
 *
 * ⚠️ The body is cut to two lines on screen and never in the spoken label. The
 * card speaks as one block — state, title, the whole body, when — so nothing
 * the eye is spared is kept from the ear.
 *
 * ⚠️ A button only when pressing it does something. An unread notification can
 * be marked as read, and one whose link opens a request can open it; a read
 * notification with no link the app understands is information and nothing
 * more, so it is not announced as a button that does nothing. The card hands
 * back the notification's id and never navigates itself; what a press does is
 * the screen's to decide.
 *
 * The icon is the backend's glyph (`resolveRemoteIcon` via `DynamicIcon`, which
 * falls back safely); with none, the bell — never a glyph chosen from `type`,
 * which the app must not read.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { presentNotification } from '@/features/notifications/constants/notificationPresentation';
import { Card, DynamicIcon, Icon, Text } from '@/shared/components';
import type { AppNotification } from '@/shared/services/types/NotificationService';
import { useTheme } from '@/shared/theme';

const COPY = NOTIFICATIONS_COPY.inbox;

export interface NotificationCardProps {
  notification: AppNotification;
  /** Receives the notification's id. The card never navigates itself. */
  onPress: (notificationId: string) => void;
  testID?: string;
}

function NotificationCardComponent({ notification, onPress, testID }: NotificationCardProps) {
  const theme = useTheme();
  const unread = !notification.read;

  const { time, spoken, opensRequest } = useMemo(
    () => presentNotification(notification),
    [notification],
  );

  const press = useCallback(() => {
    onPress(notification.id);
  }, [onPress, notification.id]);

  const pressable = unread || opensRequest;
  const hint = opensRequest
    ? unread
      ? COPY.openRequestHint
      : COPY.openReadRequestHint
    : COPY.markReadHint;

  /*
    The disc is sized from the icon and the gap around it, so it stays a circle
    whatever the glyph; a glyph from the backend is drawn at the same size.
  */
  const discSize = theme.iconSize.lg + theme.spacing.lg;

  return (
    <Card
      bordered
      shadow="sm"
      onPress={pressable ? press : undefined}
      // The card is the button, so the card carries the whole announcement.
      accessibilityLabel={pressable ? spoken : undefined}
      accessibilityHint={pressable ? hint : undefined}
      testID={testID}>
      {/*
        Hidden from assistive technology when the card is a button, which has
        already said all of it. A card that is not a button speaks as one block
        instead — the same sentence — rather than as four loose fragments.
      */}
      <View
        style={[styles.row, { gap: theme.spacing.md }]}
        accessible={!pressable}
        accessibilityLabel={pressable ? undefined : spoken}
        accessibilityElementsHidden={pressable}
        importantForAccessibility={pressable ? 'no-hide-descendants' : 'yes'}
        testID={testID ? `${testID}-content` : undefined}>
        <View
          style={[
            styles.disc,
            {
              width: discSize,
              height: discSize,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors[unread ? 'primarySubtle' : 'surfaceAlt'],
            },
          ]}>
          {notification.iconName ? (
            <DynamicIcon
              glyph={notification.iconName}
              size="lg"
              color={unread ? 'onPrimarySubtle' : 'textSecondary'}
            />
          ) : (
            <Icon name="notifications" size="lg" color={unread ? 'onPrimarySubtle' : 'textSecondary'} />
          )}
        </View>

        <View style={[styles.copy, { gap: theme.spacing.xs }]}>
          <View style={[styles.titleRow, { gap: theme.spacing.sm }]}>
            {/*
              `flex: 1`, not `flexShrink`: a wrapping title measured at its own
              width in a row can lose its last line at low density (see the
              lessons in docs/WORKING_NOTES.md).
            */}
            <Text
              variant={unread ? 'bodyStrong' : 'body'}
              style={styles.title}
              testID={testID ? `${testID}-title` : undefined}>
              {notification.title}
            </Text>

            {unread ? (
              <View
                style={[
                  styles.dot,
                  {
                    width: theme.spacing.sm,
                    height: theme.spacing.sm,
                    // Level with the first line of the title, however many it wraps to.
                    marginTop: (theme.typography.lineHeight.md - theme.spacing.sm) / 2,
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
                testID={testID ? `${testID}-unread` : undefined}
              />
            ) : null}
          </View>

          <Text
            variant="body"
            color="textSecondary"
            numberOfLines={2}
            testID={testID ? `${testID}-body` : undefined}>
            {notification.body}
          </Text>

          {time ? (
            <Text variant="caption" color="textTertiary" testID={testID ? `${testID}-time` : undefined}>
              {time}
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
    alignItems: 'flex-start',
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
  },
  dot: {
    flexShrink: 0,
  },
});

export const NotificationCard = memo(NotificationCardComponent);
