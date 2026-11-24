import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';

import type { CustomerStackParamList } from '@/app/navigation/types';
import { Card, EmptyState, ErrorState, Icon, Row, Screen, ScreenLoader, Text } from '@/shared/components';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { catalogApi } from '@/shared/services/api';
import { Analytics } from '@/shared/services/analytics';
import { useTheme } from '@/shared/theme';
import { formatCurrency } from '@/shared/utils/format';

type Props = NativeStackScreenProps<CustomerStackParamList, 'SubCategories'>;

export function SubCategoriesScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { category } = route.params;
  const query = useServiceQuery(() => catalogApi.subCategories(category.id), [category.id]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: category.name });
  }, [navigation, category.name]);

  if (query.isLoading) return <ScreenLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.retry} />;

  const subs = query.data ?? [];
  return (
    <Screen testID="subcategories-screen" refreshing={query.isRefreshing} onRefresh={query.refresh}>
      {category.description ? (
        <Text variant="body" color="textSecondary">
          {category.description}
        </Text>
      ) : null}
      {subs.length === 0 ? <EmptyState title="No services in this category yet" /> : null}
      {subs.map(sub => (
        <Card
          key={sub.id}
          testID={`subcategory-${sub.name}`}
          accessibilityLabel={sub.name}
          onPress={() => {
            Analytics.track('subcategory_selected', { subCategoryId: sub.id });
            navigation.navigate('CreateRequest', {
              category: { id: category.id, name: category.name, icon: category.icon },
              subCategory: { id: sub.id, name: sub.name, estimatedPrice: sub.estimatedPrice },
            });
          }}>
          <Row justify="space-between" gap="md">
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <Text variant="bodyStrong">{sub.name}</Text>
              {sub.description ? (
                <Text variant="caption" color="textSecondary">
                  {sub.description}
                </Text>
              ) : null}
              <Text variant="caption" color="textTertiary">
                {sub.estimatedPrice ? `Starts at ${formatCurrency(sub.estimatedPrice)}` : 'Price on inspection'}
                {sub.estimatedDuration ? ` · ~${sub.estimatedDuration} min` : ''}
              </Text>
            </View>
            <Icon name="forward" size="md" color="textTertiary" />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
