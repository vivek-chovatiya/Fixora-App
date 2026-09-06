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

import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Skeleton } from '@/features/customer/components/Skeleton';
import { SubCategoryRow } from '@/features/customer/components/SubCategoryRow';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useSubCategories } from '@/features/customer/hooks/useSubCategories';
import type { CustomerStackParamList } from '@/navigation/types';
import { BackButton, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import type { SubCategory } from '@/shared/services/types/CategoryService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.subCategories;

/** Enough placeholder rows to fill a phone, so the wait has the page's shape. */
const PLACEHOLDER_COUNT = 6;
/** Height of a row, used only to reserve its space while one is loading. */
const ROW_HEIGHT = 72;

type Props = NativeStackScreenProps<CustomerStackParamList, 'SubCategories'>;

/**
 * What occupies one line of the list.
 *
 * Two kinds rather than a nullable service, because a placeholder is not a
 * service with missing fields — it is a different thing that happens to take up
 * the same room.
 */
type Line =
  | { kind: 'service'; key: string; service: SubCategory }
  | { kind: 'placeholder'; key: string };

export function SubCategoriesScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { categoryId } = route.params;
  const { services, categoryName } = useSubCategories(categoryId);

  const { data, isLoading, isRefreshing, error, retry, refresh } = services;

  const openRequest = useCallback(
    (subCategoryId: string) => {
      // Both identifiers, and only identifiers. Request creation needs to know
      // which service was chosen and which category it came from; it can ask the
      // backend what either of them means.
      navigation.navigate('CreateRequest', { categoryId, subCategoryId });
    },
    [navigation, categoryId],
  );

  const lines = useMemo<Line[]>(() => {
    if (isLoading) {
      return Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => ({
        kind: 'placeholder' as const,
        key: `placeholder-${index}`,
      }));
    }

    return (data ?? []).map(service => ({
      kind: 'service' as const,
      key: service.id,
      service,
    }));
  }, [data, isLoading]);

  const renderLine = useCallback(
    ({ item }: ListRenderItemInfo<Line>) => {
      if (item.kind === 'placeholder') {
        return <Skeleton height={ROW_HEIGHT} radiusToken="lg" />;
      }

      return (
        <SubCategoryRow
          name={item.service.name}
          description={item.service.description}
          iconGlyph={item.service.iconGlyph}
          accessibilityHint={COPY.itemHint}
          onPress={() => openRequest(item.service.id)}
          testID={`sub-category-${item.service.id}`}
        />
      );
    },
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
        data={lines}
        keyExtractor={line => line.key}
        renderItem={renderLine}
        ListHeaderComponent={heading}
        /*
          Failure and emptiness are both "the list has nothing in it", so both
          live here rather than replacing the list — which would take the heading
          with them and leave the screen without its own name at the moment the
          user most needs to know where they are.
        */
        ListEmptyComponent={
          error ? (
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
        /*
          Named in both states, and busy stated in both states.

          Found on device, twice. A list carrying a state but no label reports
          the state as its name, so the region announced itself as "busy"; and
          dropping the state once loading finished did not clear it, because the
          view is updated rather than remounted and a prop that becomes undefined
          is not an instruction to unset the old value. Both halves have to be
          present on every render for either to be true.
        */
        accessibilityLabel={
          isLoading ? COPY.loadingLabel : (categoryName ?? COPY.fallbackTitle)
        }
        accessibilityState={{ busy: isLoading }}
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
