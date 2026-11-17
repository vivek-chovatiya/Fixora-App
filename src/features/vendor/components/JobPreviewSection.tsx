/**
 * JobPreviewSection
 *
 * One of the dashboard's three groups of work: a heading, a few jobs, and the
 * way to the rest — or, when the group is empty, a sentence saying so.
 *
 * ⚠️ "See all" appears only when there is something to see. With nothing in the
 * group it would lead to an empty list, and the tab bar already owns the route
 * to Requests for anyone who wants it anyway.
 *
 * Empty is a normal state, not a failure: a vendor with no new requests has
 * had a quiet morning, so it is drawn with the shared `EmptyState` and no
 * alarm, and says what will appear here rather than that something is missing.
 */

import React, { memo } from 'react';
import { View } from 'react-native';

import { JobPreviewCard } from '@/features/vendor/components/JobPreviewCard';
import { ContentSection, EmptyState } from '@/shared/components';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import { useTheme, type IconName } from '@/shared/theme';

export interface JobPreviewSectionProps {
  title: string;
  jobs: VendorJobSummary[];
  emptyTitle: string;
  emptyMessage: string;
  emptyIcon: IconName;
  actionLabel: string;
  /** The action's spoken name — which list it opens. */
  actionSpokenLabel: string;
  actionHint: string;
  onSeeAll: () => void;
  testID: string;
}

function JobPreviewSectionComponent({
  title,
  jobs,
  emptyTitle,
  emptyMessage,
  emptyIcon,
  actionLabel,
  actionSpokenLabel,
  actionHint,
  onSeeAll,
  testID,
}: JobPreviewSectionProps) {
  const theme = useTheme();
  const hasJobs = jobs.length > 0;

  return (
    <ContentSection
      title={title}
      actionLabel={hasJobs ? actionLabel : undefined}
      onAction={hasJobs ? onSeeAll : undefined}
      actionAccessibilityLabel={actionSpokenLabel}
      actionAccessibilityHint={actionHint}
      testID={testID}>
      {hasJobs ? (
        <View style={{ gap: theme.spacing.md }} testID={`${testID}-list`}>
          {jobs.map(job => (
            <JobPreviewCard key={job.id} job={job} testID={`${testID}-job-${job.id}`} />
          ))}
        </View>
      ) : (
        <EmptyState
          title={emptyTitle}
          message={emptyMessage}
          icon={emptyIcon}
          fullScreen={false}
          testID={`${testID}-empty`}
        />
      )}
    </ContentSection>
  );
}

export const JobPreviewSection = memo(JobPreviewSectionComponent);
