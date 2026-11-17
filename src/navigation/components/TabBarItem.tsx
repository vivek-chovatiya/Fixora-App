/**
 * TabBarItem
 *
 * One destination in the bar: the touch target, the icon and the label.
 *
 * It reports where its centre is and does not care what is done with that. The
 * floating button is placed by the bar, so an item never has to know whether it
 * is the one being pointed at — only whether it is selected, which changes what
 * it draws rather than where it sits.
 *
 * ⚠️ Selection is never carried by the animation. The role is `tab`, the state
 * says `selected`, and the label changes weight as well as colour — so the
 * active destination is legible to a screen reader, in greyscale, and with
 * every animation in the operating system turned off.
 *
 * The icon fades out when this item is selected, because the floating button
 * above it is now holding that icon. It fades back in the moment the button
 * leaves.
 */

import React, { memo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/shared/theme';

export interface TabBarItemProps {
  index: number;
  isFocused: boolean;
  icon: ReactNode;
  label: ReactNode;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress: () => void;
  /** Reports this item's horizontal centre within the bar. */
  onMeasure: (index: number, centre: number) => void;
  /** Which tab is being held down, or -1. Owned by the bar. */
  pressedIndex: SharedValue<number>;
  testID?: string;
}

/** How far the icon and label compress while held. */
const PRESS_SCALE = 0.96;

function TabBarItemComponent({
  index,
  isFocused,
  icon,
  label,
  accessibilityLabel,
  onPress,
  onLongPress,
  onMeasure,
  pressedIndex,
  testID,
}: TabBarItemProps) {
  const theme = useTheme();
  const isReduced = useReducedMotion();

  /** 1 while this item's own icon is its own to draw, 0 while the button has it. */
  const iconVisibility = useSharedValue(isFocused ? 0 : 1);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const { duration, easing } = theme.animation;

    if (isFirstRender.current) {
      // The bar arrives with a tab already selected. Fading its icon out on
      // mount would announce a change that did not happen.
      isFirstRender.current = false;
      iconVisibility.value = isFocused ? 0 : 1;
      return;
    }

    if (isFocused) {
      /*
        Held back until the button is most of the way here.

        Hiding it the instant the tab is tapped leaves an empty slot for as long
        as the button takes to arrive, and an empty slot reads as a missing
        icon rather than as one in transit. The delay is the icon crossfade's
        length, by which point the spring has covered most of the distance.
      */
      iconVisibility.value = withDelay(
        isReduced ? 0 : duration.normal,
        withTiming(0, { duration: isReduced ? 0 : duration.fast, easing: easing.standard }),
      );
      return;
    }

    // Nothing to wait for on the way out: the button has already left.
    iconVisibility.value = withTiming(1, {
      duration: isReduced ? 0 : duration.normal,
      easing: easing.standard,
    });
  }, [isFocused, isReduced, iconVisibility, theme]);

  const press = useDerivedValue(() =>
    withTiming(pressedIndex.value === index ? PRESS_SCALE : 1, {
      duration: isReduced ? 0 : theme.animation.duration.fast,
      easing: theme.animation.easing.standard,
    }),
  );

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconVisibility.value,
  }));

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      onMeasure(index, x + width / 2);
    },
    [index, onMeasure],
  );

  const handlePressIn = useCallback(() => {
    pressedIndex.value = index;
  }, [index, pressedIndex]);

  const handlePressOut = useCallback(() => {
    pressedIndex.value = -1;
  }, [pressedIndex]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLayout={handleLayout}
      // The whole item, including the rounded end caps: a bar this size has no
      // room to waste on padding that cannot be hit.
      style={[styles.item, { paddingVertical: theme.spacing.md }]}
      testID={testID}>
      <Animated.View style={[styles.content, contentStyle, { gap: theme.spacing.xxs }]}>
        {/*
          Hidden from assistive technology, and not because it is unimportant.

          The icon set draws its glyphs as text in a private-use codepoint. Left
          visible to the accessibility layer it is folded into the tab's spoken
          name, and the tab announces itself as an unpronounceable character
          followed by its label. The tab carries its name explicitly instead.
        */}
        <Animated.View
          style={iconStyle}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {icon}
        </Animated.View>
        {label}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    // Equal shares of the bar, which is what makes the centres the button
    // travels between evenly spaced without anything having to say so.
    flex: 1,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const TabBarItem = memo(TabBarItemComponent);
