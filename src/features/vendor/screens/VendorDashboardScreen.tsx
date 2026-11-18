/**
 * VendorDashboardScreen
 *
 * The vendor application's landing screen once setup is done (PROJECT_BIBLE.md
 * section 30; Phase 3E-2): who is signed in, which business this is, how much
 * work is waiting, under way and done, and a few of each.
 *
 * ⚠️ It shows; it does not act. Nothing here accepts, rejects or moves a
 * request — those are the request list's and its details' (sections 31–36),
 * which are later phases — so the only things to press are the business card,
 * which opens the Profile tab, and each section's "See all", which opens the
 * Requests tab. Both are existing routes; this screen adds none. Since the
 * notifications inbox (section 57) there is a third: the bell beside the
 * greeting, which pushes `Notifications`. A failed unread count is a bell with
 * no badge, never an error here.
 *
 * ⚠️ Never blank. The greeting and the business card come from the profile the
 * vendor tree already holds, so they are drawn at once and need nothing from
 * the dashboard call. While the work loads, its place is held by placeholders;
 * if it fails, the failure and its retry sit where the work would have been and
 * the rest of the screen stays as it was.
 *
 * Section 30 also lists Today's Requests and Rating. Since Phase 3E-15 (owner
 * approval, 21/10/2026) both are drawn, side by side under the business card:
 * today's requests from the `today` report, the rating — stars, average and
 * how many reviews, or "No reviews yet", never "0.0" — from the reviews, which
 * it opens. Each is its own read (`DashboardFigure`): its own placeholder, its
 * own small failure with its own Try again, and never in the way of the work
 * or of each other. Accepted and In Progress as separate counts are still not
 * drawn — nothing the app is sent says them apart from Active.
 *
 * ⚠️ A pull reads everything on the page, the bell's count included, and so
 * does showing the tab again — quietly, under what is on screen. A read that
 * fails with something on screen keeps it, and one notice above the figures
 * says the dashboard may be out of date, with Try again (a pull, by hand).
 *
 * ⚠️ While the vendor is not accepting new requests (section 38's
 * "Availability"), a notice under the greeting says so, with "Turn on" — the
 * one thing here that changes anything, and only that: it turns new requests
 * back on through the same path as Profile's switch (`useAcceptingRequests`),
 * without asking, because turning on loses nothing. It reads the stored value,
 * so it goes only once the service has said yes; a failure leaves it with a
 * toast. Accepting draws nothing at all — no "you are available" banner over
 * the work.
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { AvailabilityNotice } from '@/features/vendor/components/AvailabilityNotice';
import { BusinessSummaryCard } from '@/features/vendor/components/BusinessSummaryCard';
import { DashboardFigure } from '@/features/vendor/components/DashboardFigure';
import { DashboardOverview } from '@/features/vendor/components/DashboardOverview';
import { JobPreviewSection } from '@/features/vendor/components/JobPreviewSection';
import { presentTodayRequests } from '@/features/vendor/constants/reportPresentation';
import { presentRatingFigure } from '@/features/vendor/constants/reviewPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useAcceptingRequests } from '@/features/vendor/hooks/useAcceptingRequests';
import { useVendorDashboard } from '@/features/vendor/hooks/useVendorDashboard';
import type { VendorStackParamList, VendorTabParamList } from '@/navigation/types';
import { ContentSection, ErrorState, Screen, Skeleton, StaleNotice, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.dashboard;

/** The tab bar already clears the home indicator. */
const TOP_EDGE_ONLY = ['top'] as const;

/** Roughly a stat tile and a job card, so the page does not jump as the real ones arrive. */
const TILE_HEIGHT = 112;
const CARD_HEIGHT = 148;
const PLACEHOLDER_TILES = 3;
const PLACEHOLDER_CARDS = 2;

type Props = CompositeScreenProps<
  BottomTabScreenProps<VendorTabParamList, 'Dashboard'>,
  NativeStackScreenProps<VendorStackParamList>
>;

export function VendorDashboardScreen({ navigation }: Props) {
  const theme = useTheme();
  const {
    greeting,
    name,
    profile,
    categoryNames,
    dashboard,
    isLoading,
    error,
    retry,
    today,
    rating,
    unreadNotifications,
    unreadIsLowerBound,
    refresh,
    isRefreshing,
    isStale,
    staleError,
  } = useVendorDashboard();

  const openProfile = useCallback(() => navigation.navigate('Profile'), [navigation]);
  const openRequests = useCallback(() => navigation.navigate('Requests'), [navigation]);
  // The reviews screen that was already there (section 41); the route carries nothing.
  const openReviews = useCallback(() => navigation.navigate('VendorReviews'), [navigation]);

  // The bell (section 57): read on arrival, on every return and on every pull; the inbox is a pushed screen.
  const openNotifications = useCallback(() => navigation.navigate('Notifications'), [navigation]);

  // Section 30's two figures, in the report's and the reviews' own words.
  const todayFigure = useMemo(() => {
    if (!today.data) {
      return undefined;
    }
    const shown = presentTodayRequests(today.data);
    return {
      label: COPY.todayLabel,
      value: shown.value,
      spoken: shown.spoken,
      icon: 'calendar' as const,
      tint: 'primarySubtle' as const,
    };
  }, [today.data]);

  const ratingFigure = useMemo(() => {
    if (!rating.data) {
      return undefined;
    }
    const shown = presentRatingFigure(rating.data);
    return {
      label: shown.caption,
      value: shown.average,
      stars: shown.stars,
      note: shown.note,
      spoken: shown.spoken,
      // The glyph the reports' rating carries, so the figure looks the same on both.
      icon: 'starOutline' as const,
      tint: 'warningSubtle' as const,
      onPress: openReviews,
      accessibilityHint: COPY.ratingHint,
    };
  }, [openReviews, rating.data]);

  // Section 38's availability: a notice only while new requests are off, and its one way back on.
  const { isAccepting, isChanging: isTurningOn, setAccepting } = useAcceptingRequests();
  const turnOn = useCallback(() => {
    // Never rejects: the outcome is a toast.
    setAccepting(true);
  }, [setAccepting]);

  return (
    <Screen
      scrollable
      edges={TOP_EDGE_ONLY}
      onRefresh={refresh}
      isRefreshing={isRefreshing}
      contentContainerStyle={{ gap: theme.spacing.xxl, paddingBottom: theme.spacing.xxl }}
      testID="vendor-dashboard">
      <View style={[styles.header, { gap: theme.spacing.md }]}>
        {/* One phrase to a screen reader: "Good morning, Ravi". */}
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${greeting}, ${name}`}
          style={styles.greeting}
          testID="dashboard-greeting">
          <Text variant="body" color="textSecondary">
            {greeting}
          </Text>
          <Text variant="h2" numberOfLines={1}>
            {name}
          </Text>
        </View>

        {/* Beside the greeting, never inside it: the greeting speaks as one heading. */}
        <NotificationBell
          unreadCount={unreadNotifications}
          isLowerBound={unreadIsLowerBound}
          onPress={openNotifications}
          testID="dashboard-notifications"
        />
      </View>

      {profile && !isAccepting ? (
        <AvailabilityNotice
          onTurnOn={turnOn}
          isTurningOn={isTurningOn}
          testID="dashboard-availability"
        />
      ) : null}

      {profile ? (
        <BusinessSummaryCard
          businessName={profile.businessName}
          imageUrl={profile.imageUrl}
          services={categoryNames}
          serviceArea={profile.serviceArea?.description}
          onPress={openProfile}
          testID="dashboard-business"
        />
      ) : null}

      {isStale ? (
        <StaleNotice
          title={COPY.staleTitle}
          message={COPY.staleMessage}
          error={staleError}
          retryLabel={COPY.staleRetry}
          retryHint={COPY.staleRetryHint}
          // The pull, by hand: everything stays where it is while it reads.
          onRetry={refresh}
          isRetrying={isRefreshing}
          testID="dashboard-stale"
        />
      ) : null}

      {/*
        Section 30's Today's Requests and Rating, each its own read. Two to a
        row; a failure takes the row, because its retry does not fit in half a
        360dp phone (DashboardFigure).
      */}
      <View style={[styles.figures, { gap: theme.spacing.sm }]} testID="dashboard-figures">
        <DashboardFigure
          figure={todayFigure}
          error={today.error}
          loadingLabel={COPY.todayLoading}
          failedTitle={COPY.todayFailedTitle}
          retryLabel={COPY.figureRetry}
          retrySpoken={COPY.todayRetrySpoken}
          retryHint={COPY.todayRetryHint}
          onRetry={today.retry}
          testID="dashboard-today"
        />
        <DashboardFigure
          figure={ratingFigure}
          error={rating.error}
          loadingLabel={COPY.ratingLoading}
          failedTitle={COPY.ratingFailedTitle}
          retryLabel={COPY.figureRetry}
          retrySpoken={COPY.ratingRetrySpoken}
          retryHint={COPY.ratingRetryHint}
          onRetry={rating.retry}
          testID="dashboard-rating"
        />
      </View>

      {isLoading ? (
        <View
          style={{ gap: theme.spacing.md }}
          // Announced once for the block rather than once per rectangle.
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={COPY.loading}
          testID="dashboard-loading">
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            {Array.from({ length: PLACEHOLDER_TILES }, (_, index) => (
              <Skeleton key={index} height={TILE_HEIGHT} radiusToken="lg" style={styles.tile} />
            ))}
          </View>
          {Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => (
            <Skeleton key={index} height={CARD_HEIGHT} radiusToken="lg" />
          ))}
        </View>
      ) : dashboard ? (
        <>
          <ContentSection title={COPY.overviewTitle} testID="dashboard-overview-section">
            <DashboardOverview counts={dashboard.counts} testID="dashboard-overview" />
          </ContentSection>

          <JobPreviewSection
            title={COPY.pendingTitle}
            jobs={dashboard.pending}
            emptyTitle={COPY.pendingEmptyTitle}
            emptyMessage={COPY.pendingEmptyMessage}
            emptyIcon="empty"
            actionLabel={COPY.seeAll}
            actionSpokenLabel={COPY.seeAllPendingSpoken}
            actionHint={COPY.seeAllHint}
            onSeeAll={openRequests}
            testID="dashboard-pending"
          />

          <JobPreviewSection
            title={COPY.activeTitle}
            jobs={dashboard.active}
            emptyTitle={COPY.activeEmptyTitle}
            emptyMessage={COPY.activeEmptyMessage}
            emptyIcon="requests"
            actionLabel={COPY.seeAll}
            actionSpokenLabel={COPY.seeAllActiveSpoken}
            actionHint={COPY.seeAllHint}
            onSeeAll={openRequests}
            testID="dashboard-active"
          />

          <JobPreviewSection
            title={COPY.completedTitle}
            jobs={dashboard.recentlyCompleted}
            emptyTitle={COPY.completedEmptyTitle}
            emptyMessage={COPY.completedEmptyMessage}
            emptyIcon="success"
            actionLabel={COPY.seeAll}
            actionSpokenLabel={COPY.seeAllCompletedSpoken}
            actionHint={COPY.seeAllHint}
            onSeeAll={openRequests}
            testID="dashboard-completed"
          />
        </>
      ) : error ? (
        <ErrorState
          error={error}
          title={COPY.failedTitle}
          onRetry={retry}
          fullScreen={false}
          testID="dashboard-error"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    // Takes the slack, so the bell stays at the trailing edge and a long name truncates.
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    // An equal share of the row, not the placeholder's default full width.
    flex: 1,
    width: 'auto',
  },
});
