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
 *
 * ⚠️ Two regions, never one updated into the other. While loading, a region
 * named for the wait and marked busy — one "Loading recent requests, busy",
 * not a word per placeholder. Loaded, failed or empty, a plain container with
 * no name, role or state: the section heading above names it, and a labelled
 * view that cannot be pressed is a TalkBack stop of its own that says the
 * heading again.
 *
 * They carry different `key`s, and that is the fix. Seen on device: the loaded
 * section announced itself as the bare word "busy" (`content-desc="busy"`). The
 * placeholders and the cards were two `View`s at the same place in the tree, so
 * React updated one into the other rather than replacing it — and a prop that
 * becomes undefined is not an instruction to unset, so the loading view's
 * `busy` outlived it. Stating the label and the state on every render cleared
 * `busy` but kept the extra stop; a different key makes React replace the
 * native view, so the loaded one has nothing left over to forget. (The old
 * `progressbar` role went the same way.)
 */

import React, { memo, type ReactNode } from 'react';
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
  /** Opens one request, by identifier (section 23: request card → request details). */
  onOpenRequest: (requestId: string) => void;
  testID?: string;
}

function RecentRequestListComponent({
  requests,
  isLoading,
  error,
  onRetry,
  onRequestService,
  onOpenRequest,
  testID,
}: RecentRequestListProps) {
  const theme = useTheme();

  let content: ReactNode;

  if (isLoading) {
    content = (
      // Silent itself: the region around it says, once, that the section is
      // loading — not once per rectangle.
      <View style={{ gap: theme.spacing.md }} testID={testID ? `${testID}-loading` : undefined}>
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
          <Skeleton key={index} height={CARD_HEIGHT} radiusToken="lg" />
        ))}
      </View>
    );
  } else if (error) {
    content = (
      <ErrorState
        error={error}
        onRetry={onRetry}
        fullScreen={false}
        testID={testID ? `${testID}-error` : undefined}
      />
    );
  } else if (!requests || requests.length === 0) {
    content = (
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
  } else {
    content = requests.map(request => (
      <RecentRequestCard
        key={request.id}
        request={request}
        onPress={onOpenRequest}
        testID={`recent-request-${request.id}`}
      />
    ));
  }

  // Two keys, so the loading region is replaced rather than updated — see the
  // note at the top of this file.
  return isLoading ? (
    <View
      key="loading"
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={COPY.recentLoadingLabel}
      accessibilityState={{ busy: true }}
      testID={testID}>
      {content}
    </View>
  ) : (
    <View key="settled" style={{ gap: theme.spacing.md }} testID={testID}>
      {content}
    </View>
  );
}

export const RecentRequestList = memo(RecentRequestListComponent);
