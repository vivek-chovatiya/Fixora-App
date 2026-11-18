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
import { SUBTLE_INK, useTheme, type IconName, type SubtleTint } from '@/shared/theme';

const COPY = VENDOR_COPY.dashboard;

interface TileProps {
  label: string;
  spokenLabel: string;
  /** The count as drawn — "4", or "400+" when it is only a lower bound. */
  count: string;
  icon: IconName;
  /**
   * The glyph disc's tint. The glyph takes that tint's own ink from
   * `SUBTLE_INK` (3G-4) — never a tone colour, which is under 4.5:1 on its
   * own tint in at least one theme — so the pair cannot be mismatched.
   */
  tint: SubtleTint;
  testID?: string;
}

function StatTile({ label, spokenLabel, count, icon, tint, testID }: TileProps) {
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
              backgroundColor: theme.colors[tint],
            },
          ]}>
          <Icon name={icon} size="sm" color={SUBTLE_INK[tint]} />
        </View>

        <View>
          <Text variant="h1" numberOfLines={1} testID={testID ? `${testID}-count` : undefined}>
            {count}
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

  // Past the read ceiling every count is "at least": drawn and said so, never as exact.
  const atLeast = counts.isLowerBound === true;
  const drawn = (count: number) => (atLeast ? COPY.countAtLeast(count) : String(count));
  const said = (spoken: string) => (atLeast ? COPY.atLeastSpoken(spoken) : spoken);

  return (
    <View style={[styles.row, { gap: theme.spacing.sm }]} testID={testID}>
      <StatTile
        label={COPY.pendingLabel}
        spokenLabel={said(COPY.pendingSpoken(counts.pending))}
        count={drawn(counts.pending)}
        icon="pending"
        tint="warningSubtle"
        testID="dashboard-stat-pending"
      />
      <StatTile
        label={COPY.activeLabel}
        spokenLabel={said(COPY.activeSpoken(counts.active))}
        count={drawn(counts.active)}
        icon="requests"
        tint="infoSubtle"
        testID="dashboard-stat-active"
      />
      <StatTile
        label={COPY.completedLabel}
        spokenLabel={said(COPY.completedSpoken(counts.completed))}
        count={drawn(counts.completed)}
        icon="success"
        tint="successSubtle"
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
