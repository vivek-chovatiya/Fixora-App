/**
 * CategoryGrid
 *
 * The category section's four states: loading, failed, empty, and a grid.
 *
 * ⚠️ Not a list component. Home is already a scroll view, and PROJECT_BIBLE.md
 * section 53 forbids nesting one scrollable inside another — so this lays its
 * tiles out with flexbox and lets the page do the scrolling. The full catalogue
 * lives on the Categories screen, which is free to use a FlatList because it
 * scrolls itself.
 *
 * Rows are built explicitly rather than left to `flexWrap`. A wrapping row with
 * a gap has to be given percentage widths that account for that gap, and the
 * arithmetic is wrong by a pixel or two at every breakpoint; chunking into rows
 * of equal `flex: 1` children is exact at any width, and a short final row is
 * padded with spacers so its tiles keep the same size as the rest.
 *
 * The failure here is deliberately not the screen's failure. Categories going
 * missing costs the user discovery, not the screen — the primary action above
 * still works — so this reports in place and offers a retry rather than
 * replacing the page.
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryTile } from '@/features/customer/components/CategoryTile';
import { Skeleton } from '@/features/customer/components/Skeleton';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { EmptyState, ErrorState } from '@/shared/components';
import { useResponsive } from '@/shared/hooks/useResponsive';
import type { ServiceCategory } from '@/shared/services/types/CategoryService';
import { useTheme } from '@/shared/theme';
import type { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.home;

/**
 * How many rows of the responsive grid Home gives to a preview.
 *
 * A layout decision rather than a theme token: it is how much of this screen is
 * worth spending on discovery before the recent requests below it are pushed off
 * the fold. The catalogue itself is whatever the backend returns, and "See all"
 * is where the rest of it lives.
 */
const PREVIEW_ROWS = 3;

/** Height of a tile, used only to reserve its space while one is loading. */
const TILE_HEIGHT = 72;

export interface CategoryGridProps {
  categories: ServiceCategory[] | undefined;
  isLoading: boolean;
  error: AppError | null;
  onRetry: () => void;
  onSelect: () => void;
  testID?: string;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}

function CategoryGridComponent({
  categories,
  isLoading,
  error,
  onRetry,
  onSelect,
  testID,
}: CategoryGridProps) {
  const theme = useTheme();
  const { columns } = useResponsive();

  const rows = useMemo(
    () => chunk((categories ?? []).slice(0, columns * PREVIEW_ROWS), columns),
    [categories, columns],
  );

  if (isLoading) {
    return (
      <View
        style={[styles.grid, { gap: theme.spacing.md }]}
        // Said once, for the whole section. A screen reader announcing every
        // placeholder would report the same fact as many times as there are
        // rectangles.
        accessibilityRole="progressbar"
        accessibilityLabel={COPY.categoriesTitle}
        accessibilityState={{ busy: true }}
        testID={testID ? `${testID}-loading` : undefined}>
        {chunk(Array.from({ length: columns * 2 }, (_, index) => index), columns).map(row => (
          <View key={row[0]} style={[styles.row, { gap: theme.spacing.md }]}>
            {row.map(key => (
              <Skeleton key={key} height={TILE_HEIGHT} radiusToken="lg" style={styles.cell} />
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={onRetry}
        fullScreen={false}
        testID={testID ? `${testID}-error` : undefined}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={COPY.categoriesEmptyTitle}
        message={COPY.categoriesEmptyMessage}
        icon="business"
        fullScreen={false}
        testID={testID ? `${testID}-empty` : undefined}
      />
    );
  }

  return (
    <View style={[styles.grid, { gap: theme.spacing.md }]} testID={testID}>
      {rows.map(row => (
        <View key={row[0]?.id} style={[styles.row, { gap: theme.spacing.md }]}>
          {row.map(category => (
            <View key={category.id} style={styles.cell}>
              <CategoryTile
                name={category.name}
                iconGlyph={category.iconGlyph}
                onPress={onSelect}
                testID={`category-tile-${category.id}`}
              />
            </View>
          ))}

          {/*
            Keeps the last row's tiles the same width as every other row's.
            Without them a row of one would stretch that tile across the page.
          */}
          {Array.from({ length: columns - row.length }, (_, index) => (
            <View key={`spacer-${index}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    // Stretch, so a tile whose label wraps to two lines does not leave its
    // neighbours shorter than itself.
    alignItems: 'stretch',
  },
  cell: {
    flex: 1,
  },
});

export const CategoryGrid = memo(CategoryGridComponent);
