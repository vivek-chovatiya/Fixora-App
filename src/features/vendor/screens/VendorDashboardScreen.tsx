import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { VendorStackParamList, VendorTabParamList } from '@/app/navigation/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { RequestCard } from '@/features/requests/components';
import { Card, EmptyState, ErrorState, RatingStars, Row, Screen, ScreenLoader, SecondaryButton, SectionHeader, StatTile, Text, Toggle, useToast } from '@/shared/components';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { vendorApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
import type { VendorProfile } from '@/shared/types/models';
import { plural } from '@/shared/utils/format';

type Props = CompositeScreenProps<
  BottomTabScreenProps<VendorTabParamList, 'Dashboard'>,
  NativeStackScreenProps<VendorStackParamList>
>;

export function VendorDashboardScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const vendor = user as VendorProfile | null;
  const query = useServiceQuery(() => vendorApi.dashboard(), []);
  useRefreshOnFocus(query.refresh);
  const [toggling, setToggling] = useState(false);

  if (query.isLoading) return <ScreenLoader />;
  if (query.error || !query.data) return <ErrorState error={query.error!} onRetry={query.retry} />;
  const d = query.data;

  const onToggleAvailability = async (next: boolean) => {
    setToggling(true);
    try {
      setUser(await vendorApi.update({ availability: next }));
      toast.show(next ? 'You are available for new requests.' : 'You will not receive new requests.', 'info');
      query.refresh();
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    } finally {
      setToggling(false);
    }
  };

  const openList = (view: 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED') => navigation.navigate('VendorRequests', { view });

  return (
    <Screen testID="vendor-dashboard" refreshing={query.isRefreshing} onRefresh={query.refresh}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="caption" color="textSecondary">
          Welcome back
        </Text>
        <Text variant="h1">{vendor?.businessName}</Text>
        <Row gap="xs">
          <RatingStars value={d.averageRating} size={14} />
          <Text variant="caption" color="textSecondary">
            {d.averageRating.toFixed(1)} · {plural(d.totalReviews, 'review')}
          </Text>
        </Row>
      </View>

      <Card>
        <Row justify="space-between">
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="bodyStrong">{d.availability ? 'Available' : 'Unavailable'}</Text>
            <Text variant="caption" color="textSecondary">
              {d.availability ? 'You are receiving new requests.' : 'Turn on to receive new requests.'}
            </Text>
          </View>
          <Toggle
            testID="availability-switch"
            accessibilityLabel="Available for new requests"
            value={d.availability}
            disabled={toggling}
            onValueChange={onToggleAvailability}
            tone="success"
          />
        </Row>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
        <StatTile testID="stat-pending" label="New requests" value={d.pendingRequests} icon="notifications" attention={d.pendingRequests > 0} onPress={() => openList('NEW')} />
        <StatTile testID="stat-today" label="Today's requests" value={d.todayRequests} icon="calendar" onPress={() => openList('NEW')} />
        <StatTile testID="stat-accepted" label="Accepted" value={d.acceptedRequests} icon="success" onPress={() => openList('ACCEPTED')} />
        <StatTile testID="stat-in-progress" label="In progress" value={d.inProgressRequests} icon="pending" onPress={() => openList('IN_PROGRESS')} />
        <StatTile testID="stat-completed" label="Completed" value={d.completedRequests} icon="verified" onPress={() => openList('COMPLETED')} />
        <StatTile label="Rating" value={d.averageRating.toFixed(1)} icon="star" onPress={() => navigation.navigate('VendorReviews')} />
      </View>

      <SecondaryButton testID="dashboard-reports" label="View reports" icon="reports" onPress={() => navigation.navigate('VendorReports')} />

      <SectionHeader title="Active work" actionLabel="View requests" onAction={() => openList('ACCEPTED')} />
      {d.activeJobs.length === 0 ? <EmptyState icon="requests" title="No active work right now." message="Accepted and in-progress jobs appear here." /> : null}
      {d.activeJobs.map(job => (
        <RequestCard key={job.id} request={job} perspective="vendor" onPress={() => navigation.navigate('VendorRequestDetail', { id: job.id })} />
      ))}
    </Screen>
  );
}
