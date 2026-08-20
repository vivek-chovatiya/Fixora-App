/**
 * VerificationScene
 *
 * The verification visual, shared by every flow that checks a code: customer
 * sign in, vendor onboarding, and vendor auth-code confirmation.
 *
 * The row of characters does not fade out and hand over to an unrelated
 * animation. The same elements curl from the row onto the ring and orbit there,
 * so what the user watches is visibly the code they typed being checked. That
 * continuity is the point of the effect, and it is why the cells and the orbit
 * live in one component rather than two: they share a coordinate space, and
 * splitting them would leave nothing to curl.
 *
 * Presentation only. It takes a status and some characters and reaches nothing —
 * no service, no store, no session, no navigation, no registration id. It cannot
 * decide that a code is correct, which is the backend's answer, and it cannot
 * leak one, because it is never told anything it is not asked to draw.
 *
 * Motion runs on the UI thread through shared values. No frame of this animation
 * passes through React state.
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';

import {
  ORBIT_SWEEP,
  nodeSize as resolveNodeSize,
  orbitAngle,
  orbitRadius,
  rowOffset,
  sceneSide,
} from './verificationGeometry';

/**
 * Where a verification has got to.
 *
 * `entered` is deliberately distinct from `idle`: the code is complete but
 * nothing has been sent, which is the beat the row uses to settle before it
 * curls. Collapsing the two would start the curl on the same frame as the final
 * keystroke, before the user has seen what they typed.
 */
export type VerificationStatus = 'idle' | 'entered' | 'verifying' | 'verified';

export interface VerificationSceneProps {
  status: VerificationStatus;
  /** One node per character. Use an empty string for an unfilled cell. */
  characters: readonly string[];
  /** Cell the caret sits in, while the code is still a row. */
  focusedIndex?: number;
  /** Tints the row when the last attempt was rejected. */
  hasError?: boolean;
  testID?: string;
}

function VerificationSceneComponent({
  status,
  characters,
  focusedIndex,
  hasError = false,
  testID,
}: VerificationSceneProps) {
  const theme = useTheme();

  // Measured rather than assumed. Costs a render when the container changes
  // size, and nothing at all while the animation runs.
  const [width, setWidth] = useState(0);

  /**
   * Honoured rather than ignored: an orbiting ring is exactly the motion that
   * "reduce motion" exists to switch off. The scene still passes through every
   * state, it just arrives at each one immediately.
   */
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (active) {
          setIsReduced(enabled);
        }
      })
      // The setting is a preference, not a requirement. If it cannot be read the
      // animation plays, which is the same outcome as it being switched off.
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsReduced);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const count = characters.length;

  const layout = useMemo(() => {
    // A code cell is a touch-target-sized square, shrunk only when the code is
    // long enough that a row of them would not fit.
    const node = resolveNodeSize(width, count, theme.hitSlop.minTarget);

    return {
      node,
      radius: orbitRadius(count, node),
      side: sceneSide(count, node),
      // The row is tighter than the ring: cells sit one small gap apart, which
      // is what makes them read as a single field rather than scattered boxes.
      // It closes up rather than overflowing when the code is long enough that
      // the gap will not fit — the ring has room the row does not.
      step:
        width > 0 && count > 0
          ? Math.min(node + theme.spacing.sm, width / count)
          : node + theme.spacing.sm,
    };
  }, [width, count, theme]);

  /** 0 while the code is a row, 1 once it has curled onto the ring. */
  const curl = useSharedValue(0);
  /** Radians the ring has turned. */
  const spin = useSharedValue(0);
  /** 0 while the nodes hold the ring, 1 once they have collapsed into the hub. */
  const converge = useSharedValue(0);
  /** Presence of the hub and its ring. */
  const hub = useSharedValue(0);

  useEffect(() => {
    const { duration, easing } = theme.animation;

    const timing = (value: number, ms: number, curve: EasingFunction | EasingFunctionFactory) =>
      withTiming(value, { duration: isReduced ? 0 : ms, easing: curve });

    if (status === 'idle') {
      curl.value = timing(0, duration.slow, easing.standard);
      hub.value = timing(0, duration.normal, easing.standard);
      converge.value = timing(0, duration.normal, easing.standard);
      // Reset without animating. Winding the ring backwards to zero would read
      // as the verification being undone.
      spin.value = 0;
      return;
    }

    /**
     * The last character lands and the row curls onto the ring straight away,
     * before anything has been sent. The curl answers the keystroke; the orbit
     * answers the request. Holding the curl back until the network call would
     * put the one piece of feedback the user earned behind a round trip.
     */
    if (status === 'entered') {
      hub.value = timing(1, duration.normal, easing.decelerate);
      curl.value = timing(1, duration.slow, easing.decelerate);
      converge.value = timing(0, duration.fast, easing.standard);
      spin.value = 0;
      return;
    }

    if (status === 'verifying') {
      hub.value = timing(1, duration.slow, easing.decelerate);
      curl.value = timing(1, duration.slow, easing.decelerate);
      spin.value = timing(ORBIT_SWEEP, duration.verify, easing.orbit);
      converge.value = timing(0, duration.fast, easing.standard);
      return;
    }

    hub.value = timing(1, duration.fast, easing.standard);
    curl.value = timing(1, duration.fast, easing.standard);
    converge.value = timing(1, duration.slow, easing.decelerate);
  }, [status, isReduced, theme, curl, spin, converge, hub]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: hub.value * (1 - converge.value),
    transform: [{ scale: 0.9 + hub.value * 0.1 }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    opacity: hub.value,
    transform: [{ scale: 0.6 + hub.value * 0.4 + converge.value * 0.15 }],
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: converge.value,
    transform: [{ scale: 0.5 + converge.value * 0.5 }],
  }));

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const diameter = layout.radius * 2;

  return (
    <View
      onLayout={handleLayout}
      style={[styles.scene, { height: layout.side }]}
      // The field that owns this code carries its accessible name, value and
      // state. Exposing the drawing as well would announce the code a second
      // time, one character at a time.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.centred,
          ringStyle,
          {
            width: diameter,
            height: diameter,
            borderRadius: theme.radius.full,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: theme.colors.primary,
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.centred,
          coreStyle,
          {
            width: layout.node * 1.6,
            height: layout.node * 1.6,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.primarySubtle,
          },
        ]}
      />

      <Animated.View pointerEvents="none" style={[styles.centred, markStyle]}>
        <Icon name="success" size="lg" color="primary" />
      </Animated.View>

      {characters.map((character, index) => (
        <VerificationNode
          // Position in the code is the identity. The characters are not unique,
          // and a code cannot reorder itself.
          key={index}
          index={index}
          count={count}
          character={character}
          node={layout.node}
          radius={layout.radius}
          step={layout.step}
          isFocused={status === 'idle' && index === focusedIndex}
          hasError={hasError}
          curl={curl}
          spin={spin}
          converge={converge}
        />
      ))}
    </View>
  );
}

interface VerificationNodeProps {
  index: number;
  count: number;
  character: string;
  node: number;
  radius: number;
  step: number;
  isFocused: boolean;
  hasError: boolean;
  curl: SharedValue<number>;
  spin: SharedValue<number>;
  converge: SharedValue<number>;
}

/**
 * One character: a cell while the code is a row, a node once it has curled.
 *
 * Each node owns its animated style because a hook cannot be called in a loop,
 * and because that keeps every position calculation on the UI thread.
 */
const VerificationNode = memo(function VerificationNodeComponent({
  index,
  count,
  character,
  node,
  radius,
  step,
  isFocused,
  hasError,
  curl,
  spin,
  converge,
}: VerificationNodeProps) {
  const theme = useTheme();

  const home = rowOffset(index, count, step);
  const angle = orbitAngle(index, count);

  const style = useAnimatedStyle(() => {
    const turned = angle + spin.value;
    // Collapsing the radius draws the nodes into the hub on success, rather
    // than leaving them to fade out wherever the ring happened to stop.
    const reach = radius * (1 - converge.value);

    const orbitX = Math.cos(turned) * reach;
    const orbitY = Math.sin(turned) * reach;

    const t = curl.value;

    return {
      transform: [
        { translateX: home + (orbitX - home) * t },
        { translateY: orbitY * t },
        { scale: 1 - t * 0.2 - converge.value * 0.3 },
      ],
      opacity: 1 - converge.value,
    };
  });

  const borderColor = hasError
    ? theme.colors.danger
    : isFocused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.centred,
        style,
        {
          width: node,
          height: node,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor,
          backgroundColor: theme.colors.surface,
        },
      ]}>
      <Text variant="bodyStrong" align="center">
        {character}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  scene: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /**
   * Everything is laid on the centre and moved from there, so the origin the
   * geometry describes is the origin the styles use.
   */
  centred: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const VerificationScene = memo(VerificationSceneComponent);
