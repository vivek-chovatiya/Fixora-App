import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useLayoutEffect } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { EmptyState, ErrorState, Icon, Loader, ScreenLoader, Text } from '@/shared/components';
import { usePaginatedQuery } from '@/shared/hooks/usePaginatedQuery';
import { strings } from '@/shared/i18n/strings';
import { notificationApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import type { AppNotification } from '@/shared/types/models';
import { formatRelative } from '@/shared/utils/format';

export function NotificationsScreen() {
  const theme = useTheme();
  const { role } = useAuth();
  // Shared across role stacks, so the navigator type is resolved at runtime.
  const navigation = useNavigation<any>();
  const query = usePaginatedQuery(request => notificationApi.list(request), []);

  const markAll = useCallback(async () => {
    await notificationApi.markAllRead().catch(() => undefined);
    query.refresh();
  }, [query]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable testID="notifications-read-all" onPress={markAll} hitSlop={10} accessibilityRole="button">
          <Text variant="label" color="primary">
            Mark all read
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, markAll]);

  const open = async (item: AppNotification) => {
    if (!item.isRead) {
      await notificationApi.markRead(item.id).catch(() => undefined);
    }
    if (item.type === 'SERVICE_REQUEST' && item.referenceId) {
      if (role === 'CUSTOMER') navigation.navigate('RequestDetail', { id: item.referenceId });
      else if (role === 'VENDOR') navigation.navigate('VendorRequestDetail', { id: item.referenceId });
    }
    query.refresh();
  };

  if (query.isLoading) return <ScreenLoader />;
  if (query.error && query.items.length === 0) return <ErrorState error={query.error} onRetry={query.retry} />;

  return (
    <FlatList
      testID="notifications-screen"
      style={{ backgroundColor: theme.colors.background }}
      data={query.items}
      keyExtractor={item => item.id}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={query.isRefreshing} onRefresh={query.refresh} tintColor={theme.colors.primary} />}
      onEndReached={query.loadMore}
      ListFooterComponent={query.isLoadingMore ? <Loader /> : null}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
      ListEmptyComponent={<EmptyState icon="notifications" title={strings.empty.notifications} />}
      renderItem={({ item }) => (
        <Pressable
          testID={`notification-${item.id}`}
          accessibilityRole="button"
          onPress={() => open(item)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            backgroundColor: pressed ? theme.colors.surfaceAlt : item.isRead ? theme.colors.surface : theme.colors.primarySubtle,
          })}>
          <Icon name={item.type === 'REVIEW' ? 'star' : item.type === 'ACCOUNT' ? 'verified' : 'requests'} size="md" color={item.isRead ? 'textTertiary' : 'primary'} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="bodyStrong">{item.title}</Text>
            <Text variant="caption" color="textSecondary">
              {item.message}
            </Text>
            <Text variant="caption" color="textTertiary">
              {formatRelative(item.createdAt)}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}
