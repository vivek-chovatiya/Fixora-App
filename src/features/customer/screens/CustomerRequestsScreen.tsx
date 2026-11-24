import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import type { CustomerStackParamList, CustomerTabParamList } from '@/app/navigation/types';
import { RequestCard } from '@/features/requests/components';
import { ChipGroup, EmptyState, ErrorState, Loader, ScreenLoader } from '@/shared/components';
import { usePaginatedQuery } from '@/shared/hooks/usePaginatedQuery';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { strings } from '@/shared/i18n/strings';
import { requestApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import type { CustomerRequestView, ServiceRequest } from '@/shared/types/models';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Requests'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

const FILTERS: { value: CustomerRequestView; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function CustomerRequestsScreen({ navigation }: Props) {
  const theme = useTheme();
  const [view, setView] = useState<CustomerRequestView>('ALL');
  const query = usePaginatedQuery(request => requestApi.list(view, request), [view]);
  useRefreshOnFocus(query.refresh);

  const renderItem = useCallback(
    ({ item }: { item: ServiceRequest }) => (
      <RequestCard request={item} perspective="customer" onPress={() => navigation.navigate('RequestDetail', { id: item.id })} />
    ),
    [navigation],
  );

  return (
    <View testID="customer-requests" style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingVertical: theme.spacing.md }}>
        <ChipGroup options={FILTERS} value={view} onChange={setView} scroll testIDPrefix="requests-filter" />
      </View>
      {query.isLoading ? (
        <ScreenLoader />
      ) : query.error && query.items.length === 0 ? (
        <ErrorState error={query.error} onRetry={query.retry} />
      ) : (
        <FlatList
          data={query.items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: theme.screenPadding, paddingTop: 0, gap: theme.spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={query.isRefreshing} onRefresh={query.refresh} tintColor={theme.colors.primary} />}
          onEndReached={query.loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={query.isLoadingMore ? <Loader /> : null}
          ListEmptyComponent={
            <EmptyState
              testID="requests-empty"
              icon="requests"
              title={view === 'ALL' ? strings.empty.customerRequests : 'No requests in this list.'}
              actionLabel="Request a Service"
              onAction={() => navigation.navigate('Categories')}
            />
          }
        />
      )}
    </View>
  );
}
