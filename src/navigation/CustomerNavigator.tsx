/**
 * CustomerNavigator
 *
 * The customer application (PROJECT_BIBLE.md section 26).
 *
 * Bottom tabs are Home, Requests and Profile. Categories, request creation,
 * vendor selection and request details are pushed screens that arrive with their
 * stacks in Stage 3 — the roadmap is explicit that navigation stays simple, so
 * they are not tabs.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { renderFloatingTabBar } from '@/navigation/components/FloatingTabBar';
import { createPlaceholder } from '@/navigation/placeholders/PlaceholderScreen';
import { createTabIcon } from '@/navigation/tabIcon';
import { createTabScreenOptions } from '@/navigation/tabScreenOptions';
import type { CustomerTabParamList } from '@/navigation/types';
import { useTheme } from '@/shared/theme';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

const HomeScreen = createPlaceholder('Home', 'PROJECT_BIBLE section 10');
const RequestsScreen = createPlaceholder('My Requests', 'PROJECT_BIBLE section 23');
const ProfileScreen = createPlaceholder('Profile', 'PROJECT_BIBLE section 25');

export function CustomerNavigator() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      // Shared with the vendor bar, so the two applications cannot drift apart —
      // the presentation in `screenOptions`, and the bar drawing it.
      tabBar={renderFloatingTabBar}
      screenOptions={createTabScreenOptions(theme)}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: createTabIcon('home') }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{ tabBarIcon: createTabIcon('requests') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: createTabIcon('profile') }}
      />
    </Tab.Navigator>
  );
}
