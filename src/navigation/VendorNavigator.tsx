/**
 * VendorNavigator
 *
 * The vendor application (PROJECT_BIBLE.md section 43).
 *
 * Only reachable by an approved vendor — RootNavigator gates on approval status
 * before this navigator is ever mounted.
 *
 * Reports are reached from the dashboard rather than given a tab, keeping the
 * tab bar to the four areas the roadmap lists.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { renderFloatingTabBar } from '@/navigation/components/FloatingTabBar';
import { createPlaceholder } from '@/navigation/placeholders/PlaceholderScreen';
import { createTabIcon } from '@/navigation/tabIcon';
import { createTabScreenOptions } from '@/navigation/tabScreenOptions';
import type { VendorTabParamList } from '@/navigation/types';
import { useTheme } from '@/shared/theme';

const Tab = createBottomTabNavigator<VendorTabParamList>();

const DashboardScreen = createPlaceholder('Dashboard', 'PROJECT_BIBLE section 30');
const RequestsScreen = createPlaceholder('Requests', 'PROJECT_BIBLE section 31');
const TeamScreen = createPlaceholder('Team', 'PROJECT_BIBLE section 39');
const ProfileScreen = createPlaceholder('Profile', 'PROJECT_BIBLE section 38');

export function VendorNavigator() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      // Shared with the customer bar, so the two applications cannot drift apart —
      // the presentation in `screenOptions`, and the bar drawing it.
      tabBar={renderFloatingTabBar}
      screenOptions={createTabScreenOptions(theme)}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: createTabIcon('home') }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{ tabBarIcon: createTabIcon('requests') }}
      />
      <Tab.Screen
        name="Team"
        component={TeamScreen}
        options={{ tabBarIcon: createTabIcon('team') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: createTabIcon('profile') }}
      />
    </Tab.Navigator>
  );
}
