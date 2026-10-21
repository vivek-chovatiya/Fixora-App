/**
 * VendorReviewsScreen
 *
 * What customers said about the vendor's work (PROJECT_BIBLE.md section 41,
 * Phase 3E-6): the average and the count above, each review below — the
 * stars, the customer, when, which job, and their words.
 *
 * ⚠️ Read-only, all of it. Section 41: "Vendor cannot edit customer reviews."
 * There is no reply, report, delete or contact anywhere on the screen; the only
 * controls are Back, a pull to read again, and Try again when a read failed.
 *
 * ⚠️ Whose reviews these are is the session's to say. The route carries
 * nothing (`VendorReviews: undefined`), so no link, restored state or hand-built
 * route can open another vendor's; the service reads the signed-in vendor and
 * refuses anybody else.
 *
 * ⚠️ The figures are the service's. The summary shows the average and count it
 * was given, worded by `presentRatingSummary`; nothing here adds up the list
 * underneath. The breakdown under the average is the service's counts per
 * star, turned into shares by `presentRatingBreakdown` — never a count of the
 * reviews on screen, which may one day be one page of them. No trend or
 * period.
 *
 * One list, and it owns the scrolling: the heading, the summary and any notice
 * are its header. Placeholders fill it while the first read runs. A failed
 * first read puts the failure and its retry where the reviews would be, with no
 * pull over it. No reviews says so calmly (section 48), without promising one
 * will follow every job. A failed pull keeps the reviews and says above them
 * that they may be out of date — the request list's notice (3E-3).
 *
 * Reached from the Profile tab (section 38 lists the rating there; section 43
 * keeps the tab bar to four), as a pushed screen with its own Back.
 */

import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RatingSummaryCard } from '@/features/vendor/components/RatingSummaryCard';
import { VendorReviewCard } from '@/features/vendor/components/VendorReviewCard';
import {
  presentRatingBreakdown,
  presentRatingSummary,
} from '@/features/vendor/constants/reviewPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useVendorReviews } from '@/features/vendor/hooks/useVendorReviews';
import type { VendorStackParamList } from '@/navigation/types';
import {
  BackButton,
  EmptyState,
  ErrorState,
  Screen,
  Skeleton,
  StaleNotice,
  Text,
} from '@/shared/components';
import type { VendorReview } from '@/shared/services/types/ReviewService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.reviews;

/**
 * Roughly the summary — with its five-row breakdown, as a vendor with reviews
 * has — and a review, so nothing jumps as the real ones arrive.
 */
const SUMMARY_HEIGHT = 248;
const CARD_HEIGHT = 136;
/** Enough to fill a phone without pretending to know how many will come back. */
const PLACEHOLDER_COUNT = 3;

type Props = NativeStackScreenProps<VendorStackParamList, 'VendorReviews'>;

/** One identity for "nothing to list", so the list is not handed a new array every render. */
const NO_REVIEWS: readonly VendorReview[] = Object.freeze([]);

export function VendorReviewsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { reviews, isLoading, error, retry, refresh, isRefreshing, isStale, staleError } =
    useVendorReviews();

  const summary = useMemo(() => (reviews ? presentRatingSummary(reviews) : null), [reviews]);
  const breakdown = useMemo(
    () => (reviews ? presentRatingBreakdown(reviews.ratingBreakdown) : null),
    [reviews],
  );

  // Nothing listed while the first read runs: the placeholders are the loading
  // region's, in the empty slot below, not lines of the list.
  const listed = isLoading ? NO_REVIEWS : (reviews?.reviews ?? NO_REVIEWS);

  const renderReview = useCallback(
    ({ item }: ListRenderItemInfo<VendorReview>) => (
      <VendorReviewCard review={item} testID={`vendor-review-${item.requestId}`} />
    ),
    [],
  );

  const bar = (
    <View
      style={[styles.bar, { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget }]}>
      <BackButton
        onPress={navigation.goBack}
        accessibilityLabel={COPY.back}
        testID="vendor-reviews-back"
      />
    </View>
  );

  const heading = (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="vendor-reviews-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {isLoading ? (
        <Skeleton height={SUMMARY_HEIGHT} radiusToken="lg" />
      ) : summary ? (
        <RatingSummaryCard
          summary={summary}
          breakdown={breakdown}
          testID="vendor-reviews-summary"
        />
      ) : null}

      {isStale ? (
        <StaleNotice
          title={COPY.staleTitle}
          message={COPY.staleMessage}
          error={staleError}
          retryLabel={COPY.staleRetry}
          retryHint={COPY.staleRetryHint}
          // A refresh, not a retry: the reviews stay where they are while it reloads.
          onRetry={refresh}
          isRetrying={isRefreshing}
          testID="vendor-reviews-stale"
        />
      ) : null}
    </View>
  );

  /*
    Nothing to list: the wait while the first read runs, a failure when it could
    not be made, otherwise there are no reviews — so "no reviews yet" is never
    drawn over a read that may find some.

    ⚠️ The wait is a region of its own: named for it and busy, with a `key`, so
    it is replaced — never updated into what follows. (The summary's
    placeholder above it is silent, as every placeholder is.) The list used to
    carry the label and the busy state itself, stated on every render because a
    prop that becomes undefined is not unset on a view updated in place (Sub
    Categories, found on device) — and loaded, the labelled list was a TalkBack
    stop of its own ("Your reviews") under a heading that had just said as
    much. Now the list carries neither, ever. Not fixed by giving the list a key
    per state: that would remount the heading and the summary inside it and
    drop TalkBack's focus from them when the reviews land.
  */
  const nothing = isLoading ? (
    <View
      key="loading"
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={COPY.loading}
      accessibilityState={{ busy: true }}
      testID="vendor-reviews-loading">
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <Skeleton key={index} height={CARD_HEIGHT} radiusToken="lg" />
      ))}
    </View>
  ) : error ? (
    <ErrorState
      error={error}
      title={COPY.failedTitle}
      onRetry={retry}
      fullScreen={false}
      testID="vendor-reviews-error"
    />
  ) : (
    <EmptyState
      title={COPY.emptyTitle}
      message={COPY.emptyMessage}
      icon="starOutline"
      fullScreen={false}
      testID="vendor-reviews-empty"
    />
  );

  // Not offered over a failure with nothing behind it: the retry is right
  // there, and a pull would be a second, hidden one.
  const canRefresh = !error;

  return (
    <Screen padded={false} header={bar} testID="vendor-reviews">
      <FlatList
        data={listed}
        // One review per request, so the reference is a key that cannot repeat.
        keyExtractor={review => review.requestId}
        renderItem={renderReview}
        ListHeaderComponent={heading}
        ListEmptyComponent={nothing}
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.screenPadding,
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.xxxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onRefresh={canRefresh ? refresh : undefined}
        refreshing={canRefresh ? isRefreshing : false}
        testID="vendor-reviews-list"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
  content: {
    // So the empty and error states can centre in the space under the heading.
    flexGrow: 1,
  },
});
