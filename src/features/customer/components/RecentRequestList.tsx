/**
 * RecentRequestList
 *
 * The recent requests section's four states.
 *
 * ⚠️ Not a FlatList. It renders at most a handful of cards inside a page that
 * already scrolls, and nesting a list in a scroll view is what section 53 warns
 * against. The full history has its own screen, which scrolls itself and can
 * paginate properly.
 *
 * The empty state is the copy PROJECT_BIBLE.md section 48 fixes, with the action
 * it fixes too. Somebody with no requests is not in an error state and is not
 * stuck — they are one tap from their first one, and the section says so.
 *
 * A failure here reports in place rather than taking the screen. Losing the
 * history costs the user a summary; the categories above and the primary action
 * at the top are untouched, and a page that blanked itself over a missing
 * summary would be a worse screen than one that admits the gap.
 */

import React, { memo } from 'react';
import { View } from 'react-native';

import { RecentRequestCard } from '@/features/customer/components/RecentRequestCard';
import { Skeleton } from '@/features/customer/components/Skeleton';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { EmptyState, ErrorState } from '@/shared/components';
import type { CustomerRequest } from '@/shared/services/types/RequestService';
import { useTheme } from '@/shared/theme';
import type { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.home;

/** Roughly a card, so the section does not resize as the real ones arrive. */
const CARD_HEIGHT = 132;
/** Enough to read as a list without pretending to know how many will come back. */
const PLACEHOLDER_COUNT = 2;

export interface RecentRequestListProps {
  requests: CustomerRequest[] | undefined;
  isLoading: boolean;
  error: AppError | null;
  onRetry: () => void;
  /** The empty state's way out, which is the screen's primary action. */
  onRequestService: () => void;
  testID?: string;
}

function RecentRequestListComponent({
  requests,
  isLoading,
  error,
  onRetry,
  onRequestService,
  testID,
}: RecentRequestListProps) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <View
        style={{ gap: theme.spacing.md }}
        // Announced once for the section rather than once per rectangle.
        accessibilityRole="progressbar"
        accessibilityLabel={COPY.recentTitle}
        accessibilityState={{ busy: true }}
        testID={testID ? `${testID}-loading` : undefined}>
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
          <Skeleton key={index} height={CARD_HEIGHT} radiusToken="lg" />
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={onRetry}
        fullScreen={false}
        testID={testID ? `${testID}-error` : undefined}
      />
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <EmptyState
        title={COPY.recentEmptyTitle}
        message={COPY.recentEmptyMessage}
        icon="empty"
        actionLabel={COPY.primaryAction}
        onAction={onRequestService}
        fullScreen={false}
        testID={testID ? `${testID}-empty` : undefined}
      />
    );
  }

  return (
    <View style={{ gap: theme.spacing.md }} testID={testID}>
      {requests.map(request => (
        <RecentRequestCard
          key={request.id}
          request={request}
          testID={`recent-request-${request.id}`}
        />
      ))}
    </View>
  );
}

export const RecentRequestList = memo(RecentRequestListComponent);
