/**
 * RequestReviewScreen
 *
 * Section 24's "Rate Your Experience", for one request.
 *
 * ⚠️ It decides nothing from its route. It is handed a reference, reads the
 * request from `RequestService` and its review from `ReviewService`, and asks
 * `reviewAvailabilityOf` what to draw — so a route opened from a stale screen, or
 * built by hand, can at worst reach a screen that says the request cannot be
 * reviewed. The form appears only for a completed or closed request that has no
 * review.
 *
 * ⚠️ One review per request, held three ways. The button locks while the call is
 * in flight and a ref stops a second tap landing in the same frame; the service
 * refuses a second review whatever reaches it; and a successful one replaces the
 * form with the review read back, so there is nothing left to press. A refusal
 * because the request already has a review — sent from somewhere else, or by a
 * retry that raced the original — re-reads both records, and the screen then
 * shows the review that exists rather than an error about it.
 *
 * A review changes nothing else. The request's status, its professional and its
 * history are exactly what they were; nothing here calls `RequestService` for
 * anything but a read.
 *
 * After sending: section 24's "Review Submitted → Read-only Review". The form
 * gives way to the review as sent, announced once, with a way back to the
 * request — which now shows the same review in place of the prompt. A failure
 * keeps the customer here with everything they entered, and the button retries.
 */

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormSection } from '@/features/customer/components/FormSection';
import { RequestReviewSummary } from '@/features/customer/components/RequestReviewSummary';
import { Skeleton } from '@/features/customer/components/Skeleton';
import { StarRating } from '@/features/customer/components/StarRating';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import {
  isReviewableStatus,
  reviewAvailabilityOf,
} from '@/features/customer/constants/requestReview';
import { hasAssignedProfessional, requestStateOf } from '@/features/customer/constants/requestStatus';
import { useRequestDetails } from '@/features/customer/hooks/useRequestDetails';
import { useRequestReview } from '@/features/customer/hooks/useRequestReview';
import { useSubmitReview } from '@/features/customer/hooks/useSubmitReview';
import {
  NO_RATING,
  REVIEW_COMMENT_MAX_LENGTH,
  reviewSchema,
  type ReviewForm,
} from '@/features/customer/validation/reviewSchemas';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  Button,
  Card,
  ControlledInput,
  EmptyState,
  ErrorState,
  Icon,
  PrimaryButton,
  Screen,
  Text,
} from '@/shared/components';
import type { CustomerRequestDetails } from '@/shared/services/types/RequestService';
import type { RequestReview } from '@/shared/services/types/ReviewService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.review;

/** How close to the ceiling the comment counter appears, as the notes box does. */
const COMMENT_COUNTER_THRESHOLD = 100;

/** The request line, the stars and the comment box, roughly. */
const LOADING_BLOCK_HEIGHTS = [72, 112, 160] as const;

type Props = NativeStackScreenProps<CustomerStackParamList, 'RequestReview'>;

function LoadingReview() {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={COPY.loadingLabel}
      accessibilityState={{ busy: true }}
      style={{ gap: theme.spacing.lg }}
      testID="request-review-loading">
      {LOADING_BLOCK_HEIGHTS.map((height, index) => (
        <Skeleton key={index} height={height} radiusToken="lg" />
      ))}
    </View>
  );
}

/**
 * Which request this is about, so nobody rates the wrong job. The professional
 * is named only when the status says somebody had it.
 */
function ReviewedRequest({ request }: { request: CustomerRequestDetails }) {
  const theme = useTheme();

  const service = request.serviceName.trim() || CUSTOMER_COPY.confirmation.serviceFallback;
  const dispatch = request.preferredVendor ? 'directed' : 'open';
  const professional = hasAssignedProfessional(requestStateOf(request.status, dispatch))
    ? request.vendorName?.trim()
    : undefined;

  return (
    <Card bordered style={{ padding: theme.spacing.lg }} testID="request-review-request">
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          professional
            ? `${COPY.requestLabel}: ${service}, ${COPY.vendorPrefix} ${professional}`
            : `${COPY.requestLabel}: ${service}`
        }
        style={{ gap: theme.spacing.xxs }}>
        <Text variant="h3">{service}</Text>
        {professional ? (
          <Text variant="caption" color="textSecondary">
            {`${COPY.vendorPrefix} ${professional}`}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/** The review as it now stands, and — just after sending — that it was sent. */
function ReadOnlyReview({
  review,
  justSent,
  onBack,
}: {
  review: RequestReview;
  justSent: boolean;
  onBack: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {justSent ? (
        <Card
          bordered
          style={{ padding: theme.spacing.lg }}
          testID="request-review-success">
          {/*
            One node, announced when it appears. It is the only thing that
            changes on screen at the moment of success, so it is what says so.
          */}
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${COPY.successTitle}. ${COPY.successMessage}`}
            style={[styles.row, { gap: theme.spacing.md }]}>
            <Icon name="success" size="lg" color="success" />
            <View style={[styles.grow, { gap: theme.spacing.xxs }]}>
              <Text variant="bodyStrong">{COPY.successTitle}</Text>
              <Text variant="body" color="textSecondary">
                {COPY.successMessage}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <FormSection title={COPY.yourReviewTitle}>
        <RequestReviewSummary review={review} testID="request-review-read-only" />
      </FormSection>

      <Button
        label={COPY.backToRequest}
        variant="secondary"
        onPress={onBack}
        fullWidth
        accessibilityHint={COPY.backToRequestHint}
      />
    </View>
  );
}

export function RequestReviewScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { requestId } = route.params;

  const details = useRequestDetails(requestId);
  const request = details.request;

  // Looked up only for a request that could have one, as Request Details does.
  const reviewQuery = useRequestReview(
    requestId,
    request ? isReviewableStatus(request.status) : false,
  );
  const submission = useSubmitReview(requestId);

  /** The review this screen just sent, until the service is asked again. */
  const [sent, setSent] = useState<RequestReview | null>(null);

  /**
   * ⚠️ The lock a second tap in the same frame cannot get past. `isSubmitting`
   * is state, and two presses before the next render both read it as false.
   */
  const inFlight = useRef(false);

  const { control, handleSubmit, watch } = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    // No stars chosen. A rating is the customer's to give, and a default would
    // be one given on their behalf.
    defaultValues: { rating: NO_RATING, comment: '' },
  });

  const comment = watch('comment');
  const commentRemaining = REVIEW_COMMENT_MAX_LENGTH - comment.length;

  const { refresh: refreshRequest } = details;
  const { refresh: refreshReview } = reviewQuery;
  const submitError = submission.error;

  /*
    Refused because the world moved: the request already has a review, stopped
    being reviewable, or is gone. Sending again would be refused again, so both
    records are read afresh and the screen draws whatever is now true — usually
    the review that already exists.
  */
  useEffect(() => {
    if (submitError?.kind === 'conflict' || submitError?.kind === 'notFound') {
      refreshRequest();
      refreshReview();
    }
  }, [submitError, refreshRequest, refreshReview]);

  const onSubmit = useCallback(
    async (values: ReviewForm) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;

      try {
        const accepted = await submission.submit(values);
        // A failure leaves the form exactly as it was; the button retries.
        if (accepted) {
          setSent(accepted);
        }
      } finally {
        inFlight.current = false;
      }
    },
    [submission],
  );

  const submit = handleSubmit(onSubmit);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const review = sent ?? reviewQuery.review;

  let body: ReactNode;

  if (details.isLoading || (request && reviewQuery.isLoading && !sent)) {
    body = <LoadingReview key="loading" />;
  } else if (details.error) {
    body = (
      <View key="error" style={styles.centred}>
        <ErrorState
          error={details.error}
          onRetry={details.retry}
          fullScreen={false}
          testID="request-review-error"
        />
      </View>
    );
  } else if (!request) {
    body = (
      <View key="missing" style={styles.centred}>
        <EmptyState
          title={COPY.notFoundTitle}
          message={COPY.notFoundMessage}
          icon="requests"
          actionLabel={COPY.back}
          onAction={goBack}
          fullScreen={false}
          testID="request-review-not-found"
        />
      </View>
    );
  } else if (reviewQuery.error && !sent) {
    body = (
      <View key="review-error" style={styles.centred}>
        <ErrorState
          error={reviewQuery.error}
          onRetry={reviewQuery.retry}
          fullScreen={false}
          testID="request-review-error"
        />
      </View>
    );
  } else {
    const availability = reviewAvailabilityOf(request.status, review);

    if (availability === 'checking') {
      // The request has arrived and its review lookup has not started yet — one
      // frame, but "cannot be reviewed" drawn in it would be a flash of a lie.
      body = <LoadingReview key="loading" />;
    } else if (availability === 'reviewed' && review) {
      body = (
        <View key="reviewed" style={{ gap: theme.spacing.lg }}>
          <ReviewedRequest request={request} />
          <ReadOnlyReview review={review} justSent={sent !== null} onBack={goBack} />
        </View>
      );
    } else if (availability === 'open') {
      body = (
        <View key="form" style={{ gap: theme.spacing.xxl }}>
          <ReviewedRequest request={request} />

          <Controller
            control={control}
            name="rating"
            render={({ field: { value, onChange }, fieldState: { error } }) => (
              <FormSection title={COPY.ratingTitle} support={COPY.ratingSupport}>
                <StarRating value={value} onChange={onChange} testID="request-review-rating" />
                {error ? (
                  <Text
                    variant="caption"
                    color="danger"
                    accessibilityLiveRegion="polite"
                    testID="request-review-rating-error">
                    {error.message}
                  </Text>
                ) : null}
              </FormSection>
            )}
          />

          <FormSection title={COPY.commentTitle} support={COPY.commentSupport}>
            <ControlledInput
              control={control}
              name="comment"
              label={COPY.commentLabel}
              placeholder={COPY.commentPlaceholder}
              multiline
              textAlignVertical="top"
              radiusToken="xl"
              // No `maxLength`, as on the notes box: the counter warns and the
              // schema explains, rather than keystrokes silently stopping.
              helperText={
                commentRemaining <= COMMENT_COUNTER_THRESHOLD ? String(commentRemaining) : undefined
              }
              testID="request-review-comment"
            />
          </FormSection>

          <View style={{ gap: theme.spacing.md }}>
            {/* The button below is the retry; a second one would say the same thing. */}
            {submission.error ? (
              <ErrorState
                error={submission.error}
                fullScreen={false}
                testID="request-review-submit-error"
              />
            ) : null}

            <PrimaryButton
              label={COPY.submit}
              onPress={submit}
              fullWidth
              isLoading={submission.isSubmitting}
              accessibilityHint={COPY.submitHint}
            />
          </View>
        </View>
      );
    } else {
      // Not completed or closed: nothing is offered.
      body = (
        <View key="unavailable" style={styles.centred}>
          <EmptyState
            title={COPY.unavailableTitle}
            message={COPY.unavailableMessage}
            icon="pending"
            actionLabel={COPY.backToRequest}
            onAction={goBack}
            fullScreen={false}
            testID="request-review-unavailable"
          />
        </View>
      );
    }
  }

  return (
    <Screen
      scrollable
      keyboardAvoiding
      header={
        <View
          style={[
            styles.bar,
            { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget },
          ]}>
          <BackButton
            onPress={navigation.goBack}
            accessibilityLabel={COPY.back}
            accessibilityHint={COPY.backHint}
            testID="request-review-back"
          />
        </View>
      }
      contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      testID="customer-request-review">
      <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xs }}>
        <Text variant="hero" accessibilityRole="header" testID="request-review-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    justifyContent: 'center',
  },
  centred: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  grow: {
    flex: 1,
  },
});
