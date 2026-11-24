import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { Avatar, Card, EmptyState, ErrorState, ImageGallery, Loader, RatingStars, Row, ScreenLoader, Text } from '@/shared/components';
import { usePaginatedQuery } from '@/shared/hooks/usePaginatedQuery';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { strings } from '@/shared/i18n/strings';
import { reviewApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { formatDate, plural } from '@/shared/utils/format';

/** Vendor's own reviews — read only (§41). */
export function VendorReviewsScreen() {
  const theme = useTheme();
  const summary = useServiceQuery(() => reviewApi.summary(), []);
  const list = usePaginatedQuery(request => reviewApi.vendorReviews(undefined, request), []);

  if (summary.isLoading || list.isLoading) return <ScreenLoader />;
  if (summary.error) return <ErrorState error={summary.error} onRetry={summary.retry} />;
  if (list.error && !list.items.length) return <ErrorState error={list.error} onRetry={list.retry} />;
  const s = summary.data!;

  const header = (
    <Card testID="review-summary">
      <Row gap="lg" style={{ alignItems: 'flex-start' }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <Text variant="display">{s.averageRating.toFixed(1)}</Text>
          <RatingStars value={s.averageRating} size={14} />
          <Text variant="caption" color="textSecondary">
            {plural(s.totalReviews, 'review')}
          </Text>
        </View>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          {s.breakdown.map(b => (
            <Row key={b.stars} gap="sm">
              <Text variant="caption" style={{ width: 24 }}>
                {b.stars}★
              </Text>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' }}>
                <View style={{ width: `${b.percentage}%`, height: 8, backgroundColor: theme.colors.warning }} />
              </View>
              <Text variant="caption" color="textSecondary" style={{ width: 36, textAlign: 'right' }}>
                {b.percentage}%
              </Text>
            </Row>
          ))}
        </View>
      </Row>
    </Card>
  );

  return (
    <FlatList
      testID="vendor-reviews-screen"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.screenPadding, gap: theme.spacing.md, flexGrow: 1 }}
      data={list.items}
      keyExtractor={item => item.id}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl
          refreshing={list.isRefreshing}
          onRefresh={() => {
            summary.refresh();
            list.refresh();
          }}
        />
      }
      onEndReached={list.loadMore}
      ListFooterComponent={list.isLoadingMore ? <Loader /> : null}
      ListEmptyComponent={<EmptyState icon="star" title={strings.empty.reviews} />}
      renderItem={({ item }) => (
        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <Row gap="md">
              <Avatar name={item.customer?.name} uri={item.customer?.profileImage} size={36} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{item.customer?.name ?? 'Customer'}</Text>
                <Text variant="caption" color="textTertiary">
                  {formatDate(item.createdAt)}
                </Text>
              </View>
              <RatingStars value={item.rating} size={14} />
            </Row>
            {item.comment ? <Text variant="body">{item.comment}</Text> : null}
            <ImageGallery images={item.images} size={64} />
          </View>
        </Card>
      )}
    />
  );
}
