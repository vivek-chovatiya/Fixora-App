/**
 * DashboardOverview
 *
 * Three numbers: how much is waiting, how much is under way, how much is done
 * (PROJECT_BIBLE.md section 30).
 *
 * ⚠️ Counts and nothing else. No trend, no percentage, no chart — section 30
 * says not to overload the dashboard with analytics in Phase 1, and a number
 * that is simply true is more use than a graph of four data points.
 *
 * Each tile is one thing to a screen reader, and says what it counts: "Pending,
 * 4" leaves four of what unsaid, so the label is the whole phrase. The three are
 * told apart by their glyph and their word as well as their colour.
 *
 * Three equal columns at every width. They are sized by the row, never by a
 * number, so at 360dp each is narrow but whole; the label is one short word on
 * one line.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { Card, Icon, Text } from '@/shared/components';
import type { VendorDashboardCounts } from '@/shared/services/types/VendorDashboardService';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

const COPY = VENDOR_COPY.dashboard;

interface TileProps {
  label: string;
  spokenLabel: string;
  count: number;
  icon: IconName;
  tint: keyof ColorTokens;
  tintBackground: keyof ColorTokens;
  testID?: string;
}

function StatTile({ label, spokenLabel, count, icon, tint, tintBackground, testID }: TileProps) {
  const theme = useTheme();

  return (
    <Card bordered shadow="sm" style={[styles.tile, { padding: theme.spacing.md }]} testID={testID}>
      <View
        style={{ gap: theme.spacing.sm }}
        accessible
        accessibilityRole="text"
        accessibilityLabel={spokenLabel}>
        <View
          style={[
            styles.glyph,
            {
              width: theme.spacing.xxxl,
              height: theme.spacing.xxxl,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors[tintBackground],
            },
          ]}>
          <Icon name={icon} size="sm" color={tint} />
        </View>

        <View>
          <Text variant="h1" numberOfLines={1} testID={testID ? `${testID}-count` : undefined}>
            {String(count)}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export interface DashboardOverviewProps {
  counts: VendorDashboardCounts;
  testID?: string;
}

function DashboardOverviewComponent({ counts, testID }: DashboardOverviewProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing.sm }]} testID={testID}>
      <StatTile
        label={COPY.pendingLabel}
        spokenLabel={COPY.pendingSpoken(counts.pending)}
        count={counts.pending}
        icon="pending"
        tint="warning"
        tintBackground="warningSubtle"
        testID="dashboard-stat-pending"
      />
      <StatTile
        label={COPY.activeLabel}
        spokenLabel={COPY.activeSpoken(counts.active)}
        count={counts.active}
        icon="requests"
        tint="info"
        tintBackground="infoSubtle"
        testID="dashboard-stat-active"
      />
      <StatTile
        label={COPY.completedLabel}
        spokenLabel={COPY.completedSpoken(counts.completed)}
        count={counts.completed}
        icon="success"
        tint="success"
        tintBackground="successSubtle"
        testID="dashboard-stat-completed"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  tile: {
    // Equal shares of the row, and allowed to be narrower than their content
    // so a long count truncates instead of widening one tile past the others.
    flex: 1,
    minWidth: 0,
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const DashboardOverview = memo(DashboardOverviewComponent);
