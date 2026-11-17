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
 * ⚠️ The placeholders take the grid's measures — its column count, its cell and
 * its gaps — so the tiles land where they were and nothing jumps. They used to
 * be cells of the grid itself; they are now a region of their own in the empty
 * slot (see the note there for why), which means they are drawn by separate
 * code: a change to the grid's cell or gaps has to be made to both.
 *
 * ⚠️ A failed pull says so. It used to say nothing: the grid kept its tiles and
 * the failure, having nowhere to go but the empty slot, was never drawn. Now
 * the vendor lists' notice (3E-3) sits under the heading with a Try again that
 * pulls again, and the tiles stay. A failed *first* read is unchanged — there is
 * nothing to keep, so it is the full error with its own retry — and, as on the
 * vendor lists, no pull over it: the retry is right there, and a pull would be
 * a second, hidden one.
 */

import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CategoryTile } from '@/features/customer/components/CategoryTile';
import { Skeleton } from '@/features/customer/components/Skeleton';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useCategories } from '@/features/customer/hooks/useCategories';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  EmptyState,
  ErrorState,
  Screen,
  StaleNotice,
  Text,
} from '@/shared/components';
import { useAnalytics } from '@/shared/hooks/useAnalytics';
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
 * Two kinds rather than a nullable category, because a spacer is not a category
 * with nothing in it. Spacers exist so a short final row keeps its tiles the
 * same width as every other row's, instead of stretching one across the page.
 * A placeholder is not a cell at all: while the first read runs the grid is
 * empty, and the wait is the loading region's.
 */
type Cell =
  | { kind: 'category'; key: string; category: ServiceCategory }
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
  const { data, isLoading, isRefreshing, error, retry, refresh, isStale, staleError } =
    useCategories();
  const { track } = useAnalytics();

  const openCategory = useCallback(
    (categoryId: string) => {
      // Section 54's `category_selected`, by the id and never the name on the
      // tile — the same event Home's tiles send, so the two ways in count alike.
      track('category_selected', { categoryId });
      // The id alone. See the route's own note for why the name never travels.
      navigation.navigate('SubCategories', { categoryId });
    },
    [navigation, track],
  );

  const cells = useMemo<Cell[]>(() => {
    // Nothing in the grid while the first read runs: the placeholders are the
    // loading region's, in the empty slot below, not cells of the grid.
    if (isLoading) {
      return [];
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
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {isStale ? (
        <StaleNotice
          title={COPY.staleTitle}
          message={COPY.staleMessage}
          error={staleError}
          retryLabel={COPY.staleRetry}
          retryHint={COPY.staleRetryHint}
          // A refresh, not a retry: the tiles stay where they are while it reloads.
          onRetry={refresh}
          isRetrying={isRefreshing}
          testID="categories-stale"
        />
      ) : null}
    </View>
  );

  /*
    The wait, as a region of its own: named for it and busy, keyed so that it is
    replaced rather than updated into what follows — see the note on the list's
    empty slot below. Rows of the grid's own column count, cell and gaps.
  */
  const waiting = (
    <View
      key="loading"
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={COPY.loadingLabel}
      accessibilityState={{ busy: true }}
      testID="categories-loading">
      {Array.from({ length: PLACEHOLDER_ROWS }, (_, row) => (
        <View key={row} style={[styles.row, { gap: theme.spacing.md }]}>
          {Array.from({ length: columns }, (__, column) => (
            <View key={column} style={styles.cell}>
              <Skeleton height={TILE_HEIGHT} radiusToken="lg" />
            </View>
          ))}
        </View>
      ))}
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
          Waiting, failure and emptiness are all "the grid has nothing in it",
          so all three live here rather than replacing the list.

          Rendering the error instead of the list took the heading with it —
          the screen lost its own name at the moment the user most needed to
          know where they were. Inside the list, the heading stands in every
          state and the page keeps its shape.

          ⚠️ The wait is a region of its own: named for it and busy, with a
          `key`, so it is replaced — never updated into what follows. The grid
          used to carry the label and the busy state itself, stated on every
          render because a prop that becomes undefined is not unset on a view
          updated in place (Sub Categories, found on device) — and loaded, its
          label was this screen's title, the heading's own words, read again
          by TalkBack as a stop of its own. Now the grid carries neither, ever.
          Not fixed by giving the list a key per state: that would remount the
          heading inside it and drop TalkBack's focus from it when the catalogue
          lands. (Its key is the column count's, for its own reason above.)
        */
        ListEmptyComponent={
          isLoading ? (
            waiting
          ) : error ? (
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
        // Not offered over a first read that failed: `error` is only that one
        // (a failed pull is `isStale`, and keeps its pull), and its retry is
        // right there. The vendor lists' rule.
        onRefresh={error ? undefined : refresh}
        refreshing={error ? false : isRefreshing}
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
  row: {
    // What the list does for each row of a multi-column grid.
    flexDirection: 'row',
  },
  cell: {
    // Equal shares of the row, which is what keeps every tile the same width
    // whatever a category is called.
    flex: 1,
  },
});
