/**
 * CategoriesScreen
 *
 * The whole service catalogue (PROJECT_BIBLE.md section 11), reached from Home's
 * primary action and from the section that shows a preview of it.
 *
 * ⚠️ It knows no category. Names, glyphs, order and visibility all come from
 * CategoryService, and nothing here filters, sorts or renames what it is given —
 * so a category added to the backend tomorrow appears without a release, which
 * is what section 11 requires. The only value that ever travels onward is the
 * id: a name is display data the backend may change or translate, and routing on
 * one would make a rename a broken link.
 *
 * A list rather than a page of tiles, because its length is the backend's to
 * decide. Home lays its preview out with flexbox — it is a bounded slice inside
 * a page that scrolls for other reasons — while this screen is the scroller and
 * has no idea whether it is drawing eight categories or eighty. Both draw the
 * same CategoryTile, so the preview and the catalogue cannot drift apart.
 *
 * The loading state runs through the same grid as the real one. A placeholder
 * laid out by different code is a placeholder that stops matching what replaces
 * it, and the jump when the data lands is exactly what the skeleton exists to
 * prevent.
 */

import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CategoryTile } from '@/features/customer/components/CategoryTile';
import { Skeleton } from '@/features/customer/components/Skeleton';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useCategories } from '@/features/customer/hooks/useCategories';
import type { CustomerStackParamList } from '@/navigation/types';
import { BackButton, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { useResponsive } from '@/shared/hooks/useResponsive';
import type { ServiceCategory } from '@/shared/services/types/CategoryService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.categories;

/** Enough placeholder rows to fill a phone, so the wait has the page's shape. */
const PLACEHOLDER_ROWS = 4;
/** Height of a tile, used only to reserve its space while one is loading. */
const TILE_HEIGHT = 72;

type Props = NativeStackScreenProps<CustomerStackParamList, 'Categories'>;

/**
 * What occupies one square of the grid.
 *
 * Three kinds rather than a nullable category, because the three are genuinely
 * different things and a `null` would have to be read as "loading" in one place
 * and "padding" in another. Spacers exist so a short final row keeps its tiles
 * the same width as every other row's, instead of stretching one across the
 * page.
 */
type Cell =
  | { kind: 'category'; key: string; category: ServiceCategory }
  | { kind: 'placeholder'; key: string }
  | { kind: 'spacer'; key: string };

/** Pads a row out to the full column count. */
function withSpacers(cells: Cell[], columns: number): Cell[] {
  const remainder = cells.length % columns;

  if (remainder === 0) {
    return cells;
  }

  const padding = Array.from({ length: columns - remainder }, (_, index) => ({
    kind: 'spacer' as const,
    key: `spacer-${index}`,
  }));

  return [...cells, ...padding];
}

export function CategoriesScreen({ navigation }: Props) {
  const theme = useTheme();
  const { columns } = useResponsive();
  const { data, isLoading, isRefreshing, error, retry, refresh } = useCategories();

  const openCategory = useCallback(
    (categoryId: string) => {
      // The id alone. See the route's own note for why the name never travels.
      navigation.navigate('SubCategories', { categoryId });
    },
    [navigation],
  );

  const cells = useMemo<Cell[]>(() => {
    if (isLoading) {
      return Array.from({ length: columns * PLACEHOLDER_ROWS }, (_, index) => ({
        kind: 'placeholder' as const,
        key: `placeholder-${index}`,
      }));
    }

    return withSpacers(
      (data ?? []).map(category => ({
        kind: 'category' as const,
        key: category.id,
        category,
      })),
      columns,
    );
  }, [data, isLoading, columns]);

  const renderCell = useCallback(
    ({ item }: ListRenderItemInfo<Cell>) => {
      if (item.kind === 'spacer') {
        return <View style={styles.cell} />;
      }

      if (item.kind === 'placeholder') {
        return (
          <View style={styles.cell}>
            <Skeleton height={TILE_HEIGHT} radiusToken="lg" />
          </View>
        );
      }

      return (
        <View style={styles.cell}>
          <CategoryTile
            name={item.category.name}
            iconGlyph={item.category.iconGlyph}
            accessibilityHint={COPY.itemHint}
            onPress={() => openCategory(item.category.id)}
            testID={`category-${item.category.id}`}
          />
        </View>
      );
    },
    [openCategory],
  );

  const heading = (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="hero" accessibilityRole="header">
        {COPY.title}
      </Text>
      <Text variant="subtitle" color="textSecondary">
        {COPY.subtitle}
      </Text>
    </View>
  );

  return (
    <Screen
      padded={false}
      header={
        <View
          style={[
            styles.bar,
            {
              paddingHorizontal: theme.spacing.sm,
              height: theme.hitSlop.minTarget,
            },
          ]}>
          <BackButton
            onPress={navigation.goBack}
            accessibilityLabel={COPY.back}
            accessibilityHint={COPY.backHint}
            testID="categories-back"
          />
        </View>
      }
      testID="customer-categories">
      <FlatList
        // Remounted when the column count changes, because FlatList cannot be
        // told to lay out in a different number of columns while it is alive.
        key={`grid-${columns}`}
        data={cells}
        numColumns={columns}
        keyExtractor={cell => cell.key}
        renderItem={renderCell}
        ListHeaderComponent={heading}
        /*
          Failure and emptiness are both "the grid has nothing in it", so both
          live here rather than replacing the list.

          Rendering the error instead of the list took the heading with it —
          the screen lost its own name at the moment the user most needed to
          know where they were. Inside the list, the heading stands in every
          state and the page keeps its shape.
        */
        ListEmptyComponent={
          error ? (
            <ErrorState error={error} onRetry={retry} testID="categories-error" />
          ) : (
            <EmptyState
              title={COPY.emptyTitle}
              message={COPY.emptyMessage}
              icon="business"
              testID="categories-empty"
            />
          )
        }
        columnWrapperStyle={{ gap: theme.spacing.md }}
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.screenPadding,
            paddingTop: theme.spacing.lg,
            gap: theme.spacing.md,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onRefresh={refresh}
        refreshing={isRefreshing}
        // Announced once for the grid rather than once per placeholder.
        accessibilityLabel={isLoading ? COPY.loadingLabel : COPY.title}
        accessibilityState={{ busy: isLoading }}
        testID="categories-grid"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    justifyContent: 'center',
  },
  content: {
    // So the empty state can centre itself in the space below the heading
    // rather than sitting immediately under it.
    flexGrow: 1,
  },
  cell: {
    // Equal shares of the row, which is what keeps every tile the same width
    // whatever a category is called.
    flex: 1,
  },
});
