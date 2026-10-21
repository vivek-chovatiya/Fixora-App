/**
 * VendorReportsScreen
 *
 * The vendor's basic report (PROJECT_BIBLE.md section 42; section 56's "View
 * Basic Reports"): choose Today, This week or This month, and see five figures
 * for it — total requests, completed, rejected, cancelled, and the average
 * rating with how many ratings it comes from.
 *
 * ⚠️ Simple, and read-only. Section 42: "Do not build advanced financial
 * analytics in Phase 1." No money, no chart, no rate or percentage, no trend,
 * no comparison, no export, no date picker; the only controls are Back, the
 * three periods, a pull to read again, and Try again when a read failed.
 *
 * ⚠️ The figures are the server's, and so are the periods' dates. The screen
 * sends a period key and draws what comes back, worded by
 * `presentVendorReport`; nothing here counts requests or averages reviews.
 *
 * ⚠️ A period's figures appear only under that period. Choosing another while
 * a read is in the air shows placeholders until the new period's own answer
 * arrives — never the old period's figures under the new choice
 * (`useVendorReport` says how). The choice stays put through a pull.
 *
 * ⚠️ Whose report it is, is the session's. The route carries nothing
 * (`VendorReports: undefined`), so no link, restored state or hand-built route
 * can open another vendor's; the service reads the signed-in vendor and refuses
 * anybody else.
 *
 * States: placeholders while a period's read runs, announced once and busy; the
 * figures; a quiet period as zeros with a calm line under them — zeros are
 * figures, not an empty state or a fault; a failed read with Try again where the
 * figures would be, and no pull over it; a failed pull keeps the figures and
 * says above them that they may be out of date — the request list's notice
 * (3E-3).
 *
 * Reached from the Profile tab (section 43: "Reports accessed from
 * Dashboard/Profile"; the dashboard is left as it is), as a pushed screen with
 * its own Back. The tab bar stays at four.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ReportFigureCard } from '@/features/vendor/components/ReportFigureCard';
import {
  VENDOR_REPORT_PERIOD_OPTIONS,
  presentVendorReport,
  type ReportCountKey,
} from '@/features/vendor/constants/reportPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useVendorReport } from '@/features/vendor/hooks/useVendorReport';
import type { VendorStackParamList } from '@/navigation/types';
import {
  BackButton,
  ErrorState,
  Screen,
  SelectionChip,
  Skeleton,
  StaleNotice,
  Text,
} from '@/shared/components';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

const COPY = VENDOR_COPY.reports;

/** Roughly a count card and the rating card, so nothing jumps as the figures arrive. */
const COUNT_HEIGHT = 128;
const RATING_HEIGHT = 156;
const COUNT_PLACEHOLDERS = 4;

interface FigureLook {
  icon: IconName;
  tint: keyof ColorTokens;
  tintBackground: keyof ColorTokens;
}

/** Each count is told apart by its glyph and its word as well as its tint (section 46). */
const COUNT_LOOKS: Readonly<Record<ReportCountKey, FigureLook>> = {
  total: { icon: 'requests', tint: 'info', tintBackground: 'infoSubtle' },
  completed: { icon: 'success', tint: 'success', tintBackground: 'successSubtle' },
  // Neutral, not red: turning work down and a customer calling it off are
  // ordinary outcomes, and error styling is for faults (section 49.1).
  rejected: { icon: 'reject', tint: 'neutral', tintBackground: 'neutralSubtle' },
  cancelled: { icon: 'cancelled', tint: 'neutral', tintBackground: 'neutralSubtle' },
};

type Props = NativeStackScreenProps<VendorStackParamList, 'VendorReports'>;

export function VendorReportsScreen({ navigation }: Props) {
  const theme = useTheme();
  const {
    period,
    selectPeriod,
    report,
    isLoading,
    error,
    retry,
    refresh,
    isRefreshing,
    isStale,
    staleError,
  } = useVendorReport();

  const figures = useMemo(() => (report ? presentVendorReport(report) : null), [report]);
  // Drawn only once the chosen period's read has settled with an answer.
  const shown = isLoading ? null : figures;

  const bar = (
    <View
      style={[styles.bar, { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget }]}>
      <BackButton
        onPress={navigation.goBack}
        accessibilityLabel={COPY.back}
        testID="vendor-reports-back"
      />
    </View>
  );

  let body: React.ReactNode = null;
  if (isLoading) {
    body = (
      <View
        style={[styles.grid, { gap: theme.spacing.sm }]}
        // Announced once for the block rather than once per rectangle.
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={COPY.loading}
        accessibilityState={{ busy: true }}
        testID="vendor-reports-loading">
        {Array.from({ length: COUNT_PLACEHOLDERS }, (_, index) => (
          <Skeleton key={index} width="auto" height={COUNT_HEIGHT} radiusToken="lg" style={styles.half} />
        ))}
        <Skeleton width="auto" height={RATING_HEIGHT} radiusToken="lg" style={styles.whole} />
      </View>
    );
  } else if (shown) {
    body = (
      <View style={{ gap: theme.spacing.md }} testID="vendor-reports-figures">
        {/*
          Two to a row, sized by the row and never by a number, so at 360dp each
          is half the width and whole; the rating, fifth, takes a row of its own.
        */}
        <View style={[styles.grid, { gap: theme.spacing.sm }]}>
          {shown.counts.map(count => (
            <ReportFigureCard
              key={count.key}
              label={count.label}
              value={count.value}
              spoken={count.spoken}
              {...COUNT_LOOKS[count.key]}
              style={styles.half}
              testID={`vendor-reports-${count.key}`}
            />
          ))}
          <ReportFigureCard
            label={COPY.rating}
            value={shown.rating.average}
            stars={shown.rating.stars}
            note={shown.rating.note}
            spoken={shown.rating.spoken}
            icon="starOutline"
            tint="warning"
            tintBackground="warningSubtle"
            style={styles.whole}
            testID="vendor-reports-rating"
          />
        </View>

        {/* Zeros are this period's figures, not a fault: said calmly, under them. */}
        {shown.isQuiet ? (
          <Text variant="body" color="textSecondary" testID="vendor-reports-quiet">
            {COPY.noRequests}
          </Text>
        ) : null}
      </View>
    );
  } else if (error) {
    body = (
      <ErrorState
        error={error}
        title={COPY.failedTitle}
        onRetry={retry}
        fullScreen={false}
        testID="vendor-reports-error"
      />
    );
  }

  return (
    <Screen
      scrollable
      header={bar}
      // Only over figures: over a failure the retry is right there, and a pull
      // would be a second, hidden one; over placeholders a read is already out.
      onRefresh={shown ? refresh : undefined}
      isRefreshing={shown ? isRefreshing : false}
      contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
      testID="vendor-reports">
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="vendor-reports-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {/*
        One of three, said as one of three. Wrapped rather than scrolled
        sideways, so all three are always visible at 360dp. Never disabled:
        choosing again while a read is out is allowed, and the newer choice wins.
      */}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={COPY.periodsLabel}
        style={[styles.periods, { gap: theme.spacing.sm }]}
        testID="vendor-reports-periods">
        {VENDOR_REPORT_PERIOD_OPTIONS.map(option => (
          <SelectionChip
            key={option.value}
            label={option.label}
            selected={period === option.value}
            onPress={() => selectPeriod(option.value)}
            accessibilityHint={COPY.periodHint}
            testID={`vendor-reports-period-${option.value}`}
          />
        ))}
      </View>

      {isStale && shown ? (
        <StaleNotice
          title={COPY.staleTitle}
          message={COPY.staleMessage}
          error={staleError}
          retryLabel={COPY.staleRetry}
          retryHint={COPY.staleRetryHint}
          // A refresh, not a retry: the figures stay where they are while it reloads.
          onRetry={refresh}
          isRetrying={isRefreshing}
          testID="vendor-reports-stale"
        />
      ) : null}

      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
  periods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  half: {
    // Two to a row: 40% each leaves room for the gap, and growing fills the rest.
    flexGrow: 1,
    flexBasis: '40%',
  },
  whole: {
    flexBasis: '100%',
  },
});
