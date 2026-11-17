/**
 * Toast
 *
 * A transient message that floats over whatever the user is doing.
 *
 * It exists because a failure raised by a form is not a destination. ErrorState
 * answers "this screen could not load"; a toast answers "that did not work,
 * carry on" — and rendering the first in place of the second is what pushed a
 * form's own controls off the fold behind an icon the size of a heading.
 *
 * It enters from the top rather than the bottom. A toast is most often raised by
 * a submit, a submit usually happens with the keyboard up, and the bottom of the
 * screen is exactly where the keyboard is.
 *
 * Presentation only. It is handed a message and shows it; it never sees an
 * AppError, so it cannot reach `error.message` even by accident.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

export interface ToastProps {
  message: string;
  /** Tints the icon. Shares ColorTokens with ErrorState so the two cannot drift. */
  tone: keyof ColorTokens;
  icon: IconName;
  /**
   * Drives the animation rather than the mounting.
   *
   * The owner keeps this mounted through the exit and clears it on `onHidden`,
   * because a component unmounted the moment it is dismissed has no frames left
   * in which to animate away.
   */
  isVisible: boolean;
  onDismiss: () => void;
  /** Fired once the exit has finished and nothing is left on screen. */
  onHidden: () => void;
  testID?: string;
}

export function Toast({
  message,
  tone,
  icon,
  isVisible,
  onDismiss,
  onHidden,
  testID,
}: ToastProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  /**
   * A message sliding in from the edge is the kind of motion "reduce motion"
   * exists to switch off. The toast still appears and still withdraws; it just
   * does both instantly.
   */
  const isReduced = useReducedMotion();

  const progress = useSharedValue(0);

  // Captured for the worklet below, which cannot read the theme itself.
  const lift = theme.spacing.md;

  React.useEffect(() => {
    const { duration, easing } = theme.animation;

    progress.value = withTiming(
      isVisible ? 1 : 0,
      {
        // Leaving is quicker than arriving. The user has already read it, and a
        // slow exit keeps a stale message over the screen they moved on to.
        duration: isReduced ? 0 : isVisible ? duration.normal : duration.fast,
        easing: isVisible ? easing.decelerate : easing.accelerate,
      },
      finished => {
        if (finished && !isVisible) {
          runOnJS(onHidden)();
        }
      },
    );
  }, [isVisible, isReduced, theme, progress, onHidden]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -lift }],
  }));

  return (
    // `box-none` so the toast never swallows a tap meant for the screen beneath
    // it. Only the card itself is touchable.
    <View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          top: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.screenPadding,
          zIndex: theme.zIndex.toast,
        },
      ]}>
      <Animated.View
        // Assertive rather than polite: this interrupts because the action the
        // user just took did not happen, and waiting for a pause would announce
        // it after they had already started fixing something else.
        accessibilityLiveRegion="assertive"
        style={[
          styles.card,
          animatedStyle,
          theme.shadows.lg,
          {
            maxWidth: theme.maxContentWidth,
            borderRadius: theme.radius.lg,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
        testID={testID}>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={message}
          accessibilityHint="Dismisses this message"
          style={[
            styles.content,
            { padding: theme.spacing.md, gap: theme.spacing.sm, minHeight: theme.hitSlop.minTarget },
          ]}>
          <Icon name={icon} size="md" color={tone} />

          <Text variant="body" style={styles.message}>
            {message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    // Clips the pressed highlight to the rounded corners on Android.
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    // Takes the space the icon leaves, so a long message wraps instead of
    // pushing the card wider than the screen.
    flex: 1,
  },
});
