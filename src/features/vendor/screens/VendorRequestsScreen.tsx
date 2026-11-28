/**
 * VendorRequestsScreen
 *
 * The vendor's requests (PROJECT_BIBLE.md section 31; Phase 3E-3): everything
 * waiting for them, under way and done, with a filter to narrow it and each
 * card opening its request.
 *
 * ⚠️ A card offers the one thing its request is ready for, beside the card's
 * open button and never inside it, so a tap on it acts and opens nothing:
 *
 * - waiting → Accept at once, Reject after a confirmation (section 33, 3E-4);
 * - accepted → Start work, at once (section 35, 3E-5);
 * - in progress → Mark completed, which opens the completion form — the final
 *   amount and the offline payment record (sections 36 and 37) — where it is
 *   confirmed and sent;
 * - anything else — finished, declined, or a status the app does not know →
 *   nothing.
 *
 * No contact, no tracking, and payment only ever recorded on that form, never
 * processed. Pressing the rest of the card opens the request exactly as before.
 *
 * ⚠️ What the vendor declined is kept under its own Rejected filter (section
 * 31; owner decision, 2026-10-21) and is read-only there: a card in that group
 * opens its request and is offered nothing, whatever its status says. All
 * leaves it out — `requestFilters.ts` says why.
 *
 * ⚠️ An action moves its card when the service confirms it, and not before:
 * accepted goes from Pending to Active, rejected from Pending to the top of
 * Rejected, started changes in place. A completion is sent from the form above
 * this list, so it arrives as the work-changed signal and the list reads itself
 * again (`useVendorRequests`): the job is at the top of Completed by the time
 * the vendor is back. A refusal to an
 * answer (taken, or already answered) takes the card out of Pending; a refusal
 * to a step (the job had already moved on) leaves it be. Either way the list is
 * read again to show where the request really is. A failure leaves the card
 * exactly where it was, its button ready to try again. One action at a time,
 * across the whole list.
 *
 * ⚠️ The filter is a view. The service returns the groups it sorted itself
 * and the chips choose which to draw (`requestFilters.ts` says exactly what each
 * means); selecting one asks the service for nothing, so it is instant and
 * cannot fail.
 *
 * One list, and it owns the scrolling: the heading, the chips and any notice
 * are its header, so there is nothing nested to fight over a drag. The chips'
 * own row scrolls sideways only (T134), across the list's grain, so a drag is
 * still never ambiguous. Placeholders
 * fill it while the first load runs; a failed first load puts the failure and
 * its retry where the requests would be; a failed pull keeps the list and says
 * above it that it may be out of date (section 31.2).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { JobPreviewCard } from '@/features/vendor/components/JobPreviewCard';
import { RejectRequestDialog } from '@/features/vendor/components/RejectRequestDialog';
import { RequestAnswerActions } from '@/features/vendor/components/RequestAnswerActions';
import { RequestWorkAction } from '@/features/vendor/components/RequestWorkAction';
import { isAwaitingAnswer, nextWorkStep } from '@/features/vendor/constants/jobPresentation';
import {
  VENDOR_REQUEST_EMPTY,
  VENDOR_REQUEST_FILTERS,
  vendorRequestLinesFor,
  type VendorRequestFilter,
  type VendorRequestLine,
} from '@/features/vendor/constants/requestFilters';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  useVendorRequestDecision,
  type VendorDecisionOutcome,
  type VendorReferenceAction,
} from '@/features/vendor/hooks/useVendorRequestDecision';
import { useVendorRequests } from '@/features/vendor/hooks/useVendorRequests';
import type { VendorStackParamList, VendorTabParamList } from '@/navigation/types';
import type { VendorWorkStep } from '@/shared/services/types/VendorRequestService';
import {
  EmptyState,
  ErrorState,
  Screen,
  SelectionChipRail,
  Skeleton,
  StaleNotice,
  Text,
} from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.requests;

/** Roughly a card, so nothing jumps as the real ones arrive. */
const CARD_HEIGHT = 168;
/** Enough to fill a phone without pretending to know how many will come back. */
const PLACEHOLDER_COUNT = 4;

/** The tab bar clears the home indicator itself. */
const TOP_EDGE_ONLY = ['top'] as const;

type Props = CompositeScreenProps<
  BottomTabScreenProps<VendorTabParamList, 'Requests'>,
  NativeStackScreenProps<VendorStackParamList>
>;

/** One identity for "nothing to list", so the list is not handed a new array every render. */
const NO_LINES: readonly VendorRequestLine[] = Object.freeze([]);

/** Each filter chip's id, as the chips had before they moved onto the rail. */
const filterTestID = (value: VendorRequestFilter) => `vendor-requests-filter-${value}`;

export function VendorRequestsScreen({ navigation }: Props) {
  const theme = useTheme();
  const [filter, setFilter] = useState<VendorRequestFilter>('all');
  const { list, isLoading, error, retry, refresh, isRefreshing, isStale, staleError, settle } =
    useVendorRequests();
  const { answer, answeringId, answering, isAnswering } = useVendorRequestDecision();

  /** The request whose rejection is being confirmed. */
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  /*
    What the service confirmed, shown on the list at once; anything else changes
    nothing here. Only the actions taken on this list settle: a completion is
    sent from its form and reaches the list as a re-read.
  */
  const settleOutcome = useCallback(
    (requestId: string, action: VendorReferenceAction, outcome: VendorDecisionOutcome) => {
      if (outcome.kind === 'answered') {
        if (action === 'reject') {
          // Out of Pending, into the vendor's history of what they declined.
          settle(requestId, { group: 'rejected', request: outcome.request });
        } else {
          // Accepted or started: either way, under way.
          settle(requestId, { group: 'active', request: outcome.request });
        }
      } else if (outcome.kind === 'unavailable' && (action === 'accept' || action === 'reject')) {
        // No longer this vendor's to answer: out of Pending until the re-read says where it went.
        settle(requestId, null);
      }
      // A step refused because the job had moved on stays as it is until the re-read.
    },
    [settle],
  );

  /*
    How a waiting request reached this vendor, read off the card being answered
    — for section 54's accept and reject events and nothing else. The list
    already on screen has it; nothing is read to learn it (section 54: analytics
    must not interfere).
  */
  const dispatchOf = useCallback(
    (requestId: string) => list?.pending.find(job => job.id === requestId)?.dispatch,
    [list],
  );

  const accept = useCallback(
    (requestId: string) => {
      answer(requestId, 'accept', dispatchOf(requestId)).then(outcome =>
        settleOutcome(requestId, 'accept', outcome),
      );
    },
    [answer, dispatchOf, settleOutcome],
  );

  // Starting is at once; completing opens the form that records the amount and payment.
  const step = useCallback(
    (requestId: string, which: VendorWorkStep) => {
      if (which === 'complete') {
        navigation.navigate('CompleteWork', { requestId });
        return;
      }
      answer(requestId, 'start').then(outcome => settleOutcome(requestId, 'start', outcome));
    },
    [answer, navigation, settleOutcome],
  );

  const askReject = useCallback((requestId: string) => setRejectingId(requestId), []);
  const cancelReject = useCallback(() => setRejectingId(null), []);

  const confirmReject = useCallback(() => {
    if (rejectingId === null) {
      return;
    }
    answer(rejectingId, 'reject', dispatchOf(rejectingId)).then(outcome => {
      // A second press while the first is in the air is not an answer; the first one closes it.
      if (outcome.kind !== 'ignored') {
        setRejectingId(null);
        settleOutcome(rejectingId, 'reject', outcome);
      }
    });
  }, [answer, dispatchOf, rejectingId, settleOutcome]);

  // The reference and nothing else: the details screen reads the record itself.
  const openRequest = useCallback(
    (requestId: string) => {
      navigation.navigate('VendorRequestDetails', { requestId });
    },
    [navigation],
  );

  // Nothing listed while the first load runs: the placeholders are the loading
  // region's, in the empty slot below, not lines of the list.
  const lines = useMemo<readonly VendorRequestLine[]>(() => {
    if (isLoading || !list) {
      return NO_LINES;
    }

    return vendorRequestLinesFor(list, filter);
  }, [filter, isLoading, list]);

  const renderLine = useCallback(
    ({ item }: ListRenderItemInfo<VendorRequestLine>) => {
      if (item.kind === 'heading') {
        return (
          <View
            style={[styles.groupHeading, { gap: theme.spacing.sm, paddingTop: theme.spacing.sm }]}
            accessible
            accessibilityRole="header"
            accessibilityLabel={COPY.groupSpoken(item.title, item.count)}
            testID={`vendor-requests-group-${item.group}`}>
            <Text variant="h3">{item.title}</Text>
            <Text variant="body" color="textTertiary">
              {String(item.count)}
            </Text>
          </View>
        );
      }

      /*
        Only what is waiting, and only what its status says is waiting; only
        work under way, and only the step its status is ready for. Read off the
        group first, so a declined request — history — is never offered
        anything, whatever status the backend gave it.
      */
      const answerable = item.group === 'pending' && isAwaitingAnswer(item.job);
      const workStep = item.group === 'active' ? nextWorkStep(item.job) : null;
      const inAir = answeringId === item.job.id ? answering : null;

      let actions: React.ReactNode;
      if (answerable) {
        actions = (
          <RequestAnswerActions
            job={item.job}
            answering={inAir}
            disabled={isAnswering}
            onAccept={accept}
            onReject={askReject}
            testID={`vendor-request-${item.job.id}-answer`}
          />
        );
      } else if (workStep) {
        actions = (
          <RequestWorkAction
            job={item.job}
            step={workStep}
            answering={inAir}
            disabled={isAnswering}
            onStep={step}
          />
        );
      }

      return (
        <JobPreviewCard
          job={item.job}
          onPress={openRequest}
          actions={actions}
          testID={`vendor-request-${item.job.id}`}
        />
      );
    },
    [accept, answering, answeringId, askReject, isAnswering, openRequest, step, theme.spacing.sm],
  );

  const heading = (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="vendor-requests-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {/*
        One of five, said as one of five, on one row that scrolls sideways
        (T134, 28/11/2026) — it used to wrap, and the fifth chip alone on a
        second row read as a second control. The chosen one is always brought
        into view.
      */}
      <SelectionChipRail
        options={VENDOR_REQUEST_FILTERS}
        value={filter}
        onChange={setFilter}
        accessibilityLabel={COPY.filtersLabel}
        accessibilityHint={COPY.filterHint}
        testID="vendor-requests-filters"
        chipTestID={filterTestID}
      />

      {isStale ? (
        <StaleNotice
          title={COPY.staleTitle}
          message={COPY.staleMessage}
          error={staleError}
          retryLabel={COPY.staleRetry}
          retryHint={COPY.staleRetryHint}
          // A refresh, not a retry: the list stays where it is while it reloads.
          onRetry={refresh}
          isRetrying={isRefreshing}
          testID="vendor-requests-stale"
        />
      ) : null}
    </View>
  );

  /*
    Nothing to show: the wait while the first load runs, a failure when it could
    not be read, otherwise the view is empty — so "no requests" is never drawn
    over a load that may find some.

    ⚠️ The wait is a region of its own: named for it and busy, with a `key`, so
    it is replaced — never updated into what follows. The list used to carry
    the label and the busy state itself, stated on every render because a prop
    that becomes undefined is not unset on a view updated in place (Sub
    Categories, found on device) — and loaded, the labelled list was a TalkBack
    stop of its own ("Your requests") under a heading that had just said as
    much. Now the list carries neither, ever. Not fixed by giving the list a key
    per state: that would remount the heading and the filters inside it and
    drop TalkBack's focus from them when the requests land.
  */
  const nothing = isLoading ? (
    <View
      key="loading"
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={COPY.loadingLabel}
      accessibilityState={{ busy: true }}
      testID="vendor-requests-loading">
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <Skeleton key={index} height={CARD_HEIGHT} radiusToken="lg" />
      ))}
    </View>
  ) : error ? (
    <ErrorState
      error={error}
      title={COPY.failedTitle}
      onRetry={retry}
      fullScreen={false}
      testID="vendor-requests-error"
    />
  ) : (
    <EmptyState
      title={VENDOR_REQUEST_EMPTY[filter].title}
      message={VENDOR_REQUEST_EMPTY[filter].message}
      icon={filter === 'all' ? 'empty' : 'requests'}
      fullScreen={false}
      testID="vendor-requests-empty"
    />
  );

  // Not offered over a failure with nothing behind it: the retry is right
  // there, and a pull would be a second, hidden one.
  const canRefresh = !error;

  return (
    <Screen padded={false} edges={TOP_EDGE_ONLY} testID="vendor-requests">
      <FlatList
        data={lines}
        keyExtractor={line => line.key}
        renderItem={renderLine}
        ListHeaderComponent={heading}
        ListEmptyComponent={nothing}
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.screenPadding,
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onRefresh={canRefresh ? refresh : undefined}
        refreshing={canRefresh ? isRefreshing : false}
        // Draws again when an answer starts or ends, so every card's buttons follow it.
        extraData={answeringId}
        testID="vendor-requests-list"
      />

      <RejectRequestDialog
        visible={rejectingId !== null}
        isRejecting={rejectingId !== null && answeringId === rejectingId}
        onCancel={cancelReject}
        onConfirm={confirmReject}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  content: {
    // So the empty and error states can centre in the space under the filters.
    flexGrow: 1,
  },
});
