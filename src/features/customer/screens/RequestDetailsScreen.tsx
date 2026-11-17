/**
 * RequestDetailsScreen
 *
 * One request, as it stands (PROJECT_BIBLE.md section 20).
 *
 * ⚠️ It reads the request from `RequestService` and from nowhere else. It is
 * opened from the success screen moments after sending and from Home's recent
 * list days later, and both must show the same record — so it holds no draft,
 * reads no submission record and is handed nothing but a reference. The draft
 * was a request being written; this is the request that was sent, and a screen
 * that mixed the two would end up describing what somebody meant to send rather
 * than what the backend has.
 *
 * ⚠️ The record is read-only in every status. Every group the confirmation
 * summary let a customer correct is drawn here with no Edit control, and there is
 * no Reschedule, Contact or Track: the backend moves a request through section
 * 21, never this screen (section 34; see "Customer actions" in
 * docs/WORKING_NOTES.md). What it offers in every status changes nothing — Back,
 * copying the reference, and pulling to read the request again — which is why
 * none of it waits on the status, not even one the app does not recognise. A
 * control for something that cannot be carried out would be worse than none.
 *
 * ⚠️ One operation on the request itself: Cancel request, and only while no
 * professional has accepted it (owner decision, 21/10/2026;
 * `isCancellableState`). It sits beneath the content, asks first (section 46:
 * confirm destructive actions), sends once however fast it is confirmed, and
 * shows only what the service answers: the cancelled record it returns, or — if
 * a professional accepted it first — a calm word and the request read again. A
 * failure changes nothing and leaves Cancel there to try again. It cannot be
 * pressed while the request is being read again, so the record it changes is
 * the one on screen.
 *
 * Section 24's review is the other action, and it is not an operation on the
 * request: a completed or closed request offers to be rated, and once rated
 * shows the review read-only. The review lives in `ReviewService`, and sending
 * one leaves this record exactly as it was. Whether it is offered is
 * `reviewAvailabilityOf`'s decision. The two never meet: one is for a request
 * nobody has taken, the other for one that is finished.
 *
 * A finished request also shows the payment its professional recorded when
 * they completed it (sections 36 and 37) — the amount, paid or not and how —
 * read-only, and said to be their record: Fixora does not process payments.
 * A finished request with no record shows no payment group at all.
 *
 * It says what the record says. The status card derives the customer's stage
 * from the backend's status and whether they chose a professional
 * (`requestStatus.ts`), and draws only the steps that have happened as complete.
 * The professional group keeps who was asked for apart from who has the job, and
 * draws the second only when the stage is assigned or later — so a directed
 * request nobody has accepted never reads as accepted, whatever else the record
 * carries. Nothing here is tracking: no map, no live updates, no estimate of
 * anyone arriving.
 *
 * Four states, each with a way out. Loading keeps the shape of the page. A
 * failure offers a retry and Home. A reference that matches nothing is not a
 * failure, and offers only Home — retrying it would be offering to fail again.
 */

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RequestReference } from '@/features/customer/components/RequestReference';
import { RequestReviewSummary } from '@/features/customer/components/RequestReviewSummary';
import { RequestStatusOverview } from '@/features/customer/components/RequestStatusOverview';
import {
  RequestSummaryBlock,
  RequestSummaryLine,
  RequestSummaryRow,
  RequestSummarySection,
} from '@/features/customer/components/RequestSummary';
import { Skeleton } from '@/features/customer/components/Skeleton';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { formatRequestDate, presentPriority } from '@/features/customer/constants/requestPresentation';
import {
  isReviewableStatus,
  reviewAvailabilityOf,
} from '@/features/customer/constants/requestReview';
import {
  hasAssignedProfessional,
  isCancellableState,
  requestStateOf,
  type RequestDispatch,
} from '@/features/customer/constants/requestStatus';
import { formatDateValue, formatTimeValue } from '@/features/customer/constants/requestScheduling';
import { useCancelRequest } from '@/features/customer/hooks/useCancelRequest';
import { useRequestDetails } from '@/features/customer/hooks/useRequestDetails';
import {
  useRequestReview,
  type RequestReviewQuery,
} from '@/features/customer/hooks/useRequestReview';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  RequestPhotoStrip,
  Screen,
  Text,
} from '@/shared/components';
import { formatMoney } from '@/shared/presentation/money';
import { describePayment } from '@/shared/presentation/payment';
import type {
  CustomerPaymentRecord,
  CustomerRequestDetails,
} from '@/shared/services/types/RequestService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.requestDetails;
/** Sections 36 and 37: what the professional recorded, read back. */
const PAYMENT = CUSTOMER_COPY.payment;
/** The read-back wording shared with the confirmation summary. */
const SUMMARY = CUSTOMER_COPY.confirmation;
/** Section 24's wording, shared with the review screen. */
const REVIEW = CUSTOMER_COPY.review;
/** Cancelling a request nobody has accepted (owner decision, 21/10/2026). */
const CANCEL = CUSTOMER_COPY.cancelRequest;

/**
 * Roughly the groups the placeholders stand in for, top to bottom: status and
 * reference, service, details, location. Close enough that the page does not
 * jump when the record lands, without pretending to know how long the notes are.
 */
const LOADING_BLOCK_HEIGHTS = [176, 88, 132, 72] as const;

type Props = NativeStackScreenProps<CustomerStackParamList, 'RequestDetails'>;

/** While the record is on its way: the page's shape, announced once. */
function LoadingRecord() {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      // Label and busy state together and from the first render — a progress
      // node with state and no name is announced as the bare word "busy".
      accessibilityLabel={COPY.loadingLabel}
      accessibilityState={{ busy: true }}
      style={{ gap: theme.spacing.lg }}
      testID="request-details-loading">
      {LOADING_BLOCK_HEIGHTS.map((height, index) => (
        <Skeleton key={index} height={height} radiusToken="lg" />
      ))}
    </View>
  );
}

/**
 * Where the request has got to, and what to quote about it.
 *
 * Status leads the page because it is the one thing that changes. The overview
 * says it in words and a glyph, explains it in one sentence, and shows the path
 * with only what has happened marked complete (section 46: never tint alone).
 */
function StatusSummary({
  request,
  dispatch,
}: {
  request: CustomerRequestDetails;
  dispatch: RequestDispatch;
}) {
  const theme = useTheme();

  const reference = request.id.trim();

  return (
    <Card
      bordered
      shadow="sm"
      style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
      testID="request-details-summary">
      <RequestStatusOverview
        status={request.status}
        dispatch={dispatch}
        testID="request-details-status"
      />

      {/*
        Only when the record has one. A request always should, but a reference
        drawn as an empty field reads as one that failed to load, and one filled
        in by the app would be a number nobody at Fixora has heard of.
      */}
      {reference ? (
        <View
          style={{
            paddingTop: theme.spacing.lg,
            borderTopWidth: theme.borderWidth.hairline,
            borderTopColor: theme.colors.border,
          }}>
          <RequestReference reference={reference} testID="request-details-reference" />
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Section 24's review, for a request that can have one — and nothing at all for
 * one that cannot.
 *
 * ⚠️ Whether to draw it is `reviewAvailabilityOf`'s decision, never a status
 * compared here. A request still under way, cancelled, rejected, on hold or in a
 * status the app does not know gets no group, no prompt and no button.
 *
 * Deliberately quiet. The status card is the page's subject; this is a group
 * like the others below it, and its action is a secondary button. Once there is
 * a review the prompt gives way to the review itself, read-only: section 24 has
 * one review per request, so nothing here offers another.
 */
function ReviewSection({
  request,
  review,
  onReview,
}: {
  request: CustomerRequestDetails;
  review: RequestReviewQuery;
  onReview: () => void;
}) {
  const theme = useTheme();

  const availability = reviewAvailabilityOf(request.status, review.review);

  if (availability === 'unavailable') {
    return null;
  }

  let content: ReactNode;

  if (availability === 'reviewed' && review.review) {
    content = <RequestReviewSummary review={review.review} testID="request-details-review-summary" />;
  } else if (review.error) {
    /*
      Not knowing is not the same as not reviewed. Offering the button here
      would invite a second review of a request that may already have one — the
      service would refuse it, but the customer would have been asked for
      nothing. So the group says it could not check, and retries the check.
    */
    content = (
      <ErrorState
        error={review.error}
        title={REVIEW.detailsFailedTitle}
        onRetry={review.retry}
        fullScreen={false}
        testID="request-details-review-error"
      />
    );
  } else if (availability === 'checking') {
    // Drawn by the loading region below, not as content.
    content = null;
  } else {
    content = (
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="body" color="textSecondary">
          {REVIEW.detailsPrompt}
        </Text>
        <Button
          label={REVIEW.detailsAction}
          variant="secondary"
          icon="starOutline"
          onPress={onReview}
          fullWidth
          accessibilityHint={REVIEW.detailsActionHint}
        />
      </View>
    );
  }

  /*
    ⚠️ Two regions, never one updated into the other — the keyed loading
    region every list has had since 3G-3. While the review is being checked, a
    region named for it and busy; once it has answered — the review, the
    prompt or the failure — a plain container with no name, role or state of
    its own, under the group's heading, which already names it. They carry
    different keys, and that is the fix, not a detail: the checking view and
    the prompt were both a plain View in the same place, so React updated the
    one into the other, and Android does not unset a prop that merely
    disappears — the prompt could keep `busy` (the exposure Home's regions had,
    3D-10). The `progressbar` role went with it, as it did on the lists.
  */
  const isChecking = !review.error && availability === 'checking';

  return (
    <RequestSummarySection title={REVIEW.yourReviewTitle} testID="request-details-review">
      {isChecking ? (
        <View
          key="loading"
          accessibilityLabel={REVIEW.loadingLabel}
          accessibilityState={{ busy: true }}
          testID="request-details-review-loading">
          <Skeleton height={theme.hitSlop.minTarget} radiusToken="lg" />
        </View>
      ) : (
        <View key="settled" testID="request-details-review-settled">
          {content}
        </View>
      )}
    </RequestSummarySection>
  );
}

/**
 * What the professional recorded about payment when they completed the job
 * (sections 36 and 37): the amount, and paid or not — and how, when paid.
 *
 * ⚠️ Recorded, never processed. The last line says whose record it is and that
 * Fixora does not process payments, so nothing here reads as a receipt from
 * Fixora. Drawn only for a finished request that has a record (the caller's
 * check); an amount that cannot be written is left out rather than shown
 * wrong.
 */
function PaymentSection({ payment }: { payment: CustomerPaymentRecord }) {
  const amount = formatMoney(payment.finalAmountMinor, payment.currency);

  return (
    <RequestSummarySection title={PAYMENT.section} testID="request-details-payment">
      {amount ? (
        <RequestSummaryRow label={PAYMENT.amountLabel} value={amount} testID="details-payment-amount" />
      ) : null}
      <RequestSummaryRow
        label={PAYMENT.statusLabel}
        value={describePayment(payment.paymentStatus, payment.paymentMethodLabel)}
        testID="details-payment-status"
      />
      <Text variant="caption" color="textTertiary" testID="details-payment-recorded">
        {PAYMENT.recorded}
      </Text>
    </RequestSummarySection>
  );
}

/** The record itself, group by group, in the order the request was asked. */
function RequestRecord({
  request,
  review,
  onReview,
  onCancel,
  isCancelDisabled,
}: {
  request: CustomerRequestDetails;
  review: RequestReviewQuery;
  onReview: () => void;
  /** Opens the confirmation; drawn only while nobody has accepted the request. */
  onCancel: () => void;
  /** The record is being read again, or a cancellation is already out. */
  isCancelDisabled: boolean;
}) {
  const theme = useTheme();

  const priority = presentPriority(request.priority);
  const sent = formatRequestDate(request.createdAt);

  // Blank is treated as absent throughout, so a field the backend sent empty
  // is never drawn as a label with nothing after it.
  const service = request.serviceName.trim() || SUMMARY.serviceFallback;
  const category = request.categoryName?.trim();
  const notes = request.notes?.trim() ? request.notes : undefined;
  const photos = request.imageUrls ?? [];

  /*
    Who was asked for — which is always an answer, because open dispatch is one.

    The preference is read from its own field and never inferred from status or
    assignment: section 21 is explicit that dispatch is routing, not a state.
  */
  const requested = request.preferredVendor
    ? request.preferredVendor.name.trim() || SUMMARY.vendorUnknown
    : SUMMARY.vendorOpen;

  /*
    Who has the job — only once the status says somebody does.

    A name on the record is not enough on its own: a backend can carry a vendor
    against a request that has not been accepted, and drawing it then would tell
    the customer something the status contradicts.
  */
  const dispatch: RequestDispatch = request.preferredVendor ? 'directed' : 'open';
  const stage = requestStateOf(request.status, dispatch);
  const assigned = hasAssignedProfessional(stage) ? request.vendorName?.trim() : undefined;

  // Only once the work is finished: a payment on a request still under way would contradict its status.
  const payment = stage === 'completed' ? request.payment : undefined;

  return (
    <View style={{ gap: theme.spacing.lg }} testID="request-details-record">
      <StatusSummary request={request} dispatch={dispatch} />

      <RequestSummarySection title={SUMMARY.sectionService} testID="request-details-service">
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={
            category
              ? `${SUMMARY.serviceLabel}: ${service}, ${SUMMARY.categoryLabel}: ${category}`
              : `${SUMMARY.serviceLabel}: ${service}`
          }
          style={{ gap: theme.spacing.xxs }}>
          <Text variant="h3" testID="details-service">
            {service}
          </Text>
          {category ? (
            <Text variant="caption" color="textSecondary" testID="details-category">
              {category}
            </Text>
          ) : null}
        </View>
      </RequestSummarySection>

      <RequestSummarySection title={SUMMARY.sectionDetails} testID="request-details-details">
        <RequestSummaryRow
          label={SUMMARY.priorityLabel}
          value={priority.label}
          badge={priority}
          testID="details-priority"
        />
        {/*
          Read back the way it was chosen, never the way it is stored: the record
          holds 2026-09-11 and 18:00, which are the contract's formats and
          nobody's idea of a date.
        */}
        {request.preferredDate ? (
          <RequestSummaryRow
            label={SUMMARY.dateLabel}
            value={formatDateValue(request.preferredDate, CUSTOMER_COPY.createRequest)}
            testID="details-date"
          />
        ) : null}
        {request.preferredTime ? (
          <RequestSummaryRow
            label={SUMMARY.timeLabel}
            value={formatTimeValue(request.preferredTime)}
            testID="details-time"
          />
        ) : null}
        {sent ? <RequestSummaryRow label={COPY.sentLabel} value={sent} testID="details-sent" /> : null}
      </RequestSummarySection>

      {/*
        The address as a person wrote it or chose it. The coordinates and the
        provider's handle behind it are never drawn — this is not a map, and a
        record printing 12.9716 is a record showing its working.
      */}
      <RequestSummarySection title={SUMMARY.sectionLocation} testID="request-details-location">
        <RequestSummaryLine
          icon="location"
          label={SUMMARY.addressLabel}
          value={request.address.formattedAddress}
          testID="details-address"
        />
      </RequestSummarySection>

      <RequestSummarySection title={COPY.sectionVendor} testID="request-details-professional">
        <RequestSummaryRow label={COPY.requestedLabel} value={requested} testID="details-vendor" />
        {assigned ? (
          <RequestSummaryRow
            label={COPY.assignedLabel}
            value={assigned}
            testID="details-assigned"
          />
        ) : null}
      </RequestSummarySection>

      {/*
        Drawn only when there is something in it. The confirmation summary keeps
        an empty group so a customer who forgot a note can see the gap and fix
        it; here there is nothing to fix, and an empty card would only say so.
      */}
      {notes || photos.length > 0 ? (
        <RequestSummarySection title={SUMMARY.sectionExtras} testID="request-details-extras">
          {notes ? (
            <RequestSummaryBlock label={SUMMARY.notesLabel} value={notes} testID="details-notes" />
          ) : null}
          {photos.length > 0 ? (
            <RequestPhotoStrip urls={photos} copy={SUMMARY} testID="details-photos" />
          ) : null}
        </RequestSummarySection>
      ) : null}

      {payment ? <PaymentSection payment={payment} /> : null}

      {/* Last: it is about the request once it is over, not part of it. */}
      <ReviewSection request={request} review={review} onReview={onReview} />

      {/*
        Beneath everything, where it is found by somebody looking for it rather
        than met by somebody reading the request. The red marks it as the one
        control here that ends something; the dialog it opens is what protects
        it (section 46), so this is the quiet red tint and the dialog's own
        Cancel request is the filled one (3G-4). Only before acceptance —
        `isCancellableState` decides, never a status compared here — so it
        never meets the review.
      */}
      {isCancellableState(stage) ? (
        <Button
          label={CANCEL.action}
          variant="dangerSecondary"
          icon="cancelled"
          onPress={onCancel}
          disabled={isCancelDisabled}
          fullWidth
          accessibilityHint={CANCEL.actionHint}
        />
      ) : null}
    </View>
  );
}

export function RequestDetailsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { requestId } = route.params;

  const { request, isLoading, error, retry, refresh, isRefreshing, adopt, reconcile } =
    useRequestDetails(requestId);

  /*
    Asked only of a request that could have a review, so one still under way
    costs no lookup at all.
  */
  const reviewable = request ? isReviewableStatus(request.status) : false;
  const review = useRequestReview(requestId, reviewable);
  const { refresh: refreshReview } = review;

  /*
    Read again whenever the customer comes back to this screen — which, after a
    review, is how they arrive: the review screen pops back here, and the prompt
    must give way to the review they just sent. Only the review is re-read; the
    request has not changed, since sending a review never changes it.
  */
  const reviewableRef = useRef(reviewable);
  reviewableRef.current = reviewable;

  useEffect(
    () =>
      navigation.addListener('focus', () => {
        if (reviewableRef.current) {
          refreshReview();
        }
      }),
    [navigation, refreshReview],
  );

  const openReview = useCallback(() => {
    navigation.navigate('RequestReview', { requestId });
  }, [navigation, requestId]);

  /*
    Cancelling: asked first, sent once, and settled from the service's answer.

    The hook's guard is what makes it once — a second confirm landing in the
    same frame finds it taken and is ignored, and the dialog stays for the first
    one's answer to close it. Every real answer closes the dialog: the
    cancelled record is adopted; a refusal, or a request the service no longer
    knows, means the record on screen is wrong, so it is read again; any other
    failure changes nothing and leaves Cancel where it was.
  */
  const { cancel, isCancelling } = useCancelRequest();
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  /*
    Whether the screen is still there when the answer lands. The dialog holds
    the customer here while it is out, but the session can still end under it,
    and a re-read started for a screen that has gone would be a call nobody
    sees. The toast and the lists' signal are the hook's and still happen.
  */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const askToCancel = useCallback(() => setIsConfirmingCancel(true), []);
  const keepRequest = useCallback(() => setIsConfirmingCancel(false), []);

  const confirmCancel = useCallback(() => {
    cancel(requestId).then(outcome => {
      if (outcome.kind === 'ignored' || !mounted.current) {
        return;
      }
      setIsConfirmingCancel(false);

      if (outcome.kind === 'cancelled') {
        adopt(outcome.request);
      } else if (outcome.kind === 'refused' || outcome.error.kind === 'notFound') {
        reconcile();
      }
    });
  }, [cancel, requestId, adopt, reconcile]);

  // A pull reads both, so a review sent from elsewhere shows up too.
  const refreshAll = useCallback(() => {
    refresh();
    if (reviewableRef.current) {
      refreshReview();
    }
  }, [refresh, refreshReview]);

  /*
    Home by name, rather than `popToTop`.

    This screen is reached from more than one place, and the tab underneath is
    not necessarily Home. Navigating to the tabs route returns to the instance
    already in the stack and selects Home on it, whichever way the customer came.
  */
  const goHome = useCallback(() => {
    navigation.navigate('CustomerTabs', { screen: 'Home' });
  }, [navigation]);

  /*
    Each state is keyed so it replaces the one before rather than updating it.

    Found on the recent-requests list: a native view that was a progress
    indicator and is then reused for content keeps its busy state, because a prop
    that becomes undefined is not an instruction to unset it. Distinct keys make
    React unmount the placeholder instead of recycling it.
  */
  let body: ReactNode;

  if (isLoading) {
    body = <LoadingRecord key="loading" />;
  } else if (error) {
    body = (
      <View key="error" style={[styles.centred, { gap: theme.spacing.md }]}>
        {/*
          The retry is the service read again — nothing here can raise a
          request, so pressing it any number of times is safe. It is only
          offered for failures worth retrying; Home is offered for every one.
        */}
        <ErrorState error={error} onRetry={retry} fullScreen={false} testID="request-details-error" />
        <Button
          label={COPY.home}
          variant="secondary"
          onPress={goHome}
          accessibilityHint={COPY.homeHint}
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
          actionLabel={COPY.home}
          onAction={goHome}
          fullScreen={false}
          testID="request-details-not-found"
        />
      </View>
    );
  } else {
    body = (
      <RequestRecord
        key="record"
        request={request}
        review={review}
        onReview={openReview}
        onCancel={askToCancel}
        /*
          Not while the record is being read again: the answer could already
          say a professional has it, and a cancellation sent meanwhile would be
          a change to a record this screen is about to replace.
        */
        isCancelDisabled={isRefreshing || isCancelling}
      />
    );
  }

  return (
    <Screen
      scrollable
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
            testID="request-details-back"
          />
        </View>
      }
      // Only once there is a record to refresh. Pulling on a failure or a
      // missing request would be a second, hidden retry beside the visible one.
      onRefresh={request ? refreshAll : undefined}
      isRefreshing={isRefreshing}
      contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      testID="customer-request-details">
      {/*
        The same heading in every state, so the screen is named before anything
        has loaded and still named when nothing could be.
      */}
      <Text variant="hero" accessibilityRole="header" testID="request-details-heading">
        {COPY.title}
      </Text>

      {body}

      {/*
        "Keep request" is the way out; Cancel request is the danger button and
        shows busy while it is sent, when nothing dismisses the dialog — the
        shared dialog's rules (3D-7). Stacked, because side by side at 360dp
        each label would have about 86dp for its words, less than either "Keep
        request" or "Cancel request" needs at button size — and stacked, the
        dialog puts Cancel request on top and Keep request at the bottom,
        nearest the thumb (ConfirmDialog, 21/10/2026).
      */}
      <ConfirmDialog
        stacked
        visible={isConfirmingCancel}
        title={CANCEL.confirmTitle}
        message={CANCEL.confirmMessage}
        cancelLabel={CANCEL.keep}
        cancelHint={CANCEL.keepHint}
        confirmLabel={CANCEL.confirm}
        confirmHint={CANCEL.confirmHint}
        onCancel={keepRequest}
        onConfirm={confirmCancel}
        isConfirming={isCancelling}
        testID="request-details-cancel-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    justifyContent: 'center',
  },
  centred: {
    // Fills what the heading leaves, so a failure sits in the middle of the
    // page rather than wedged under the title.
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
