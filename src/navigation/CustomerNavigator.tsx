/**
 * CustomerNavigator
 *
 * The customer application (PROJECT_BIBLE.md section 26).
 *
 * A stack whose first route is the tab bar. Bottom tabs are Home, Requests and
 * Profile; categories, request creation, vendor selection and request details
 * are pushed screens, so they need somewhere to be pushed onto — the roadmap is
 * explicit that navigation stays simple, so they are not tabs and they do not
 * each carry a stack of their own.
 *
 * ⚠️ Pushed screens cover the tab bar rather than sitting beside it. A request
 * is created in a sequence of steps, and a bar offering two ways out of the
 * middle of one is an invitation to abandon it by accident.
 *
 * Categories, sub-categories, request details and vendor selection are real
 * screens. What follows submission is not: PROJECT_BIBLE.md sections 19 and 20 —
 * the confirmation summary and the request's own screen — have no routes here,
 * because a route typed ahead of its screen is a promise the app can navigate to
 * and then fail to render.
 *
 * The draft provider wraps the stack rather than sitting inside one screen.
 * Request creation now spans two of them (section 13), so what the customer has
 * filled in has to outlive the screen that collected it and die with the flow —
 * which is exactly the lifetime of this navigator.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CategoriesScreen } from '@/features/customer/screens/CategoriesScreen';
import { CreateRequestScreen } from '@/features/customer/screens/CreateRequestScreen';
import { CustomerHomeScreen } from '@/features/customer/screens/CustomerHomeScreen';
import { PreferredVendorScreen } from '@/features/customer/screens/PreferredVendorScreen';
import { SubCategoriesScreen } from '@/features/customer/screens/SubCategoriesScreen';
import { RequestDraftProvider } from '@/features/customer/state/RequestDraftContext';
import { renderFloatingTabBar } from '@/navigation/components/FloatingTabBar';
import { createPlaceholder } from '@/navigation/placeholders/PlaceholderScreen';
import { createTabIcon } from '@/navigation/tabIcon';
import { createTabScreenOptions } from '@/navigation/tabScreenOptions';
import type { CustomerStackParamList, CustomerTabParamList } from '@/navigation/types';
import { useTheme } from '@/shared/theme';

const Stack = createNativeStackNavigator<CustomerStackParamList>();
const Tab = createBottomTabNavigator<CustomerTabParamList>();

const RequestsScreen = createPlaceholder('My Requests', 'PROJECT_BIBLE section 23');
const ProfileScreen = createPlaceholder('Profile', 'PROJECT_BIBLE section 25');

function CustomerTabs() {
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
        component={CustomerHomeScreen}
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

export function CustomerNavigator() {
  return (
    <RequestDraftProvider>
      <Stack.Navigator initialRouteName="CustomerTabs" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
        <Stack.Screen name="Categories" component={CategoriesScreen} />
        <Stack.Screen name="SubCategories" component={SubCategoriesScreen} />
        <Stack.Screen name="CreateRequest" component={CreateRequestScreen} />
        <Stack.Screen name="PreferredVendor" component={PreferredVendorScreen} />
      </Stack.Navigator>
    </RequestDraftProvider>
  );
}
