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
 * The whole of request creation is real now: categories, sub-categories,
 * details, the service address, vendor selection, the confirmation summary and
 * the confirmation that it went.
 * They are registered in that order because that is the order section 13 asks
 * them in, and a stack whose declaration order matched nothing would be one more
 * thing to hold in your head. After them comes section 20's request details,
 * reached from the success screen, from Home's recent requests and from the
 * Requests tab — section 23's My Requests, which is a tab rather than a pushed
 * screen because section 26 puts it in the bar. Last is section 24's review,
 * pushed from the details of a completed or closed request. Tracking has no
 * route here, because a route typed ahead of its screen is a promise the app can
 * navigate to and then fail to render.
 *
 * The draft provider wraps the stack rather than sitting inside one screen.
 * Request creation spans four of them (section 13), so what the customer has
 * filled in has to outlive the screen that collected it — and, since drafts are
 * persisted, outlive this navigator too. Wrapping here is what makes every step
 * read and write one draft instead of passing answers along a chain. It is told
 * the signed-in customer, so the draft it restores is only ever their own.
 *
 * Profile (section 25) is the third tab: the customer's details, read-only, and
 * Logout.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthSession } from '@/features/auth/hooks/useAuth';
import { CategoriesScreen } from '@/features/customer/screens/CategoriesScreen';
import { ChooseSavedAddressScreen } from '@/features/customer/screens/ChooseSavedAddressScreen';
import { CreateRequestScreen } from '@/features/customer/screens/CreateRequestScreen';
import { CustomerHomeScreen } from '@/features/customer/screens/CustomerHomeScreen';
import { CustomerProfileScreen } from '@/features/customer/screens/CustomerProfileScreen';
import { EditAddressScreen } from '@/features/customer/screens/EditAddressScreen';
import { EditProfileScreen } from '@/features/customer/screens/EditProfileScreen';
import { ManageAddressesScreen } from '@/features/customer/screens/ManageAddressesScreen';
import { MyRequestsScreen } from '@/features/customer/screens/MyRequestsScreen';
import { PreferredVendorScreen } from '@/features/customer/screens/PreferredVendorScreen';
import { ServiceAddressScreen } from '@/features/customer/screens/ServiceAddressScreen';
import { RequestConfirmationScreen } from '@/features/customer/screens/RequestConfirmationScreen';
import { RequestDetailsScreen } from '@/features/customer/screens/RequestDetailsScreen';
import { RequestReviewScreen } from '@/features/customer/screens/RequestReviewScreen';
import { RequestSubmittedScreen } from '@/features/customer/screens/RequestSubmittedScreen';
import { SubCategoriesScreen } from '@/features/customer/screens/SubCategoriesScreen';
import { RequestDraftProvider } from '@/features/customer/state/RequestDraftContext';
import { ChangeLanguageScreen } from '@/features/language/screens/LanguageScreen';
import { NotificationsScreen } from '@/features/notifications/screens/NotificationsScreen';
import { NAVIGATION_COPY } from '@/navigation/navigationCopy';
import { renderFloatingTabBar } from '@/navigation/components/FloatingTabBar';
import { createTabIcon } from '@/navigation/tabIcon';
import { createTabScreenOptions } from '@/navigation/tabScreenOptions';
import type { CustomerStackParamList, CustomerTabParamList } from '@/navigation/types';
import { useTheme } from '@/shared/theme';

const Stack = createNativeStackNavigator<CustomerStackParamList>();
const Tab = createBottomTabNavigator<CustomerTabParamList>();

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
        // The tab's name in the app's language, read in render (`navigationCopy`).
        options={{ title: NAVIGATION_COPY.customerTabs.Home, tabBarIcon: createTabIcon('home') }}
      />
      <Tab.Screen
        name="Requests"
        component={MyRequestsScreen}
        options={{
          title: NAVIGATION_COPY.customerTabs.Requests,
          tabBarIcon: createTabIcon('requests'),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={CustomerProfileScreen}
        options={{
          title: NAVIGATION_COPY.customerTabs.Profile,
          tabBarIcon: createTabIcon('profile'),
        }}
      />
    </Tab.Navigator>
  );
}

export function CustomerNavigator() {
  // Whose draft this is: written as theirs, restored only for them (3D-7).
  const { user } = useAuthSession();

  return (
    <RequestDraftProvider ownerId={user?.id ?? null}>
      <Stack.Navigator initialRouteName="CustomerTabs" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
        <Stack.Screen name="Categories" component={CategoriesScreen} />
        <Stack.Screen name="SubCategories" component={SubCategoriesScreen} />
        <Stack.Screen name="CreateRequest" component={CreateRequestScreen} />
        <Stack.Screen name="ServiceAddress" component={ServiceAddressScreen} />
        {/*
          A detour from the address step, not a step of its own: it copies a
          saved address into the draft and pops back to Service Address.
        */}
        <Stack.Screen name="ChooseSavedAddress" component={ChooseSavedAddressScreen} />
        <Stack.Screen name="PreferredVendor" component={PreferredVendorScreen} />
        <Stack.Screen name="RequestConfirmation" component={RequestConfirmationScreen} />
        {/*
          Reached only by `reset`, never pushed. By the time it renders the four
          screens that collected the request are gone, which is what stops the
          same request being sent twice.
        */}
        <Stack.Screen
          name="RequestSubmitted"
          component={RequestSubmittedScreen}
          // The stack's own gesture would otherwise slide this away to reveal
          // nothing, since it is the only thing above the tabs. Home is a
          // button, deliberately.
          options={{ gestureEnabled: false }}
        />
        {/*
          A record, not a step. It carries only a reference, reads everything
          else from `RequestService`, and goes back to wherever it was opened
          from — Home, or Home in place of the success screen it replaced.
        */}
        <Stack.Screen name="RequestDetails" component={RequestDetailsScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Addresses" component={ManageAddressesScreen} />
        <Stack.Screen name="EditAddress" component={EditAddressScreen} />
        {/*
          Pushed from a request's details and popped back to them. It reads the
          request and its review for itself, so it is never handed either.
        */}
        <Stack.Screen name="RequestReview" component={RequestReviewScreen} />
        {/*
          Pushed from the bell on Home (section 57). The vendor stack registers
          the same screen under the same name; each opens a request in its own
          application, so neither stack reaches into the other.
        */}
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        {/* Pushed from Profile's Language row; the vendor stack registers the same. */}
        <Stack.Screen name="Language" component={ChangeLanguageScreen} />
      </Stack.Navigator>
    </RequestDraftProvider>
  );
}
