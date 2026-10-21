/**
 * VendorNavigator
 *
 * The vendor application (PROJECT_BIBLE.md section 43).
 *
 * Reachable by any vendor holding a session — activation happens during
 * onboarding (section 7A.2), so RootNavigator has no approval gate to apply.
 *
 * ⚠️ Setup comes first, as state rather than as navigation (Phase 3E-1). The
 * profile is loaded before anything is drawn; until the service says setup is
 * complete the stack holds the setup form and nothing else, and saving it
 * swaps in the tabs. It is RootNavigator's rule one level down: screens change
 * state, the tree follows, and there is no route around setup to deep-link to.
 *
 * The profile provider is keyed by the vendor's id, so a different vendor never
 * inherits the last one's answer — and signing out unmounts all of this anyway.
 * The work-sync signal sits inside it for the same reason (Phase 3E-4): a
 * request answered on one screen tells the others to read again, and that
 * conversation is one vendor's.
 *
 * Reports (section 42) are reached from Profile rather than given a tab,
 * keeping the tab bar to the four areas section 43 lists; the dashboard stays
 * as it is. `VendorReports` is one pushed screen with no params.
 *
 * The Team tab is the team (section 39, Phase 3E-7) — it replaced the tab's
 * placeholder — and Profile's "Manage team" switches to it rather than pushing
 * a second copy (owner decision, 2026-10-08). Adding and editing a member is
 * one pushed form, `EditTeamMember`.
 *
 * Shop images (section 38) are one pushed screen, `ShopImages`, reached from
 * Profile's "Manage shop images", with no params.
 *
 * Working hours (section 38) are one pushed screen too, `WorkingHours`, reached
 * from Profile's "Edit working hours", with no params; availability itself is
 * a switch on Profile and adds no route.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthSession } from '@/features/auth/hooks/useAuth';
import { NotificationsScreen } from '@/features/notifications/screens/NotificationsScreen';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { CompleteWorkScreen } from '@/features/vendor/screens/CompleteWorkScreen';
import { RecordPaymentScreen } from '@/features/vendor/screens/RecordPaymentScreen';
import { ShopImagesScreen } from '@/features/vendor/screens/ShopImagesScreen';
import { WorkingHoursScreen } from '@/features/vendor/screens/WorkingHoursScreen';
import { VendorDashboardScreen } from '@/features/vendor/screens/VendorDashboardScreen';
import { VendorProfileFormScreen } from '@/features/vendor/screens/VendorProfileFormScreen';
import { VendorProfileScreen } from '@/features/vendor/screens/VendorProfileScreen';
import { VendorRequestDetailsScreen } from '@/features/vendor/screens/VendorRequestDetailsScreen';
import { VendorRequestsScreen } from '@/features/vendor/screens/VendorRequestsScreen';
import { VendorReviewsScreen } from '@/features/vendor/screens/VendorReviewsScreen';
import { VendorReportsScreen } from '@/features/vendor/screens/VendorReportsScreen';
import { TeamMemberFormScreen } from '@/features/vendor/screens/TeamMemberFormScreen';
import { VendorTeamScreen } from '@/features/vendor/screens/VendorTeamScreen';
import {
  VendorProfileProvider,
  useVendorProfile,
} from '@/features/vendor/state/VendorProfileContext';
import { VendorWorkSyncProvider } from '@/features/vendor/state/VendorWorkSync';
import { renderFloatingTabBar } from '@/navigation/components/FloatingTabBar';
import { createTabIcon } from '@/navigation/tabIcon';
import { createTabScreenOptions } from '@/navigation/tabScreenOptions';
import type { VendorStackParamList, VendorTabParamList } from '@/navigation/types';
import { ErrorState, Loader, Screen } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const Stack = createNativeStackNavigator<VendorStackParamList>();
const Tab = createBottomTabNavigator<VendorTabParamList>();

const COPY = VENDOR_COPY.gate;

function VendorTabs() {
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
        component={VendorDashboardScreen}
        options={{ tabBarIcon: createTabIcon('home') }}
      />
      <Tab.Screen
        name="Requests"
        component={VendorRequestsScreen}
        options={{ tabBarIcon: createTabIcon('requests') }}
      />
      <Tab.Screen
        name="Team"
        component={VendorTeamScreen}
        options={{ tabBarIcon: createTabIcon('team') }}
      />
      <Tab.Screen
        name="Profile"
        component={VendorProfileScreen}
        options={{ tabBarIcon: createTabIcon('profile') }}
      />
    </Tab.Navigator>
  );
}

/** Setup, or the application — decided by the profile, drawn once it is known. */
function VendorStack() {
  const { profile, isLoading, error, retry } = useVendorProfile();

  if (!profile) {
    if (error && !isLoading) {
      return (
        <Screen testID="vendor-gate-error">
          <ErrorState error={error} title={COPY.failedTitle} onRetry={retry} />
        </Screen>
      );
    }
    return (
      <Screen testID="vendor-gate-loading">
        <Loader fullScreen label={COPY.loading} />
      </Screen>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {profile.isSetupComplete ? (
        <>
          <Stack.Screen name="VendorTabs" component={VendorTabs} />
          <Stack.Screen name="EditVendorProfile" component={VendorProfileFormScreen} />
          {/* A record: it carries a reference and reads the rest itself. */}
          <Stack.Screen name="VendorRequestDetails" component={VendorRequestDetailsScreen} />
          {/* Pushed from the Dashboard's bell (section 57); the customer stack has its own. */}
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          {/* Pushed from "Mark completed"; a reference only — the service checks the rest. */}
          <Stack.Screen name="CompleteWork" component={CompleteWorkScreen} />
          {/* Pushed from "Record payment" on finished work; a reference only, as above. */}
          <Stack.Screen name="RecordPayment" component={RecordPaymentScreen} />
          {/* Pushed from Profile; whose reviews they are is the session's, not the route's. */}
          <Stack.Screen name="VendorReviews" component={VendorReviewsScreen} />
          {/* Pushed from Profile; the period is chosen on the screen, the vendor by the session. */}
          <Stack.Screen name="VendorReports" component={VendorReportsScreen} />
          {/* Add (no id) or edit (an id); the member is read from the service, never the route. */}
          <Stack.Screen name="EditTeamMember" component={TeamMemberFormScreen} />
          {/* Pushed from Profile; whose photos they are is the session's, not the route's. */}
          <Stack.Screen name="ShopImages" component={ShopImagesScreen} />
          {/* Pushed from Profile; whose week it is is the session's, not the route's. */}
          <Stack.Screen name="WorkingHours" component={WorkingHoursScreen} />
        </>
      ) : (
        <Stack.Screen
          name="VendorProfileSetup"
          component={VendorProfileFormScreen}
          // Nothing beneath it to reveal.
          options={{ gestureEnabled: false }}
        />
      )}
    </Stack.Navigator>
  );
}

export function VendorNavigator() {
  const { user } = useAuthSession();

  return (
    <VendorProfileProvider key={user?.id ?? 'none'}>
      <VendorWorkSyncProvider>
        <VendorStack />
      </VendorWorkSyncProvider>
    </VendorProfileProvider>
  );
}
