import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { ChangePasswordScreen } from '@/features/account/ChangePasswordScreen';
import { HeaderBell } from '@/features/account/HeaderBell';
import { NotificationsScreen } from '@/features/account/NotificationsScreen';
import { AddressFormScreen } from '@/features/customer/screens/AddressFormScreen';
import { AddressesScreen } from '@/features/customer/screens/AddressesScreen';
import { CategoriesScreen } from '@/features/customer/screens/CategoriesScreen';
import { ConfirmRequestScreen } from '@/features/customer/screens/ConfirmRequestScreen';
import { CreateRequestScreen } from '@/features/customer/screens/CreateRequestScreen';
import { CustomerHomeScreen } from '@/features/customer/screens/CustomerHomeScreen';
import { CustomerProfileScreen } from '@/features/customer/screens/CustomerProfileScreen';
import { CustomerRequestDetailScreen } from '@/features/customer/screens/CustomerRequestDetailScreen';
import { CustomerRequestsScreen } from '@/features/customer/screens/CustomerRequestsScreen';
import { EditProfileScreen } from '@/features/customer/screens/EditProfileScreen';
import { ReviewScreen } from '@/features/customer/screens/ReviewScreen';
import { SelectVendorScreen } from '@/features/customer/screens/SelectVendorScreen';
import { SubCategoriesScreen } from '@/features/customer/screens/SubCategoriesScreen';
import { Icon } from '@/shared/components';
import { useTheme, type IconName } from '@/shared/theme';

import { stackOptions, tabOptions } from './options';
import type { CustomerStackParamList, CustomerTabParamList } from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();
const Stack = createNativeStackNavigator<CustomerStackParamList>();

const TAB_ICON: Record<keyof CustomerTabParamList, IconName> = { Home: 'home', Requests: 'requests', Profile: 'profile' };

function CustomerTabs() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        ...tabOptions(theme),
        tabBarIcon: ({ focused, size }) => <Icon name={TAB_ICON[route.name]} size={size} color={focused ? 'primary' : 'textTertiary'} />,
        tabBarButtonTestID: `tab-${route.name}`,
        headerRight: () => <HeaderBell onPress={() => navigation.getParent()?.navigate('Notifications')} />,
      })}>
      <Tab.Screen name="Home" component={CustomerHomeScreen} options={{ title: 'Fixora', tabBarLabel: 'Home' }} />
      <Tab.Screen name="Requests" component={CustomerRequestsScreen} options={{ title: 'My Requests', tabBarLabel: 'Requests' }} />
      <Tab.Screen name="Profile" component={CustomerProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export function CustomerNavigator() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={stackOptions(theme)}>
      <Stack.Screen name="CustomerTabs" component={CustomerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'All services' }} />
      <Stack.Screen name="SubCategories" component={SubCategoriesScreen} />
      <Stack.Screen name="CreateRequest" component={CreateRequestScreen} options={{ title: 'Request details' }} />
      <Stack.Screen name="SelectVendor" component={SelectVendorScreen} options={{ title: 'Choose a vendor' }} />
      <Stack.Screen name="ConfirmRequest" component={ConfirmRequestScreen} options={{ title: 'Confirm' }} />
      <Stack.Screen name="RequestDetail" component={CustomerRequestDetailScreen} options={{ title: 'Request' }} />
      <Stack.Screen name="Review" component={ReviewScreen} options={{ title: 'Rate your experience' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit profile' }} />
      <Stack.Screen name="Addresses" component={AddressesScreen} options={{ title: 'Addresses' }} />
      <Stack.Screen name="AddressForm" component={AddressFormScreen} options={{ title: 'Address' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change password' }} />
    </Stack.Navigator>
  );
}
