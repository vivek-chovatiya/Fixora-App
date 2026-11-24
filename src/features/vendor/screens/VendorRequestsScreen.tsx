import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import type { VendorStackParamList, VendorTabParamList } from '@/app/navigation/types';
import { RequestCard } from '@/features/requests/components';
import { ChipGroup, EmptyState, ErrorState, Loader, ScreenLoader } from '@/shared/components';
import { usePaginatedQuery } from '@/shared/hooks/usePaginatedQuery';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { strings } from '@/shared/i18n/strings';
import { requestApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import type { ServiceRequest, VendorRequestView } from '@/shared/types/models';

type Props = CompositeScreenProps<
  BottomTabScreenProps<VendorTabParamList, 'VendorRequests'>,
  NativeStackScreenProps<VendorStackParamList>
>;

const TABS: { value: VendorRequestView; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
];

const EMPTY: Record<VendorRequestView, string> = {
  NEW: strings.empty.vendorNew,
  ACCEPTED: 'No accepted requests waiting to start.',
  IN_PROGRESS: 'No work in progress.',
  COMPLETED: 'No completed requests yet.',
  REJECTED: "You haven't declined any requests.",
};

export function VendorRequestsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const [view, setView] = useState<VendorRequestView>(route.params?.view ?? 'NEW');
  const query = usePaginatedQuery(request => requestApi.list(view, request), [view]);

  // Broadcast leads can vanish at any moment — never act on a stale "New" list (§31.2).
  useRefreshOnFocus(query.refresh);
  useEffect(() => {
    if (route.params?.view) setView(route.params.view);
  }, [route.params?.view]);

  const renderItem = useCallback(
    ({ item }: { item: ServiceRequest }) => (
      <RequestCard request={item} perspective="vendor" onPress={() => navigation.navigate('VendorRequestDetail', { id: item.id })} />
    ),
    [navigation],
  );

  return (
    <View testID="vendor-requests" style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingVertical: theme.spacing.md }}>
        <ChipGroup options={TABS} value={view} onChange={setView} scroll testIDPrefix="vendor-tab" />
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
          ListEmptyComponent={<EmptyState testID="vendor-requests-empty" icon="requests" title={EMPTY[view]} message={view === 'NEW' ? strings.empty.vendorNewHint : undefined} />}
        />
      )}
    </View>
  );
}
