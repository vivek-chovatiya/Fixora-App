import React, { memo } from 'react';
import { Pressable, View } from 'react-native';

import { DynamicIcon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';
import type { Category } from '@/shared/types/models';

/** Generic category tile — the same component renders every service. */
export const CategoryTile = memo(function CategoryTile({ category, onPress }: { category: Category; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      testID={`category-${category.name}`}
      accessibilityRole="button"
      accessibilityLabel={category.name}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '30%',
        flexGrow: 1,
        maxWidth: '33%',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: pressed ? theme.opacity.pressed : 1,
      })}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
        <DynamicIcon glyph={category.icon} size="lg" color="primary" />
      </View>
      <Text variant="label" align="center" numberOfLines={2}>
        {category.name}
      </Text>
    </Pressable>
  );
});

export const CategoryGrid = memo(function CategoryGrid({ categories, onSelect }: { categories: Category[]; onSelect: (c: Category) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {categories.map(category => (
        <CategoryTile key={category.id} category={category} onPress={() => onSelect(category)} />
      ))}
    </View>
  );
});
