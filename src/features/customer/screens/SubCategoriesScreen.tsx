/**
 * SubCategoriesScreen
 *
 * The services inside one category (PROJECT_BIBLE.md section 12), reached by
 * tapping a category.
 *
 * ⚠️ One screen for every category, which is the whole of section 12. There is
 * no ElectricianScreen and no map from a category to what is inside it: the
 * screen is handed an id, asks the backend what is in it, and renders the answer.
 * A category added, renamed or emptied on the backend needs no release here.
 *
 * It arrives with an id and nothing else. The category's name is recovered from
 * the catalogue rather than carried in a param — see the hook for why — and the
 * heading falls back to the instruction when it is not known, so the screen is
 * never waiting on context to be useful.
 *
 * Selecting a service is where this stage stops. It hands the two identifiers to
 * the request-creation seam, which is registered as a route and nothing more.
 */

import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Skeleton } from '@/features/customer/components/Skeleton';
import { SubCategoryRow } from '@/features/customer/components/SubCategoryRow';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useSubCategories } from '@/features/customer/hooks/useSubCategories';
import type { CustomerStackParamList } from '@/navigation/types';
import { BackButton, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { useAnalytics } from '@/shared/hooks/useAnalytics';
import type { SubCategory } from '@/shared/services/types/CategoryService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.subCategories;

/** Enough placeholder rows to fill a phone, so the wait has the page's shape. */
const PLACEHOLDER_COUNT = 6;
/** Height of a row, used only to reserve its space while one is loading. */
const ROW_HEIGHT = 72;

type Props = NativeStackScreenProps<CustomerStackParamList, 'SubCategories'>;

/** One identity for "nothing to list", so the list is not handed a new array every render. */
const NO_SERVICES: readonly SubCategory[] = Object.freeze([]);

export function SubCategoriesScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { categoryId } = route.params;
  const { services, categoryName } = useSubCategories(categoryId);

  const { data, isLoading, isRefreshing, error, retry, refresh } = services;
  const { track } = useAnalytics();

  const openRequest = useCallback(
    (subCategoryId: string) => {
      // Section 54's `subcategory_selected`: the same two identifiers the route
      // carries, and nothing the row displayed.
      track('subcategory_selected', { categoryId, subCategoryId });
      // Both identifiers, and only identifiers. Request creation needs to know
      // which service was chosen and which category it came from; it can ask the
      // backend what either of them means.
      navigation.navigate('CreateRequest', { categoryId, subCategoryId });
    },
    [navigation, categoryId, track],
  );

  // Nothing listed while the first read runs: the placeholders are the loading
  // region's, in the empty slot below, not rows of the list.
  const listed = isLoading ? NO_SERVICES : (data ?? NO_SERVICES);

  const renderService = useCallback(
    ({ item }: ListRenderItemInfo<SubCategory>) => (
      <SubCategoryRow
        name={item.name}
        description={item.description}
        iconGlyph={item.iconGlyph}
        accessibilityHint={COPY.itemHint}
        onPress={() => openRequest(item.id)}
        testID={`sub-category-${item.id}`}
      />
    ),
    [openRequest],
  );

  /*
    The category names the screen once it is known, and the instruction stands in
    until then. One line either way, so nothing reflows when the name arrives —
    and the supporting line below carries the instruction regardless, which is
    what lets the heading be a noun rather than a sentence.
  */
  const heading = (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="hero" accessibilityRole="header" testID="sub-categories-heading">
        {categoryName ?? COPY.fallbackTitle}
      </Text>
      <Text variant="subtitle" color="textSecondary">
        {COPY.subtitle}
      </Text>
    </View>
  );

  /*
    The wait, as a region of its own: named for it and busy, keyed so that it is
    replaced rather than updated into what follows — see the note on the list's
    empty slot below.
  */
  const waiting = (
    <View
      key="loading"
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={COPY.loadingLabel}
      accessibilityState={{ busy: true }}
      testID="sub-categories-loading">
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <Skeleton key={index} height={ROW_HEIGHT} radiusToken="lg" />
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
            testID="sub-categories-back"
          />
        </View>
      }
      testID="customer-sub-categories">
      <FlatList
        data={listed}
        keyExtractor={service => service.id}
        renderItem={renderService}
        ListHeaderComponent={heading}
        /*
          Waiting, failure and emptiness are all "the list has nothing in it", so
          all three live here rather than replacing the list — which would take
          the heading with them and leave the screen without its own name at the
          moment the user most needs to know where they are.

          ⚠️ The wait is a region of its own: named for it and busy, with a
          `key`, so it is replaced — never updated into what follows. Found on
          device, twice: a list carrying a state but no label reported the state
          as its name ("busy"), and dropping the state once loaded did not clear
          it, because the view was updated in place and a prop that becomes
          undefined is not an instruction to unset. Stating a label and the
          state on the list in every render cleared it, but the loaded list's
          label was the category's name — the heading's own words, read again as
          a stop of its own. Now the list itself carries neither, ever.
        */
        ListEmptyComponent={
          isLoading ? (
            waiting
          ) : error ? (
            <ErrorState error={error} onRetry={retry} testID="sub-categories-error" />
          ) : (
            <EmptyState
              title={COPY.emptyTitle}
              message={COPY.emptyMessage}
              icon="business"
              testID="sub-categories-empty"
            />
          )
        }
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
        testID="sub-categories-list"
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
});
