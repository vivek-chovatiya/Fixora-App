import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';

import type { CustomerStackParamList } from '@/app/navigation/types';
import { CategoryGrid } from '@/features/catalog/CategoryTile';
import { EmptyState, ErrorState, Screen, ScreenLoader, Text } from '@/shared/components';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { catalogApi } from '@/shared/services/api';
import { Analytics } from '@/shared/services/analytics';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Categories'>;

export function CategoriesScreen({ navigation }: Props) {
  const query = useServiceQuery(() => catalogApi.categories(), []);

  if (query.isLoading) return <ScreenLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.retry} />;

  const categories = query.data ?? [];
  return (
    <Screen testID="categories-screen" refreshing={query.isRefreshing} onRefresh={query.refresh}>
      <Text variant="body" color="textSecondary">
        Choose a service category.
      </Text>
      {categories.length === 0 ? <EmptyState title="No services available yet" /> : null}
      <CategoryGrid
        categories={categories}
        onSelect={category => {
          Analytics.track('category_selected', { categoryId: category.id });
          navigation.navigate('SubCategories', { category });
        }}
      />
    </Screen>
  );
}
