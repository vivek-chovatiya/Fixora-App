/**
 * RequestReviewSummary
 *
 * A submitted review, read back (PROJECT_BIBLE.md section 24: "Review Submitted
 * → Read-only Review").
 *
 * ⚠️ Read-only, and nothing on it suggests otherwise. There is no edit and no
 * delete, because section 24 gives a customer one review per request and no way
 * to change it. The same drawing is used on Request Details and on the review
 * screen after sending, so the customer sees one review, not two versions of it.
 *
 * It shows what the review holds — the stars, the comment exactly as written,
 * and when it was sent — and no claim about what happened to it afterwards.
 */

import React from 'react';
import { View } from 'react-native';

import { RequestSummaryBlock, RequestSummaryRow } from '@/features/customer/components/RequestSummary';
import { StarRating } from '@/features/customer/components/StarRating';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { formatRequestDate } from '@/features/customer/constants/requestPresentation';
import type { RequestReview } from '@/shared/services/types/ReviewService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.review;

export interface RequestReviewSummaryProps {
  review: RequestReview;
  testID?: string;
}

export function RequestReviewSummary({ review, testID }: RequestReviewSummaryProps) {
  const theme = useTheme();

  const sent = formatRequestDate(review.submittedAt);
  const comment = review.comment?.trim() ? review.comment : undefined;

  return (
    <View style={{ gap: theme.spacing.md }} testID={testID}>
      <StarRating value={review.rating} size="lg" testID={testID ? `${testID}-rating` : undefined} />

      {comment ? (
        <RequestSummaryBlock
          label={COPY.commentLabelReadOnly}
          value={comment}
          testID={testID ? `${testID}-comment` : undefined}
        />
      ) : null}

      {sent ? (
        <RequestSummaryRow
          label={COPY.submittedLabel}
          value={sent}
          testID={testID ? `${testID}-sent` : undefined}
        />
      ) : null}
    </View>
  );
}
