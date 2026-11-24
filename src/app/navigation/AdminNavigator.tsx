import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderBell } from '@/features/account/HeaderBell';
import { NotificationsScreen } from '@/features/account/NotificationsScreen';
import { AdminCategoriesScreen } from '@/features/admin/screens/AdminCategoriesScreen';
import { AdminDashboardScreen } from '@/features/admin/screens/AdminDashboardScreen';
import { AdminSubCategoriesScreen } from '@/features/admin/screens/AdminSubCategoriesScreen';
import { AdminVendorsScreen } from '@/features/admin/screens/AdminVendorsScreen';
import { useConfirmedSignOut } from '@/features/auth/useConfirmedSignOut';
import { Icon, Text } from '@/shared/components';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useTheme, type IconName } from '@/shared/theme';

import { stackOptions, tabOptions } from './options';
import type { AdminStackParamList, AdminTabParamList } from './types';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();
const TAB_ICON: Record<keyof AdminTabParamList, IconName> = { AdminDashboard: 'reports', AdminVendors: 'verified', AdminCategories: 'categories' };
const SIDEBAR_WIDTH = 248;

/** Desktop / tablet navigation: a fixed sidebar replaces the bottom tab bar. */
function AdminSidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const signOut = useConfirmedSignOut();
  return (
    <View
      style={{
        width: SIDEBAR_WIDTH,
        paddingTop: insets.top + theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.lg,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border,
        gap: theme.spacing.xs,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
        <View style={{ width: 32, height: 32, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="fallback" size="sm" color="onPrimary" />
        </View>
        <View>
          <Text variant="bodyStrong">Fixora</Text>
          <Text variant="caption" color="textTertiary">
            Admin console
          </Text>
        </View>
      </View>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key].options;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              minHeight: 40,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: focused ? theme.colors.primarySubtle : pressed ? theme.colors.surfaceAlt : 'transparent',
            })}>
            <Icon name={TAB_ICON[route.name as keyof AdminTabParamList]} size="md" color={focused ? 'primary' : 'textSecondary'} />
            <Text variant="label" color={focused ? 'primary' : 'textSecondary'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      <Pressable
        testID="sidebar-logout"
        accessibilityRole="button"
        onPress={signOut}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: 40,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
        })}>
        <Icon name="logout" size="md" color="textSecondary" />
        <Text variant="label" color="textSecondary">
          Log out
        </Text>
      </Pressable>
    </View>
  );
}

function AdminTabs() {
  const theme = useTheme();
  const { breakpoint } = useResponsive();
  const wide = breakpoint === 'lg' || breakpoint === 'xl';
  return (
    <Tab.Navigator
      tabBar={wide ? props => <AdminSidebar {...props} /> : undefined}
      screenOptions={({ route, navigation }) => ({
        ...tabOptions(theme),
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarIcon: ({ focused, size }) => <Icon name={TAB_ICON[route.name]} size={size} color={focused ? 'primary' : 'textTertiary'} />,
        tabBarButtonTestID: `tab-${route.name}`,
        headerRight: () => <HeaderBell onPress={() => navigation.getParent()?.navigate('Notifications')} />,
      })}>
      <Tab.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Overview', tabBarLabel: 'Overview' }} />
      <Tab.Screen name="AdminVendors" component={AdminVendorsScreen} options={{ title: 'Service providers', tabBarLabel: 'Providers' }} />
      <Tab.Screen name="AdminCategories" component={AdminCategoriesScreen} options={{ title: 'Services catalog', tabBarLabel: 'Services' }} />
    </Tab.Navigator>
  );
}

export function AdminNavigator() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={stackOptions(theme)}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} options={{ headerShown: false }} />
      <Stack.Screen name="AdminSubCategories" component={AdminSubCategoriesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}
