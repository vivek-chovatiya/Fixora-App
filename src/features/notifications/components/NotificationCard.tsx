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
 *
 * ⚠️ Swiping it left deletes it (T133, phase5-contract.md section 3,
 * 28/11/2026), through `ReanimatedSwipeable`: dragged past 60% of its width
 * (`DELETE_SWIPE_SHARE`) and let go, the card slides away over a red "Delete"
 * panel and is gone; released short of that, it springs back and nothing
 * happens. It was half the width until a review found a partial swipe deleting
 * (28/11/2026). The share is the swipe's own `rightThreshold`, so the library
 * decides open or spring back at release and `onSwipeableOpen` only ever hears
 * a swipe that crossed it. That decision adds 5% of the release speed to the
 * distance (the library's toss): a quick, deliberate flick crosses a little
 * sooner, and a drag that slows to a stop short of 60% never does. The row
 * cannot be swiped at all until it has been measured — a threshold of zero
 * would delete on any touch. A swipe is not something a
 * screen reader can do, so every row also offers "Delete" as an accessibility
 * action on whichever element is its focus stop — the card when it is a
 * button, its one spoken block when it is not. The card hands back the id and
 * removes nothing itself; whether it is gone is the screen's to say.
 *
 * ⚠️ The red panel is invisible until the card moves. It sits under the card,
 * and the card fades a little while pressed (`opacity.pressed`), which showed
 * red through every tap; and the swipe's container is not clipped, so the
 * card's shadow is not cut off at its edge either.
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { presentNotification } from '@/features/notifications/constants/notificationPresentation';
import { Card, DynamicIcon, Icon, Text } from '@/shared/components';
import type { AppNotification } from '@/shared/services/types/NotificationService';
import { useTheme } from '@/shared/theme';

const COPY = NOTIFICATIONS_COPY.inbox;

/**
 * The one accessibility action a row offers. One identity, so a row is not
 * handed a new array each render.
 *
 * ⚠️ `label` is a getter, read when a row hands the action to the screen
 * reader. It was the word itself, read when this module loaded, so TalkBack
 * kept offering "Delete" in that moment's language after the app switched
 * (Phase 5, 28/11/2026). The switch re-mounts every row, so the native view
 * is given the new word even though the array is the same one.
 */
const DELETE_ACTION = 'delete';
const DELETE_ACTIONS = Object.freeze([
  Object.freeze({
    name: DELETE_ACTION,
    get label(): string {
      return COPY.deleteAction;
    },
  }),
]);

/**
 * How much of its own width a row must be dragged before letting go deletes
 * it (see the header). A share, not a distance, so it means the same on every
 * screen width.
 */
export const DELETE_SWIPE_SHARE = 0.6;

export interface NotificationCardProps {
  notification: AppNotification;
  /** Receives the notification's id. The card never navigates itself. */
  onPress: (notificationId: string) => void;
  /** Receives the id when it is swiped away or deleted by a screen reader's action. */
  onDelete: (notificationId: string) => void;
  testID?: string;
}

function NotificationCardComponent({ notification, onPress, onDelete, testID }: NotificationCardProps) {
  const theme = useTheme();
  const unread = !notification.read;

  const { time, spoken, opensRequest } = useMemo(
    () => presentNotification(notification),
    [notification],
  );

  const press = useCallback(() => {
    onPress(notification.id);
  }, [onPress, notification.id]);

  const remove = useCallback(() => {
    onDelete(notification.id);
  }, [onDelete, notification.id]);

  /*
    The row's width, for the swipe's threshold. Measured by a view of its own:
    the swipe's container keeps `onLayout` for itself, and the window's width
    is not the row's.
  */
  const [rowWidth, setRowWidth] = useState(0);
  const measure = useCallback((event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  }, []);
  const measured = rowWidth > 0;

  const act = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === DELETE_ACTION) {
        remove();
      }
    },
    [remove],
  );

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

  const card = (
    <Card
      bordered
      shadow="sm"
      onPress={pressable ? press : undefined}
      // The card is the button, so the card carries the whole announcement.
      accessibilityLabel={pressable ? spoken : undefined}
      accessibilityHint={pressable ? hint : undefined}
      accessibilityActions={pressable ? DELETE_ACTIONS : undefined}
      onAccessibilityAction={pressable ? act : undefined}
      testID={testID}>
      {/*
        Hidden from assistive technology when the card is a button, which has
        already said all of it. A card that is not a button speaks as one block
        instead — the same sentence — rather than as four loose fragments, and
        that block carries the Delete action the button would have.
      */}
      <View
        style={[styles.row, { gap: theme.spacing.md }]}
        accessible={!pressable}
        accessibilityLabel={pressable ? undefined : spoken}
        accessibilityActions={pressable ? undefined : DELETE_ACTIONS}
        onAccessibilityAction={pressable ? undefined : act}
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

  return (
    <View onLayout={measure} testID={testID ? `${testID}-row` : undefined}>
      <ReanimatedSwipeable
        renderRightActions={renderDeleteAction}
        // Not swipeable until measured: with no width there is no threshold,
        // and the library would fall back to its own half.
        enabled={measured}
        // Released past this, the row opens — and opening is deleting; short
        // of it, the library springs it back and nothing is called.
        rightThreshold={measured ? rowWidth * DELETE_SWIPE_SHARE : undefined}
        // Only the right panel exists, so the only way to open is a swipe to the left.
        onSwipeableOpen={remove}
        containerStyle={styles.swipe}
        testID={testID ? `${testID}-swipe` : undefined}>
        {card}
      </ReanimatedSwipeable>
    </View>
  );
}

/** Named once, at module scope, so every row hands the swipe the same function. */
function renderDeleteAction(progress: SharedValue<number>) {
  return <DeleteAction progress={progress} />;
}

interface DeleteActionProps {
  /** 0 while the card is at rest, rising to 1 as it is swiped fully away. */
  progress: SharedValue<number>;
}

/**
 * The red panel the card slides off. The whole row's width, so the card has to
 * travel most of it (`DELETE_SWIPE_SHARE`) before letting go deletes — not the
 * width of a button, which a thumb crosses by accident. Decoration: the row's
 * own Delete action is what a screen reader is offered.
 */
function DeleteAction({ progress }: DeleteActionProps) {
  const theme = useTheme();
  const shown = useAnimatedStyle(() => ({ opacity: progress.value > 0 ? 1 : 0 }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.deleteAction,
        shown,
        {
          backgroundColor: theme.colors.danger,
          // The card's own corners, so none of the red shows round them.
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.spacing.xl,
        },
      ]}>
      <View style={[styles.deleteMark, { gap: theme.spacing.xs }]}>
        <Icon name="remove" size="lg" color="onDanger" />
        <Text variant="label" color="onDanger">
          {COPY.deleteAction}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  swipe: {
    // Not clipped: the card's shadow reaches past its edge (see the header).
    overflow: 'visible',
  },
  deleteAction: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  deleteMark: {
    alignItems: 'center',
  },
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
