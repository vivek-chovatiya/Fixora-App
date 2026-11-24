import React, { useState } from 'react';
import { View } from 'react-native';

import { ChipGroup, ErrorState, Loader, Screen, StatTile, Text } from '@/shared/components';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { vendorApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import type { ReportPeriod } from '@/shared/types/models';

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'TODAY', label: 'Today' },
  { value: 'WEEK', label: 'This Week' },
  { value: 'MONTH', label: 'This Month' },
];

/** Simple Phase 1 reports — no financial analytics (§42). */
export function VendorReportsScreen() {
  const theme = useTheme();
  const [period, setPeriod] = useState<ReportPeriod>('TODAY');
  const query = useServiceQuery(() => vendorApi.report(period), [period]);
  const r = query.data;

  return (
    <Screen testID="vendor-reports-screen" refreshing={query.isRefreshing} onRefresh={query.refresh}>
      <ChipGroup options={PERIODS} value={period} onChange={setPeriod} testIDPrefix="report-period" />
      {query.isLoading ? <Loader /> : null}
      {query.error ? <ErrorState error={query.error} onRetry={query.retry} /> : null}
      {r && !query.isLoading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          <StatTile testID="report-total" label="Total requests" value={r.totalRequests} icon="requests" />
          <StatTile testID="report-completed" label="Completed" value={r.completedRequests} icon="success" />
          <StatTile testID="report-rejected" label="Rejected" value={r.rejectedRequests} icon="close" />
          <StatTile testID="report-cancelled" label="Cancelled" value={r.cancelledRequests} icon="info" />
          <StatTile label="Average rating" value={r.averageRating.toFixed(1)} icon="star" />
          <StatTile label="Reviews this period" value={r.periodReviews} icon="starOutline" />
        </View>
      ) : null}
      <Text variant="caption" color="textTertiary">
        Totals include requests you accepted or declined in the selected period.
      </Text>
    </Screen>
  );
}
