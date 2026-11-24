import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { View } from 'react-native';

import type { CustomerStackParamList, CustomerTabParamList } from '@/app/navigation/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { CategoryGrid } from '@/features/catalog/CategoryTile';
import { RequestCard } from '@/features/requests/components';
import { EmptyState, ErrorState, Loader, PrimaryButton, Screen, SectionHeader, Text } from '@/shared/components';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { strings } from '@/shared/i18n/strings';
import { catalogApi, requestApi } from '@/shared/services/api';
import { Analytics } from '@/shared/services/analytics';
import { useTheme } from '@/shared/theme';
import type { Category, CustomerProfile } from '@/shared/types/models';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Home'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

const HOME_CATEGORY_LIMIT = 6;

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export function CustomerHomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const { user } = useAuth();
  const categories = useServiceQuery(() => catalogApi.categories(), []);
  const recent = useServiceQuery(() => requestApi.list('ALL', { page: 1, pageSize: 3 }), []);

  const refresh = useCallback(() => {
    categories.refresh();
    recent.refresh();
  }, [categories, recent]);
  useRefreshOnFocus(recent.refresh);

  const openCategory = (category: Category) => {
    Analytics.track('category_selected', { categoryId: category.id });
    navigation.navigate('SubCategories', { category });
  };

  const firstName = (user as CustomerProfile | null)?.firstName ?? '';
  const list = categories.data ?? [];

  return (
    <Screen testID="customer-home" refreshing={categories.isRefreshing || recent.isRefreshing} onRefresh={refresh}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="caption" color="textSecondary">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </Text>
        <Text variant="h1">What service do you need?</Text>
      </View>

      <PrimaryButton testID="home-request-service" label="Request a Service" icon="add" onPress={() => navigation.navigate('Categories')} />

      <SectionHeader title="Services" actionLabel={list.length > HOME_CATEGORY_LIMIT ? 'View all' : undefined} onAction={() => navigation.navigate('Categories')} />
      {categories.isLoading ? <Loader /> : null}
      {categories.error ? <ErrorState error={categories.error} onRetry={categories.retry} /> : null}
      {!categories.isLoading && !categories.error && list.length === 0 ? (
        <EmptyState title="No services available yet" message="Please check back soon." />
      ) : null}
      <CategoryGrid categories={list.slice(0, HOME_CATEGORY_LIMIT)} onSelect={openCategory} />

      <SectionHeader title="Recent requests" actionLabel={recent.data?.items.length ? 'See all' : undefined} onAction={() => navigation.navigate('Requests')} />
      {recent.isLoading ? <Loader /> : null}
      {recent.error ? <ErrorState error={recent.error} onRetry={recent.retry} /> : null}
      {recent.data && recent.data.items.length === 0 ? (
        <EmptyState icon="requests" title={strings.empty.customerRequests} />
      ) : null}
      {recent.data?.items.map(request => (
        <RequestCard key={request.id} request={request} perspective="customer" onPress={() => navigation.navigate('RequestDetail', { id: request.id })} />
      ))}
    </Screen>
  );
}
