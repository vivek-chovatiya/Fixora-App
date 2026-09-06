/**
 * Skeleton
 *
 * A block standing in for content that has not arrived.
 *
 * Used instead of a spinner where the shape of what is coming is already known.
 * A spinner says "wait" and nothing else; a skeleton says "wait, and this is
 * what will be here" — so the page does not jump when the data lands, and a
 * slow connection reads as a screen loading rather than as a screen that is
 * empty.
 *
 * It breathes rather than shimmers. A sweeping highlight is a second animation
 * language this application does not otherwise speak, and it draws the eye to
 * the placeholder instead of to the content replacing it. Under reduced motion
 * it holds still and stays perfectly legible, because the tone alone already
 * distinguishes it from a real surface.
 *
 * ⚠️ Decoration. It is hidden from assistive technology, and the section around
 * it is what announces that something is loading — a screen reader should hear
 * "loading" once, not once per grey rectangle.
 *
 * Feature-local on purpose. Home's two sections and the categories grid are all
 * one module, which is not yet the cross-feature pattern that earns a place in
 * the shared library; the moment another feature needs it, this moves to
 * `shared/components` unchanged.
 */

import React, { memo, useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme, type RadiusToken } from '@/shared/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  radiusToken?: RadiusToken;
  style?: StyleProp<ViewStyle>;
}

function SkeletonComponent({
  width = '100%',
  height,
  radiusToken = 'md',
  style,
}: SkeletonProps) {
  const theme = useTheme();
  const isReduced = useReducedMotion();

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isReduced) {
      pulse.value = 1;
      return;
    }

    pulse.value = withRepeat(
      withTiming(theme.opacity.muted, {
        duration: theme.animation.duration.pulse,
        easing: theme.animation.easing.standard,
      }),
      // Forever, and reversing, so it eases back out rather than snapping to
      // full strength at the end of every cycle.
      -1,
      true,
    );

    /*
      Forever means forever unless something stops it.

      A repeat with no end keeps running after the view holding it has gone —
      the data arrives, the placeholder is replaced, and the animation carries
      on driving a shared value nobody is reading. It is invisible, so it never
      looks like a bug; it just costs a frame's work each frame for the life of
      the process, once per placeholder that was ever drawn.
    */
    return () => {
      cancelAnimation(pulse);
    };
  }, [isReduced, pulse, theme]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          width,
          height,
          borderRadius: theme.radius[radiusToken],
          backgroundColor: theme.colors.skeleton,
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export const Skeleton = memo(SkeletonComponent);
