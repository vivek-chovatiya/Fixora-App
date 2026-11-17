/**
 * OnboardingPagination
 *
 * Where the user is in the introduction, as dots.
 *
 * The active dot widens rather than only changing colour. Colour alone would put
 * the whole of the information in a hue, which is exactly what a colour-blind
 * user cannot read — shape carries it as well, so the position survives being
 * seen in greyscale.
 *
 * One accessible node, not three. Announcing "dot, dot, dot" says nothing; the
 * group reports its position in words instead, and the individual dots are
 * hidden from assistive technology.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ONBOARDING_COPY } from '@/features/onboarding/constants/onboardingCopy';
import { useTheme } from '@/shared/theme';

export interface OnboardingPaginationProps {
  count: number;
  /** Zero-based. */
  activeIndex: number;
  testID?: string;
}

function OnboardingPaginationComponent({ count, activeIndex, testID }: OnboardingPaginationProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={ONBOARDING_COPY.stepLabel(activeIndex + 1, count)}
      style={[styles.row, { gap: theme.spacing.sm }]}
      testID={testID}>
      {Array.from({ length: count }, (_, index) => (
        <Dot key={index} isActive={index === activeIndex} />
      ))}
    </View>
  );
}

function Dot({ isActive }: { isActive: boolean }) {
  const theme = useTheme();
  const isReduced = useReducedMotion();

  const progress = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    const { duration, easing } = theme.animation;

    progress.value = withTiming(isActive ? 1 : 0, {
      duration: isReduced ? 0 : duration.normal,
      easing: easing.standard,
    });
  }, [isActive, isReduced, progress, theme]);

  // A dot is a touch target's quarter, which keeps the row visible without it
  // competing with the button beneath.
  const diameter = theme.spacing.sm;
  const activeWidth = diameter * 3;

  const style = useAnimatedStyle(() => ({
    width: diameter + (activeWidth - diameter) * progress.value,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          height: diameter,
          borderRadius: theme.radius.full,
          backgroundColor: isActive ? theme.colors.primary : theme.colors.border,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const OnboardingPagination = memo(OnboardingPaginationComponent);
