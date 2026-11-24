import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { ChangePasswordScreen } from '@/features/account/ChangePasswordScreen';
import { HeaderBell } from '@/features/account/HeaderBell';
import { NotificationsScreen } from '@/features/account/NotificationsScreen';
import { useAuth } from '@/features/auth/AuthProvider';
import { CompleteWorkScreen } from '@/features/vendor/screens/CompleteWorkScreen';
import { EditVendorProfileScreen } from '@/features/vendor/screens/EditVendorProfileScreen';
import { PendingApprovalScreen } from '@/features/vendor/screens/PendingApprovalScreen';
import { TeamMemberFormScreen } from '@/features/vendor/screens/TeamMemberFormScreen';
import { TeamScreen } from '@/features/vendor/screens/TeamScreen';
import { VendorDashboardScreen } from '@/features/vendor/screens/VendorDashboardScreen';
import { VendorProfileScreen } from '@/features/vendor/screens/VendorProfileScreen';
import { VendorReportsScreen } from '@/features/vendor/screens/VendorReportsScreen';
import { VendorRequestDetailScreen } from '@/features/vendor/screens/VendorRequestDetailScreen';
import { VendorRequestsScreen } from '@/features/vendor/screens/VendorRequestsScreen';
import { VendorReviewsScreen } from '@/features/vendor/screens/VendorReviewsScreen';
import { Icon, ScreenLoader } from '@/shared/components';
import { useTheme, type IconName } from '@/shared/theme';
import type { VendorProfile } from '@/shared/types/models';

import { stackOptions, tabOptions } from './options';
import type { VendorStackParamList, VendorTabParamList } from './types';

const Tab = createBottomTabNavigator<VendorTabParamList>();
const Stack = createNativeStackNavigator<VendorStackParamList>();

const TAB_ICON: Record<keyof VendorTabParamList, IconName> = {
  Dashboard: 'home',
  VendorRequests: 'requests',
  Team: 'team',
  VendorProfile: 'profile',
};

function VendorTabs() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        ...tabOptions(theme),
        tabBarIcon: ({ focused, size }) => <Icon name={TAB_ICON[route.name]} size={size} color={focused ? 'primary' : 'textTertiary'} />,
        tabBarButtonTestID: `tab-${route.name}`,
        headerRight: () => <HeaderBell onPress={() => navigation.getParent()?.navigate('Notifications')} />,
      })}>
      <Tab.Screen name="Dashboard" component={VendorDashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="VendorRequests" component={VendorRequestsScreen} options={{ title: 'Requests' }} />
      <Tab.Screen name="Team" component={TeamScreen} options={{ title: 'Team' }} />
      <Tab.Screen name="VendorProfile" component={VendorProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

/** Unapproved vendors only ever see the approval screen (§29). */
export function VendorNavigator() {
  const theme = useTheme();
  const { user } = useAuth();
  const vendor = user as VendorProfile | null;

  if (!vendor) return <ScreenLoader />;
  if (vendor.approvalStatus !== 'APPROVED') return <PendingApprovalScreen />;

  return (
    <Stack.Navigator screenOptions={stackOptions(theme)}>
      <Stack.Screen name="VendorTabs" component={VendorTabs} options={{ headerShown: false }} />
      <Stack.Screen name="VendorRequestDetail" component={VendorRequestDetailScreen} options={{ title: 'Request' }} />
      <Stack.Screen name="CompleteWork" component={CompleteWorkScreen} options={{ title: 'Complete work' }} />
      <Stack.Screen name="TeamMemberForm" component={TeamMemberFormScreen} options={{ title: 'Team member' }} />
      <Stack.Screen name="EditVendorProfile" component={EditVendorProfileScreen} options={{ title: 'Edit profile' }} />
      <Stack.Screen name="VendorReviews" component={VendorReviewsScreen} options={{ title: 'Reviews' }} />
      <Stack.Screen name="VendorReports" component={VendorReportsScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change password' }} />
    </Stack.Navigator>
  );
}
