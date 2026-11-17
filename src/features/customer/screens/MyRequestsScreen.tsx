/**
 * MyRequestsScreen
 *
 * Every request the customer has sent (PROJECT_BIBLE.md section 23), behind the
 * Requests tab that section 26 gives it.
 *
 * It is what section 23 says and nothing more: the screen is "My Requests"; it
 * filters by All, Active, Completed and Cancelled; each card shows the service,
 * the vendor, the status, the date and the priority; a card opens the request's
 * details; and the list is paged. No search, no sort control, no actions on a
 * card — section 23 names none, and the one action a sent request has, Cancel
 * request before anybody accepts it (owner decision, 21/10/2026), lives on
 * Request Details. A cancellation there reaches this list through
 * `useMyRequests`, which reads again when told.
 *
 * ⚠️ It reads and it forgets. The requests come from `RequestService`, in the
 * service's order, filtered by the service; this screen holds a filter choice
 * and a page count for as long as it is mounted and writes nothing anywhere. A
 * card hands Request Details a reference and nothing else, so the details are
 * always the service's record and never this list's copy.
 *
 * The card is Home's `RecentRequestCard`, deliberately: it was built to section
 * 23's list of fields, so a request reads the same in both places.
 *
 * Pages are asked for, not fetched on scroll. Section 23 requires pagination
 * and says nothing about how the next page is reached, so the list ends in a
 * "Show more requests" button while there is more to show — nothing loads that
 * the customer did not ask for, and it is reachable by a screen reader like any
 * other control.
 *
 * Four states, each in the list rather than instead of it (see the lessons in
 * docs/WORKING_NOTES.md), so the heading and the filters stay where they are:
 * placeholders while the first page loads; a failure with a retry when nothing
 * could be shown; section 48's empty state when there are no requests at all, or
 * a quieter one when a filter matches nothing; and the list. A failure after
 * requests are already on screen — a refresh or the next page — is reported under
 * them, and they stay.
 */

import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RecentRequestCard } from '@/features/customer/components/RecentRequestCard';
import { SelectionChip } from '@/features/customer/components/SelectionChip';
import { Skeleton } from '@/features/customer/components/Skeleton';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useMyRequests } from '@/features/customer/hooks/useMyRequests';
import type { CustomerStackParamList, CustomerTabParamList } from '@/navigation/types';
import { Button, EmptyState, ErrorState, Loader, Screen, Text } from '@/shared/components';
import type {
  CustomerRequest,
  RequestHistoryFilter,
} from '@/shared/services/types/RequestService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.myRequests;
const HOME = CUSTOMER_COPY.home;

/**
 * A tab screen that also pushes onto the stack around it — Request Details and
 * Categories are stack routes, not tabs.
 */
type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Requests'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

/** Section 23's four views, in the order it lists them. */
const FILTERS: ReadonlyArray<{ value: RequestHistoryFilter; label: string }> = [
  { value: 'all', label: COPY.filterAll },
  { value: 'active', label: COPY.filterActive },
  { value: 'completed', label: COPY.filterCompleted },
  { value: 'cancelled', label: COPY.filterCancelled },
];

/** What a filter that matches nothing says. `all` is section 48's, below. */
const FILTER_EMPTY: Readonly<Record<Exclude<RequestHistoryFilter, 'all'>, { title: string; message: string }>> = {
  active: { title: COPY.emptyActiveTitle, message: COPY.emptyActiveMessage },
  completed: { title: COPY.emptyCompletedTitle, message: COPY.emptyCompletedMessage },
  cancelled: { title: COPY.emptyCancelledTitle, message: COPY.emptyCancelledMessage },
};

/** Roughly a card, the same reservation Home's list makes, so nothing jumps. */
const CARD_HEIGHT = 132;
/** Enough to fill a phone without pretending to know how many will come back. */
const PLACEHOLDER_COUNT = 4;

/** Declared once, so the safe-area calculation does not re-run every render. */
const TOP_EDGE_ONLY = ['top'] as const;

/** One identity for "nothing to list", so the list is not handed a new array every render. */
const NO_REQUESTS: readonly CustomerRequest[] = Object.freeze([]);

export function MyRequestsScreen({ navigation }: Props) {
  const theme = useTheme();
  const [filter, setFilter] = useState<RequestHistoryFilter>('all');

  const {
    items,
    error,
    failedDuring,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    retry,
  } = useMyRequests(filter);

  // The reference and nothing else: Request Details reads the record itself.
  const openRequest = useCallback(
    (requestId: string) => {
      navigation.navigate('RequestDetails', { requestId });
    },
    [navigation],
  );

  // Section 48's action for "no requests": the same place Home's primary action goes.
  const requestService = useCallback(() => {
    navigation.navigate('Categories');
  }, [navigation]);

  // Nothing listed while the first page loads: the placeholders are the loading
  // region's, in the empty slot below, not lines of the list.
  const listed = isLoading ? NO_REQUESTS : items;

  const renderRequest = useCallback(
    ({ item }: ListRenderItemInfo<CustomerRequest>) => (
      <RecentRequestCard request={item} onPress={openRequest} testID={`my-request-${item.id}`} />
    ),
    [openRequest],
  );

  const heading = (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="my-requests-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {/*
        One of four, said as one of four. Wrapped rather than scrolled sideways,
        so all four are always visible and none can be missed at 360dp.
      */}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={COPY.filtersLabel}
        style={[styles.filters, { gap: theme.spacing.sm }]}
        testID="my-requests-filters">
        {FILTERS.map(option => (
          <SelectionChip
            key={option.value}
            label={option.label}
            selected={filter === option.value}
            onPress={() => setFilter(option.value)}
            accessibilityHint={COPY.filterHint}
            testID={`my-requests-filter-${option.value}`}
          />
        ))}
      </View>
    </View>
  );

  /*
    Nothing to show: the wait while the first page is read, a failure when it
    could not be, otherwise empty — so "no requests" is never drawn over a read
    that may find some.

    ⚠️ The wait is a region of its own: named for it and busy, with a `key`, so
    it is replaced — never updated into what follows. The list used to carry
    the label and the busy state itself, stated on every render because a prop
    that becomes undefined is not unset on a view updated in place (Sub
    Categories, found on device) — and loaded, the labelled list was a TalkBack
    stop of its own ("Your requests") under a heading that had just said as
    much. Now the list carries neither, ever. Not fixed by giving the list a key
    per state: that would remount the heading and the filters inside it and
    drop TalkBack's focus from them when the page lands.
  */
  const nothing = isLoading ? (
    <View
      key="loading"
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={COPY.loadingLabel}
      accessibilityState={{ busy: true }}
      testID="my-requests-loading">
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <Skeleton key={index} height={CARD_HEIGHT} radiusToken="lg" />
      ))}
    </View>
  ) : error ? (
    <ErrorState error={error} onRetry={retry} fullScreen={false} testID="my-requests-error" />
  ) : filter === 'all' ? (
    <EmptyState
      title={HOME.recentEmptyTitle}
      message={HOME.recentEmptyMessage}
      icon="empty"
      actionLabel={HOME.primaryAction}
      onAction={requestService}
      fullScreen={false}
      testID="my-requests-empty"
    />
  ) : (
    <EmptyState
      title={FILTER_EMPTY[filter].title}
      message={FILTER_EMPTY[filter].message}
      icon="requests"
      fullScreen={false}
      testID="my-requests-empty"
    />
  );

  /*
    Under a list that has something in it: the next page arriving, a failure
    that left what was already shown in place, or the way to the next page.
  */
  let footer: React.ReactElement | null = null;
  if (items.length > 0 && !isLoading) {
    if (isLoadingMore) {
      footer = <Loader label={COPY.loadingMoreLabel} />;
    } else if (error && (failedDuring === 'more' || failedDuring === 'refresh')) {
      footer = (
        <ErrorState
          error={error}
          onRetry={retry}
          title={failedDuring === 'more' ? COPY.moreFailedTitle : undefined}
          fullScreen={false}
          testID="my-requests-more-error"
        />
      );
    } else if (hasMore) {
      footer = (
        <Button
          label={COPY.showMore}
          variant="secondary"
          onPress={loadMore}
          fullWidth
          accessibilityHint={COPY.showMoreHint}
        />
      );
    }
  }

  // Not offered over a failure with nothing behind it: the retry is right there,
  // and a pull would be a second, hidden one.
  const canRefresh = !(error && items.length === 0);

  return (
    <Screen
      padded={false}
      // The tab bar clears the home indicator itself.
      edges={TOP_EDGE_ONLY}
      testID="customer-my-requests">
      <FlatList
        data={listed}
        keyExtractor={request => request.id}
        renderItem={renderRequest}
        ListHeaderComponent={heading}
        ListEmptyComponent={nothing}
        ListFooterComponent={footer}
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.screenPadding,
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onRefresh={canRefresh ? refresh : undefined}
        refreshing={canRefresh ? isRefreshing : false}
        testID="my-requests-list"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  content: {
    // So the empty and error states can centre in the space under the filters.
    flexGrow: 1,
  },
});
