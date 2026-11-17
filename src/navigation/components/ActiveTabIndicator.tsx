/**
 * ActiveTabIndicator
 *
 * The floating button that marks the selected destination — one object that
 * travels along the bar, rather than one that is destroyed at the old tab and
 * built again at the new one.
 *
 * That distinction is the whole point of the component. Two buttons swapping
 * places is read as two things; one button moving is read as a thing with a
 * position, which is what makes a tab bar feel like somewhere you are rather
 * than a set of switches.
 *
 * ⚠️ Decoration, and nothing else. It reports nothing to assistive technology
 * and receives no touches: the selected state lives on the tab itself, as
 * `accessibilityState`, and the tab under this button is what the finger hits.
 * A screen reader user and a user who has turned off animation both learn which
 * destination is active without any of this having moved.
 *
 * It does not know what a route is. The bar hands it a position, a key and a way
 * to draw the icon for a key — so the icon can never be stale, because it is
 * never stored.
 */

import React, { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { tabBarGeometry } from '@/navigation/components/tabBarGeometry';
import { useTheme } from '@/shared/theme';

export interface ActiveTabIndicatorProps {
  /** Horizontal offset of the button's left edge, in the bar's own coordinates. */
  translateX: SharedValue<number>;
  /** Which tab is being held down, or -1. Owned by the bar. */
  pressedIndex: SharedValue<number>;
  /** Index of the selected tab, so the button knows when the press is its own. */
  activeIndex: number;
  /** Identifies the selected destination. A change here starts the crossfade. */
  activeKey: string;
  /** Draws the selected-state icon for a destination. Must be stable. */
  renderIcon: (routeKey: string) => ReactNode;
  testID?: string;
}

/** How far the incoming icon starts from its final size. */
const ENTER_SCALE = 0.75;
/** How far the outgoing icon shrinks as it leaves. */
const EXIT_SCALE = 0.85;
/** The compression a press applies. */
const PRESS_SCALE = 0.96;

function ActiveTabIndicatorComponent({
  translateX,
  pressedIndex,
  activeIndex,
  activeKey,
  renderIcon,
  testID,
}: ActiveTabIndicatorProps) {
  const theme = useTheme();
  const isReduced = useReducedMotion();
  const { diameter, lift } = tabBarGeometry(theme);

  /**
   * The icon on its way out, kept only for as long as it is visible.
   *
   * A key rather than an element: the bar draws both from the same function, so
   * the departing icon picks up a theme change mid-flight instead of fading out
   * in yesterday's colours.
   */
  const [outgoingKey, setOutgoingKey] = useState<string | null>(null);
  const shownKey = useRef(activeKey);

  /** 0 the moment the destination changes, 1 once the new icon has arrived. */
  const swap = useSharedValue(1);

  useEffect(() => {
    if (shownKey.current === activeKey) {
      return;
    }

    setOutgoingKey(shownKey.current);
    shownKey.current = activeKey;

    swap.value = 0;
    swap.value = withTiming(
      1,
      {
        // Deliberately shorter than the travel. The button is still moving when
        // the icon has finished changing, which is the right order: what you are
        // looking at settles before where it is does.
        duration: isReduced ? 0 : theme.animation.duration.normal,
        easing: theme.animation.easing.standard,
      },
      finished => {
        'worklet';
        if (finished) {
          runOnJS(setOutgoingKey)(null);
        }
      },
    );
  }, [activeKey, isReduced, swap, theme]);

  /**
   * Press feedback, derived rather than animated in place.
   *
   * Reading `pressedIndex` inside the button's own style would restart the
   * timing on every frame the style is evaluated. Deriving it once gives the
   * press a single animation to run.
   */
  const press = useDerivedValue(() =>
    withTiming(pressedIndex.value === activeIndex ? PRESS_SCALE : 1, {
      duration: isReduced ? 0 : theme.animation.duration.fast,
      easing: theme.animation.easing.standard,
    }),
  );

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: press.value }],
  }));

  const incomingStyle = useAnimatedStyle(() => ({
    opacity: swap.value,
    transform: [{ scale: ENTER_SCALE + (1 - ENTER_SCALE) * swap.value }],
  }));

  const outgoingStyle = useAnimatedStyle(() => ({
    opacity: 1 - swap.value,
    transform: [{ scale: 1 - (1 - EXIT_SCALE) * swap.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.button,
        buttonStyle,
        theme.shadows.glow,
        {
          top: -lift,
          width: diameter,
          height: diameter,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.primary,
          // Above the bar on Android too, where paint order is decided by
          // elevation before it is decided by document order.
          zIndex: theme.zIndex.raised,
        },
      ]}
      // Nothing to read, nothing to touch: the tab beneath owns both.
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}>
      <Animated.View style={[styles.glyph, incomingStyle]}>
        {renderIcon(activeKey)}
      </Animated.View>

      {outgoingKey === null ? null : (
        <Animated.View style={[styles.glyph, outgoingStyle]}>
          {renderIcon(outgoingKey)}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * Both icons occupy the same box rather than sitting in a row, so neither
   * shifts the other as it fades and the pair stays centred throughout.
   */
  glyph: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const ActiveTabIndicator = memo(ActiveTabIndicatorComponent);
