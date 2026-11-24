import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React from 'react';
import { View } from 'react-native';

import type { AdminTabParamList } from '@/app/navigation/types';
import { useConfirmedSignOut } from '@/features/auth/useConfirmedSignOut';
import { ErrorState, GhostButton, Screen, ScreenLoader, StatTile, Text } from '@/shared/components';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { adminApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { ADMIN_CONTENT_MAX_WIDTH } from '@/features/admin/constants';
import { formatDate } from '@/shared/utils/format';

export function AdminDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<AdminTabParamList>>();
  const signOut = useConfirmedSignOut();
  const { breakpoint } = useResponsive();
  const wide = breakpoint === 'lg' || breakpoint === 'xl';
  const basis = wide ? '22%' : '45%';
  const query = useServiceQuery(() => adminApi.dashboard(), []);
  useRefreshOnFocus(query.refresh);

  if (query.isLoading) return <ScreenLoader />;
  if (query.error || !query.data) return <ErrorState error={query.error!} onRetry={query.retry} />;
  const d = query.data;
  const grid = { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md } as const;

  return (
    <Screen
      testID="admin-dashboard"
      refreshing={query.isRefreshing}
      onRefresh={query.refresh}
      contentStyle={{ width: '100%', maxWidth: ADMIN_CONTENT_MAX_WIDTH, alignSelf: 'center', gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="h1">Platform overview</Text>
        <Text variant="body" color="textSecondary">
          {formatDate(new Date())}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="overline" color="textTertiary">
          Needs attention
        </Text>
        <View style={grid}>
          <StatTile
            testID="admin-pending-vendors"
            label="Providers awaiting approval"
            value={d.pendingVendors}
            icon="pending"
            attention={d.pendingVendors > 0}
            basis={wide ? '45%' : basis}
            onPress={() => navigation.navigate('AdminVendors', { status: 'PENDING' })}
          />
          <StatTile label="Requests waiting for a provider" value={d.openRequests} icon="search" attention={d.openRequests > 0} basis={wide ? '45%' : basis} />
        </View>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="overline" color="textTertiary">
          Activity
        </Text>
        <View style={grid}>
          <StatTile label="Requests today" value={d.todayRequests} icon="calendar" basis={basis} />
          <StatTile label="Active jobs" value={d.activeRequests} icon="requests" basis={basis} />
          <StatTile label="Completed" value={d.completedRequests} icon="success" basis={basis} />
          <StatTile label="Total requests" value={d.totalRequests} icon="reports" basis={basis} />
        </View>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="overline" color="textTertiary">
          Network
        </Text>
        <View style={grid}>
          <StatTile
            testID="admin-approved-vendors"
            label="Approved providers"
            value={d.approvedVendors}
            icon="verified"
            basis={wide ? '45%' : basis}
            onPress={() => navigation.navigate('AdminVendors', { status: 'APPROVED' })}
          />
          <StatTile label="Customers" value={d.totalCustomers} icon="profile" basis={wide ? '45%' : basis} />
        </View>
      </View>

      {!wide ? <GhostButton testID="admin-logout" label="Log out" icon="logout" onPress={signOut} /> : null}
    </Screen>
  );
}
