/**
 * Tab bar presentation
 *
 * One tab bar, described once, worn by both role navigators.
 *
 * Customer and Vendor had identical `screenOptions` blocks copied between them.
 * That is the duplication CLAUDE.md section 8 forbids, and it is the reason a
 * tab bar can drift: a change made to fix the customer bar leaves the vendor bar
 * behind, and the two applications stop looking like one product.
 *
 * Presentation only. It names no route, decides no tab order and holds no
 * screen — the navigators still own all of that.
 *
 * What it no longer describes is the bar's surface. FloatingTabBar draws that,
 * and a `tabBarStyle` here would be a second description of it that React
 * Navigation silently ignores — the worst kind, because it reads as the truth.
 * What stays is what the bar asks this file for: the label, and the two tint
 * colours it is given when it asks.
 */

import React from 'react';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';

import { Text } from '@/shared/components/Text';
import type { AppTheme } from '@/shared/theme';

interface TabLabelProps {
  focused: boolean;
  children: string;
}

/**
 * The tab's name, weighted by selection.
 *
 * A third signal on top of the filled glyph and the colour, and the cheapest of
 * the three: `label` and `caption` are the same size and differ only in weight,
 * so the bar does not reflow as the user moves between tabs.
 *
 * Rendered through the shared Text primitive rather than React Navigation's
 * `tabBarLabelStyle` so the colour stays a token. The raw colour string the
 * navigator would otherwise hand down is the one place a tab bar can escape the
 * theme, and dark mode is automatic only for what does not.
 */
function TabLabel({ focused, children }: TabLabelProps) {
  return (
    <Text
      variant={focused ? 'label' : 'caption'}
      color={focused ? 'primary' : 'textTertiary'}
      numberOfLines={1}>
      {children}
    </Text>
  );
}

/**
 * Builds the shared options for a bottom tab navigator.
 *
 * Returned as a function of the route because the label needs the route's name;
 * everything else is constant for the whole bar.
 *
 * Deliberately absent: any explicit height. The bar sizes itself from its
 * content and the bottom safe-area inset, and a fixed height is what puts a tab
 * label under a gesture bar on one device and leaves a band of empty surface on
 * another.
 */
export function createTabScreenOptions(theme: AppTheme) {
  return function tabScreenOptions({
    route,
  }: {
    route: RouteProp<Record<string, object | undefined>, string>;
  }): BottomTabNavigationOptions {
    return {
      headerShown: false,

      // Still set, and still doing work. The glyph carries selection on its own
      // now, so these reinforce it rather than being the only thing saying it —
      // and they are the colours the bar passes back into `tabBarIcon` and
      // `tabBarLabel` when it asks each destination to draw itself.
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.textTertiary,

      tabBarLabel: ({ focused }) => <TabLabel focused={focused}>{route.name}</TabLabel>,
    };
  };
}
