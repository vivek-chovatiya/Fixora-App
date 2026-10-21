/**
 * VendorRequestDetailsScreen
 *
 * One request, opened (PROJECT_BIBLE.md section 32; Phase 3E-3), answered
 * (section 33; Phase 3E-4), and worked (sections 35 and 36; Phase 3E-5).
 *
 * It shows what the request is, who raised it, roughly where, how urgent it is,
 * how it reached this vendor and what the customer said. Straight under the
 * heading — on the first screen, so nobody scrolls to act — sits the one thing
 * the request is ready for:
 *
 * - waiting → "Your answer": Accept, or Reject after a confirmation;
 * - accepted → "Your work": Start work;
 * - in progress → "Your work": Mark completed, which opens the completion form
 *   (`CompleteWork`: the final amount and the offline payment record, sections
 *   36 and 37) and asks there before anything is sent;
 * - completed, rejected, or a status the app does not know → nothing. The
 *   status says where it stands (section 33: "never show actions that are
 *   invalid for the current status"). A rejected request — opened from the
 *   Rejected list, or just declined here — also says when it was declined.
 *
 * Completed work shows what the vendor recorded — the amount, paid or not and
 * how, their notes — under "Payment", with a line saying it is their record and
 * that Fixora does not process payments (section 37: recorded, never
 * processed). Work completed without a record shows no payment at all, never a
 * guess. There is still no way to call or message the customer and no
 * tracking.
 *
 * ⚠️ Completing happens on the form pushed over this screen, so this screen
 * cannot adopt the answer as it does for its own actions. Instead, when the
 * work changes while it is out of view (`VendorWorkSync`), it sets aside the
 * record it shows — known to be stale — and reads the request again, so the
 * vendor comes back to it completed, with its payment, or to wherever a
 * refused completion found it. Its own actions, taken while it is in view,
 * are adopted as before and cause no second read.
 *
 * ⚠️ The vendor stays here whatever an action comes to. Done, the service's
 * record replaces the one on screen — the new status, and the next step if
 * there is one, so Accept → Start work → Mark completed are all reached from
 * here, the last through its form and back — and a short confirmation is
 * shown. If the request moved on first (taken by
 * somebody else, already answered, already started or finished elsewhere),
 * that is said calmly and the request is read again: "not available" if it went
 * to somebody else, its real state otherwise. A failure leaves everything as it
 * was, ready to try again. Back is always there; nothing navigates on its own.
 *
 * ⚠️ Not the whole of section 32 either. The address, the photographs and the
 * preferred date and time are not on the contract yet — see
 * `VendorRequestDetails` for why the address in particular waits for a product
 * decision — and nothing is drawn in their place. An empty "Address" row would
 * read as a request with no address.
 *
 * The reference is all the route carries. Whose request it is comes from the
 * session, so a reference that is not this vendor's opens a screen that says it
 * is not available — calmly, because on open dispatch that is an ordinary thing
 * to happen (section 31.2), and with no retry, because trying again cannot
 * change the answer.
 */

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ProfileDetailRow } from '@/features/vendor/components/ProfileDetailRow';
import { RejectRequestDialog } from '@/features/vendor/components/RejectRequestDialog';
import { RequestAnswerActions } from '@/features/vendor/components/RequestAnswerActions';
import { RequestWorkAction } from '@/features/vendor/components/RequestWorkAction';
import {
  isAwaitingAnswer,
  isFinishedWork,
  nextWorkStep,
  presentJobStatus,
} from '@/features/vendor/constants/jobPresentation';
import { describePayment } from '@/features/vendor/constants/paymentPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  useVendorRequestDecision,
  type VendorDecisionOutcome,
} from '@/features/vendor/hooks/useVendorRequestDecision';
import { useVendorRequestDetails } from '@/features/vendor/hooks/useVendorRequestDetails';
import { useVendorWorkSync } from '@/features/vendor/state/VendorWorkSync';
import type { VendorStackParamList } from '@/navigation/types';
import {
  BackButton,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  Skeleton,
  StatusBadge,
  Text,
} from '@/shared/components';
import { formatMoney } from '@/shared/presentation/money';
import { formatRequestDate, presentPriority } from '@/shared/presentation/requestTokens';
import type {
  VendorCompletionRecord,
  VendorRequestAction,
  VendorRequestDetails,
  VendorWorkStep,
} from '@/shared/services/types/VendorRequestService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.requestDetails;
const ANSWER = VENDOR_COPY.answer;
const WORK = VENDOR_COPY.work;
const PAYMENT = VENDOR_COPY.payment;

/** Roughly the blocks the placeholders stand in for: heading, request, customer, description. */
const LOADING_BLOCK_HEIGHTS = [96, 188, 116, 120] as const;

type Props = NativeStackScreenProps<VendorStackParamList, 'VendorRequestDetails'>;

export function VendorRequestDetailsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { request, isLoading, error, isNotFound, retry, adopt, reconcile } =
    useVendorRequestDetails(route.params.requestId);
  const { answer, answering, isAnswering } = useVendorRequestDecision();
  const [isConfirmingReject, setIsConfirmingReject] = useState(false);

  /*
    Read again when the work changed while this screen was out of view — which
    is how a completion made on the form above it arrives. Whether the screen
    is in view is kept from the navigation events rather than read during
    render: on the way back, the completion's signal and the return can land in
    one render, and the navigator only says "focus" after it, so this check
    still sees the screen as away. It starts from whether the screen is focused
    when it mounts, not from "yes": a details screen restored underneath the
    form, never focused, gets no "blur" to say it is away.
  */
  const inView = useRef(navigation.isFocused());
  useEffect(() => {
    const offFocus = navigation.addListener('focus', () => {
      inView.current = true;
    });
    const offBlur = navigation.addListener('blur', () => {
      inView.current = false;
    });
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  const { revision } = useVendorWorkSync();
  const seenRevision = useRef(revision);
  useEffect(() => {
    if (seenRevision.current === revision) {
      return;
    }
    seenRevision.current = revision;
    // Its own actions happen in view and are adopted; only a change made elsewhere is read.
    if (!inView.current) {
      reconcile();
    }
  }, [reconcile, revision]);

  const settleOutcome = useCallback(
    (outcome: VendorDecisionOutcome) => {
      if (outcome.kind === 'answered') {
        adopt(outcome.request);
      } else if (outcome.kind === 'unavailable') {
        reconcile();
      }
    },
    [adopt, reconcile],
  );

  // The record on screen says how the request reached this vendor; section 54's
  // answer events carry it, and nothing is read to learn it.
  const accept = useCallback(
    (requestId: string) => {
      answer(requestId, 'accept', request?.dispatch).then(settleOutcome);
    },
    [answer, request, settleOutcome],
  );

  const askReject = useCallback(() => setIsConfirmingReject(true), []);
  const cancelReject = useCallback(() => setIsConfirmingReject(false), []);

  const confirmReject = useCallback(() => {
    if (!request) {
      return;
    }
    answer(request.id, 'reject', request.dispatch).then(outcome => {
      // A second press while the first is in the air is not an answer; the first one closes it.
      if (outcome.kind !== 'ignored') {
        setIsConfirmingReject(false);
        settleOutcome(outcome);
      }
    });
  }, [answer, request, settleOutcome]);

  // Starting is at once; completing opens the form that records the amount and payment.
  const step = useCallback(
    (requestId: string, which: VendorWorkStep) => {
      if (which === 'complete') {
        navigation.navigate('CompleteWork', { requestId });
        return;
      }
      answer(requestId, 'start').then(settleOutcome);
    },
    [answer, navigation, settleOutcome],
  );

  const workStep = request ? nextWorkStep(request) : null;

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
            testID="vendor-request-back"
          />
        </View>
      }
      contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      testID="vendor-request-details">
      {isLoading ? (
        <View
          style={{ gap: theme.spacing.lg }}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={COPY.loading}
          testID="vendor-request-loading">
          {LOADING_BLOCK_HEIGHTS.map((height, index) => (
            <Skeleton key={index} height={height} radiusToken="lg" />
          ))}
        </View>
      ) : request ? (
        <RequestBody
          request={request}
          action={
            isAwaitingAnswer(request) ? (
              <AnswerSection
                request={request}
                answering={answering}
                disabled={isAnswering}
                onAccept={accept}
                onReject={askReject}
              />
            ) : workStep ? (
              <WorkSection
                request={request}
                step={workStep}
                answering={answering}
                disabled={isAnswering}
                onStep={step}
              />
            ) : null
          }
        />
      ) : isNotFound ? (
        <EmptyState
          title={COPY.notFoundTitle}
          message={COPY.notFoundMessage}
          icon="help"
          fullScreen={false}
          testID="vendor-request-not-found"
        />
      ) : error ? (
        <ErrorState
          error={error}
          title={COPY.failedTitle}
          onRetry={retry}
          fullScreen={false}
          testID="vendor-request-error"
        />
      ) : null}

      <RejectRequestDialog
        visible={isConfirmingReject}
        isRejecting={answering === 'reject'}
        onCancel={cancelReject}
        onConfirm={confirmReject}
      />
    </Screen>
  );
}

interface AnswerSectionProps {
  request: VendorRequestDetails;
  answering: VendorRequestAction | null;
  disabled: boolean;
  onAccept: (requestId: string) => void;
  onReject: () => void;
}

/** "Your answer": what accepting means for this request, and the two buttons. */
function AnswerSection({ request, answering, disabled, onAccept, onReject }: AnswerSectionProps) {
  const theme = useTheme();

  // An open request is a race, and the vendor should know it before they answer (section 33.1).
  const prompt =
    request.dispatch === 'broadcast'
      ? ANSWER.promptBroadcast
      : request.dispatch === 'directed'
        ? ANSWER.promptDirected
        : ANSWER.prompt;

  return (
    <Card bordered shadow="sm" style={{ gap: theme.spacing.md }} testID="vendor-request-answer">
      <Text variant="overline" color="textTertiary" accessibilityRole="header">
        {ANSWER.section}
      </Text>
      <Text variant="body" color="textSecondary">
        {prompt}
      </Text>
      <RequestAnswerActions
        job={request}
        answering={answering}
        disabled={disabled}
        onAccept={onAccept}
        onReject={onReject}
        testID="vendor-request-answer-actions"
      />
    </Card>
  );
}

interface WorkSectionProps {
  request: VendorRequestDetails;
  step: VendorWorkStep;
  answering: VendorRequestAction | null;
  disabled: boolean;
  onStep: (requestId: string, step: VendorWorkStep) => void;
}

/** "Your work": when to take the next step, and its button. */
function WorkSection({ request, step, answering, disabled, onStep }: WorkSectionProps) {
  const theme = useTheme();

  return (
    <Card bordered shadow="sm" style={{ gap: theme.spacing.md }} testID="vendor-request-work">
      <Text variant="overline" color="textTertiary" accessibilityRole="header">
        {WORK.section}
      </Text>
      <Text variant="body" color="textSecondary">
        {step === 'start' ? WORK.promptStart : WORK.promptComplete}
      </Text>
      <RequestWorkAction
        job={request}
        step={step}
        answering={answering}
        disabled={disabled}
        onStep={onStep}
      />
    </Card>
  );
}

/**
 * "Payment": what the vendor recorded when they completed the job (sections 36
 * and 37) — the amount, paid or not and how, their notes — and a line saying
 * it is their record and that Fixora does not process payments.
 *
 * ⚠️ Every line only when the record has it. An amount that cannot be written
 * (not a whole number of minor units) is left out rather than shown wrong;
 * notes that are only space are no notes.
 */
function PaymentSection({ completion }: { completion: VendorCompletionRecord }) {
  const theme = useTheme();

  const amount = formatMoney(completion.finalAmountMinor, completion.currency);
  const notes = completion.notes?.trim() ? completion.notes : undefined;

  return (
    <Card bordered shadow="sm" style={{ gap: theme.spacing.md }} testID="vendor-request-payment">
      <Text variant="overline" color="textTertiary" accessibilityRole="header">
        {PAYMENT.section}
      </Text>
      {amount ? (
        <ProfileDetailRow
          label={PAYMENT.amountLabel}
          value={amount}
          testID="vendor-request-payment-amount"
        />
      ) : null}
      <ProfileDetailRow
        label={PAYMENT.statusLabel}
        value={describePayment(completion.paymentStatus, completion.paymentMethodLabel)}
        testID="vendor-request-payment-status"
      />
      {notes ? (
        <ProfileDetailRow
          label={PAYMENT.notesLabel}
          value={notes}
          testID="vendor-request-payment-notes"
        />
      ) : null}
      <Text variant="caption" color="textTertiary" testID="vendor-request-payment-recorded">
        {PAYMENT.recorded}
      </Text>
    </Card>
  );
}

function RequestBody({ request, action }: { request: VendorRequestDetails; action: ReactNode }) {
  const theme = useTheme();

  const status = presentJobStatus(request);
  const priority = presentPriority(request.priority);

  const origin =
    request.dispatch === 'directed'
      ? COPY.originDirected
      : request.dispatch === 'broadcast'
        ? COPY.originBroadcast
        : null;

  return (
    <>
      {/*
        The service, its status and its urgency, as one phrase for a screen
        reader. The words carry both; the tone and the glyphs only repeat them.
      */}
      <View
        style={{ gap: theme.spacing.md }}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${request.serviceName}. ${COPY.statusLabel}: ${status.label}. ${COPY.priorityLabel}: ${priority.label}`}
        testID="vendor-request-heading">
        <Text variant="h1" testID="vendor-request-service">
          {request.serviceName}
        </Text>

        <View
          style={[styles.badges, { gap: theme.spacing.md }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <StatusBadge
            label={status.label}
            tone={status.tone}
            icon={status.icon}
            testID="vendor-request-status"
          />
          <View style={[styles.row, { gap: theme.spacing.xs }]}>
            <Icon name={priority.icon} size="sm" color={priority.tone} />
            <Text variant="label" color={priority.tone} testID="vendor-request-priority">
              {priority.label}
            </Text>
          </View>
        </View>
      </View>

      {action}

      {/* Where the action would be: on finished work, what it came to is the first thing to see. */}
      {request.completion && isFinishedWork(request) ? (
        <PaymentSection completion={request.completion} />
      ) : null}

      <Card bordered shadow="sm" style={{ gap: theme.spacing.md }} testID="vendor-request-summary">
        <Text variant="overline" color="textTertiary" accessibilityRole="header">
          {COPY.requestSection}
        </Text>
        <ProfileDetailRow
          label={COPY.referenceLabel}
          value={request.id}
          testID="vendor-request-reference"
        />
        {request.categoryName ? (
          <ProfileDetailRow label={COPY.categoryLabel} value={request.categoryName} />
        ) : null}
        <ProfileDetailRow label={COPY.serviceLabel} value={request.serviceName} />
        <ProfileDetailRow
          label={COPY.raisedLabel}
          value={formatRequestDate(request.createdAt)}
          testID="vendor-request-raised"
        />
        {request.completedAt ? (
          <ProfileDetailRow
            label={COPY.completedLabel}
            value={formatRequestDate(request.completedAt)}
            testID="vendor-request-completed"
          />
        ) : null}
        {/* A request this vendor declined, dated as their Rejected list dates it (2026-10-21). */}
        {request.rejectedAt ? (
          <ProfileDetailRow
            label={COPY.rejectedLabel}
            value={formatRequestDate(request.rejectedAt)}
            testID="vendor-request-rejected"
          />
        ) : null}
        {origin ? (
          <ProfileDetailRow label={COPY.originLabel} value={origin} testID="vendor-request-origin" />
        ) : null}
      </Card>

      <Card bordered shadow="sm" style={{ gap: theme.spacing.md }} testID="vendor-request-customer">
        <Text variant="overline" color="textTertiary" accessibilityRole="header">
          {COPY.customerSection}
        </Text>
        <ProfileDetailRow label={COPY.customerLabel} value={request.customerName} />
        {request.locality ? (
          <ProfileDetailRow label={COPY.localityLabel} value={request.locality} />
        ) : null}
      </Card>

      <Card
        bordered
        shadow="sm"
        style={{ gap: theme.spacing.md }}
        testID="vendor-request-description">
        <Text variant="overline" color="textTertiary" accessibilityRole="header">
          {COPY.descriptionSection}
        </Text>
        <Text variant="body" color={request.description ? 'textPrimary' : 'textTertiary'}>
          {request.description ?? COPY.descriptionMissing}
        </Text>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
