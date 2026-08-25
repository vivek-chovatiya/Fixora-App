/**
 * FloatingTabBar
 *
 * The bottom bar both applications wear: a capsule sitting clear of the page
 * edges, with the selected destination raised out of it into a button that
 * travels rather than reappears.
 *
 * It replaces React Navigation's bar presentation and nothing else. The
 * navigators still declare the destinations, the router still owns which one is
 * current, and `tabPress` is still emitted and still preventable — so a screen
 * that wants to intercept a tab, or scroll to top on a second tap, keeps
 * working. Navigation state and animation state never meet: this component
 * reads `state.index` and animates towards it, and nothing it does can change
 * it.
 *
 * ⚠️ The tap navigates first. `navigation.navigate` is called from the press
 * handler, before any animation is started, so the destination is already
 * changing while the button is still crossing the bar. The motion trails the
 * navigation; it never gates it.
 *
 * Positions are measured, not assumed. Each item reports its own centre as it
 * lays out, which is what makes the button land correctly on a small phone, on
 * a tablet, after a rotation, and on a bar with three destinations as readily as
 * one with four.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { ActiveTabIndicator } from '@/navigation/components/ActiveTabIndicator';
import { TabBarItem } from '@/navigation/components/TabBarItem';
import { tabBarGeometry } from '@/navigation/components/tabBarGeometry';
import { ActiveTabIcon, tabIconNameOf } from '@/navigation/tabIcon';
import { useTheme } from '@/shared/theme';

/** Below this, a re-measurement is the same measurement. */
const MEASUREMENT_EPSILON = 0.5;

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const isReduced = useReducedMotion();
  const { diameter, lift } = tabBarGeometry(theme);

  /**
   * Where each destination's centre is, in the bar's own coordinates.
   *
   * A ref rather than state: this is written during layout and read when the
   * selection changes, and re-rendering the bar for a number that only the
   * animation consumes would be work done for nobody. `layoutVersion` exists to
   * wake the effects when the numbers actually change.
   */
  const centres = useRef<number[]>([]);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const translateX = useSharedValue(0);
  const pressedIndex = useSharedValue(-1);

  /** False until the button has a real position; the first placement is a jump. */
  const isPlaced = useRef(false);

  const handleMeasure = useCallback((index: number, centre: number) => {
    if (Math.abs((centres.current[index] ?? Number.NaN) - centre) < MEASUREMENT_EPSILON) {
      return;
    }

    centres.current[index] = centre;
    setLayoutVersion(version => version + 1);
  }, []);

  const offsetFor = useCallback(
    (index: number) => {
      const centre = centres.current[index];
      return centre === undefined ? undefined : centre - diameter / 2;
    },
    [diameter],
  );

  /*
    A change of destination is the one thing the button travels for.

    Deliberately not keyed on the measurements as well: a rotation moves every
    centre at once, and a button sliding to catch up with a layout that has
    already jumped reads as a fault rather than as motion.
  */
  useEffect(() => {
    const offset = offsetFor(state.index);

    if (offset === undefined) {
      return;
    }

    if (!isPlaced.current) {
      translateX.value = offset;
      isPlaced.current = true;
      return;
    }

    translateX.value = isReduced
      ? offset
      : withSpring(offset, theme.animation.spring.travel);
  }, [state.index, offsetFor, isReduced, translateX, theme]);

  /* A new layout places the button. It does not send it anywhere. */
  useEffect(() => {
    const offset = offsetFor(state.index);

    if (offset === undefined) {
      return;
    }

    translateX.value = offset;
    isPlaced.current = true;
    // `layoutVersion` is the signal; the index is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutVersion, offsetFor, translateX]);

  /**
   * Draws a destination's selected-state icon.
   *
   * The indicator asks for this by route key rather than being handed an
   * element, so the icon it is fading out is re-rendered from the same source as
   * the one it is fading in and cannot fall behind a theme change.
   *
   * A destination's own `tabBarIcon` would draw the accent glyph — correct on
   * the bar, invisible on a button filled with the accent. So the tab is
   * recovered from the renderer and redrawn by the icon module, which owns both
   * colour policies. A destination whose icon came from somewhere else still
   * gets drawn; it just gets drawn the ordinary way.
   */
  const renderIcon = useCallback(
    (routeKey: string) => {
      const icon = descriptors[routeKey]?.options.tabBarIcon;
      const tab = tabIconNameOf(icon);

      if (tab !== undefined) {
        return <ActiveTabIcon tab={tab} />;
      }

      return (
        icon?.({
          focused: true,
          color: theme.colors.textInverse,
          size: theme.iconSize.lg,
        }) ?? null
      );
    },
    [descriptors, theme],
  );

  const activeRoute = state.routes[state.index];

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.background,
          paddingHorizontal: theme.screenPadding,
          // Room for the part of the button that clears the bar. Reserved rather
          // than overflowed: a child drawn outside its parent is clipped on
          // Android, and the button would lose its top third.
          paddingTop: lift,
          /*
            Clear of the home indicator and the gesture area beneath it.

            The inset comes from React Navigation rather than from the safe-area
            hook, because the navigator has already resolved it for whichever
            edges this bar is responsible for.
          */
          paddingBottom: insets.bottom + theme.spacing.md,
        },
      ]}>
      <View style={[styles.frame, { maxWidth: theme.maxContentWidth }]}>
        <View
          // No horizontal padding, on purpose: it makes an item's own x the
          // same number as the button's offset, so the two cannot drift apart
          // through an arithmetic mistake. The items carry the inset instead,
          // as touch area rather than as dead space.
          style={[
            styles.bar,
            theme.shadows.lg,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.full,
              borderWidth: theme.borderWidth.thin,
              // The seam the flat bar used to draw across the page, kept
              // because dark mode has no shadow to separate the two surfaces.
              borderColor: theme.colors.border,
            },
          ]}
          accessibilityRole="tablist">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const label =
              typeof options.tabBarLabel === 'function'
                ? options.tabBarLabel({
                    focused: isFocused,
                    color: isFocused ? theme.colors.primary : theme.colors.textTertiary,
                    position: 'below-icon',
                    children: options.title ?? route.name,
                  })
                : null;

            const icon =
              options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? theme.colors.primary : theme.colors.textTertiary,
                size: theme.iconSize.lg,
              }) ?? null;

            const handlePress = () => {
              /*
                The documented contract, kept intact.

                A screen may prevent the default — that is how "tap the current
                tab to scroll to top" is built — so the emit has to happen and
                its result has to be honoured, whatever the bar looks like.
              */
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const handleLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <TabBarItem
                key={route.key}
                index={index}
                isFocused={isFocused}
                icon={icon}
                label={label}
                /*
                  Stated rather than inferred. Left to collect its own name from
                  its children, a tab announces the icon's glyph codepoint before
                  its label — so the name is given here, from the same string the
                  label is drawn from.
                */
                accessibilityLabel={
                  options.tabBarAccessibilityLabel ?? options.title ?? route.name
                }
                onPress={handlePress}
                onLongPress={handleLongPress}
                onMeasure={handleMeasure}
                pressedIndex={pressedIndex}
                testID={options.tabBarButtonTestID}
              />
            );
          })}
        </View>

        <ActiveTabIndicator
          translateX={translateX}
          pressedIndex={pressedIndex}
          activeIndex={state.index}
          activeKey={activeRoute.key}
          renderIcon={renderIcon}
          testID="tab-bar-indicator"
        />
      </View>
    </View>
  );
}

/**
 * The bar, ready to hand to a navigator's `tabBar` prop.
 *
 * Defined once at module scope rather than inline in each navigator: an arrow
 * function in JSX is a new component type on every render, and React Navigation
 * would tear the bar down and rebuild it — losing the measured positions, and
 * with them the button's place — every time a screen re-rendered.
 */
export function renderFloatingTabBar(props: BottomTabBarProps) {
  return <FloatingTabBar {...props} />;
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  frame: {
    // The button is positioned against this box, and this box has no background
    // and no radius — so nothing here can clip it.
    width: '100%',
    alignSelf: 'center',
  },
  bar: {
    flexDirection: 'row',
    // Default stretch, so every item is the bar's full height and there is no
    // strip along the top or bottom that looks pressable and is not.
  },
});
