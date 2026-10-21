/**
 * RequestConfirmationScreen
 *
 * The last look before a request is sent (PROJECT_BIBLE.md section 19).
 *
 * ⚠️ It summarises and it submits, and it is the only screen that submits. What
 * follows a successful send is `RequestSubmittedScreen`, reached by discarding
 * this screen and the three before it — so a sent request cannot be sent twice
 * by going back to it.
 * Everything it shows is read back out of the draft the previous two screens
 * filled in, so what the customer reads here is what is about to be sent rather
 * than a second description of it assembled separately. There is no form here
 * and no state of its own: a summary that kept its own copy of the answers would
 * be a second source of truth, and the one that disagreed would be the one that
 * got sent.
 *
 * ⚠️ It is grouped, and each group can be corrected where it stands. The summary
 * used to be eight rows in one card with a single Back control, which meant that
 * changing a date — the commonest reason anyone reads a confirmation screen at
 * all — was two undirected presses of Back and a hope. Each group now carries
 * the edit that reaches the screen which owns it, and every one of them is a
 * move along the flow section 13 already defines rather than a screen of its own.
 *
 * ⚠️ The professional group is always present, whichever way the question was
 * answered. Section 19 is explicit: a customer must never reach Submit unsure
 * whether a vendor was chosen, so open dispatch is stated in words rather than
 * shown as an empty row that could be read as either.
 *
 * ⚠️ A chosen professional is sent only once this screen's own read of the
 * eligible list has them (`useCheckedVendorChoice`, Phase 3D-12). A resumed or
 * restored draft can name one who has stopped being eligible: a loaded list
 * without them takes them off the draft and sends the customer back to choose;
 * a list still loading keeps Submit busy, and one that failed keeps it locked
 * beside the failure and its retry. Open dispatch waits for nothing.
 *
 * It assumes it was handed a complete draft, and checks anyway with the same
 * `completionOf` every other screen asks. A draft that has become incomplete is
 * not an error to report — it is a question still to be answered, so the customer
 * is put back on the screen that asks it with everything they have already said
 * still in place.
 *
 * Section 18's address has its own group now, between the request and the
 * professional — the order the questions were asked in. It is the one field on
 * the payload that no backend has agreed to, and the summary is where that is
 * least visible and matters most: a customer reads this to check where somebody
 * is coming, and what they read is exactly what will be sent.
 *
 * The groups, rows and photo strip live in `RequestSummary` and
 * `RequestPhotoStrip`, shared with request details, so a request reads the same
 * before it is sent as it does afterwards.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  RequestSummaryBlock,
  RequestSummaryLine,
  RequestSummaryRow,
  RequestSummarySection,
} from '@/features/customer/components/RequestSummary';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { presentPriority } from '@/features/customer/constants/requestPresentation';
import { formatDateValue, formatTimeValue } from '@/features/customer/constants/requestScheduling';
import { useCheckedVendorChoice } from '@/features/customer/hooks/useCheckedVendorChoice';
import { useCreateRequest } from '@/features/customer/hooks/useCreateRequest';
import { useRequestServiceContext } from '@/features/customer/hooks/useRequestServiceContext';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  ErrorState,
  Icon,
  PrimaryButton,
  RequestPhotoStrip,
  Screen,
  Text,
} from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.confirmation;

type Props = NativeStackScreenProps<CustomerStackParamList, 'RequestConfirmation'>;

export function RequestConfirmationScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { categoryId, subCategoryId } = route.params;

  const { draft, completion, recordSubmission } = useRequestDraft();
  const service = useRequestServiceContext(categoryId, subCategoryId);
  /*
    ⚠️ The professional, checked against this screen's own read of the list —
    the latest one when Submit is pressed (3D-12). One the loaded list no longer
    has is taken off the draft, which leaves it incomplete, so the effect below
    goes back to Preferred Vendor, where the customer is told why. Until the
    list has loaded, a chosen professional is not confirmed and nothing is sent:
    Submit is busy while it loads, and locked beside the failure if it fails.
  */
  const { vendors, standing, isChoiceConfirmed } = useCheckedVendorChoice(
    categoryId,
    subCategoryId,
  );
  const isCheckingVendor = standing === 'unknown' && vendors.error === null;
  const vendorCheckError = standing === 'unknown' ? vendors.error : null;
  const submission = useCreateRequest(categoryId, subCategoryId);

  /*
    Nothing incomplete gets this far, and if it does it goes back.

    The check is `completionOf`'s answer, read from the context, and deliberately
    not a second opinion assembled here — one place decides whether a request may
    be sent, and every screen asks it rather than reasoning about the parts it
    happens to know.

    Not an error message: an incomplete draft here means a question is
    unanswered, and the useful response is the screen that asks it — with every
    answer already given still in place, which is exactly what going back
    achieves since the draft is what holds them.
  */
  useEffect(() => {
    if (!draft || !completion?.isReadyForReview) {
      navigation.goBack();
    }
  }, [draft, completion, navigation]);

  /*
    Editing is going back, not going somewhere new.

    `navigate` rather than `push`: both screens are already behind this one in
    the stack, so this returns to the existing instance — the one whose form is
    still filled in — instead of stacking a second copy of a screen the customer
    would then have to leave twice. Nothing is cleared on the way: the draft is
    what holds the answers, and it is untouched by moving between the screens
    that collect them.
  */
  const editDetails = useCallback(() => {
    navigation.navigate('CreateRequest', { categoryId, subCategoryId });
  }, [navigation, categoryId, subCategoryId]);

  const editAddress = useCallback(() => {
    navigation.navigate('ServiceAddress', { categoryId, subCategoryId });
  }, [navigation, categoryId, subCategoryId]);

  const editVendor = useCallback(() => {
    navigation.navigate('PreferredVendor', { categoryId, subCategoryId });
  }, [navigation, categoryId, subCategoryId]);

  /*
    Named from the list the customer chose from.

    A name is display data, so it is resolved rather than carried: the draft
    holds an identifier, and this asks the catalogue what it is called. If the
    lookup has not finished or has failed, the row still says which dispatch
    applies — which is the part section 19 insists on. A vendor who has since
    gone from a loaded list is not named here at all: they are taken off the
    draft and the customer goes back to choose (3D-12).
  */
  const vendorLabel = useMemo(() => {
    if (draft?.vendor.kind !== 'vendor') {
      return COPY.vendorOpen;
    }

    const { vendorId } = draft.vendor;
    return vendors.data?.find(vendor => vendor.id === vendorId)?.name ?? COPY.vendorUnknown;
  }, [draft?.vendor, vendors.data]);

  /**
   * ⚠️ The lock a second tap in the same frame cannot get past — the one
   * `RequestReviewScreen` has. `isSubmitting` is state, and two presses before
   * the next render both read it as false: found in review, a double tap sent
   * two requests and counted two `request_created`. Taken before the call goes
   * out; released in a `finally` when a send fails, so Submit is still the
   * retry; kept after a success, while the screen is being reset away.
   */
  const inFlight = useRef(false);

  const submit = useCallback(() => {
    if (inFlight.current || !draft || !completion?.isReadyForReview || submission.isSubmitting) {
      return;
    }

    /*
      ⚠️ Never a professional this screen has not seen in a loaded list. Submit
      is already locked while that is so, from the same render; this is the
      rule itself, at the last line before a request goes out, so the lock is
      not the only thing between a withdrawn choice and the wire.
    */
    if (!isChoiceConfirmed) {
      return;
    }

    /*
      Narrowed rather than asserted.

      `isReadyForReview` already means the address is there, but that is a
      boolean computed elsewhere and this is the last line before a request goes
      out. Reading the address itself and refusing to send without it means a
      draft that somehow lost it produces no request at all, rather than one with
      nowhere to send anybody — and the effect above is already returning the
      customer to the step that asks for it.
    */
    const { address } = draft;
    if (!address) {
      return;
    }

    inFlight.current = true;

    void (async () => {
      /*
        The identifier, or nothing at all.

        `undefined` rather than null, an empty string or a sentinel: the request
        contract treats the field's absence as open dispatch, which is what the
        backend reads to broadcast rather than to look up a vendor that does not
        exist.
      */
      let created: Awaited<ReturnType<typeof submission.submit>> = null;
      try {
        created = await submission.submit(
          draft.values,
          draft.imageUrls,
          address,
          draft.vendor.kind === 'vendor' ? draft.vendor.vendorId : undefined,
        );
      } finally {
        // Released only when nothing was sent, so Submit is the retry. After a
        // success this screen is on its way out, and stays shut until it goes.
        if (!created) {
          inFlight.current = false;
        }
      }

      if (!created) {
        // The draft stays exactly as it was, and so does this screen. A failed
        // send is not a reason to throw away what the customer spent five
        // minutes entering, nor to move them away from the button that retries.
        return;
      }

      /*
        Sent, so the draft stops existing — here and on the device — and what it
        became is written down in the same instant. This is the only thing in the
        application that clears a draft, which is what makes the home screen's
        offer to resume trustworthy, and the only thing that records a
        submission, which is what the success screen reads.

        Strictly after the service confirmed: `created` is the backend's own
        answer, and everything above this line has already returned if it did not
        arrive.
      */
      recordSubmission({
        reference: created.id,
        categoryId,
        subCategoryId,
        address,
        vendor: draft.vendor,
      });

      /*
        ⚠️ `reset`, not `navigate`, and this is the duplicate-submission
        protection rather than merely tidy navigation.

        The four screens that collected this request are discarded, so the form
        it was sent from no longer exists and there is no Submit button left to
        press. A Back gesture from the success screen reaches the home tabs,
        which is the only place left underneath — not this screen with a filled
        summary and a live button on it.

        This replaced a toast and a `popToTop`, which showed the reference for
        four seconds on a screen the customer had already left.
      */
      navigation.reset({
        index: 1,
        routes: [
          { name: 'CustomerTabs' },
          { name: 'RequestSubmitted', params: { categoryId, subCategoryId } },
        ],
      });
    })();
  }, [
    draft,
    completion,
    isChoiceConfirmed,
    submission,
    recordSubmission,
    navigation,
    categoryId,
    subCategoryId,
  ]);

  if (!draft) {
    // The effect above is already on its way out; drawing a summary of nothing
    // for one frame would be a flash of an empty screen.
    return null;
  }

  const priority = presentPriority(draft.values.priority);
  const notes = draft.values.notes.trim();
  const hasExtras = notes.length > 0 || draft.imageUrls.length > 0;

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
            testID="request-confirmation-back"
          />
        </View>
      }
      contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      testID="customer-request-confirmation">
      <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xs }}>
        <Text variant="hero" accessibilityRole="header" testID="request-confirmation-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {/*
        What the request is for, said once and prominently.

        No edit control: the service is what the request *is*, not a detail of
        it, and changing it would mean a different set of eligible professionals
        and therefore a different request. The category is the smaller line
        because it is context — where the customer found the service.
      */}
      <RequestSummarySection title={COPY.sectionService}>
        <View accessible accessibilityRole="text" style={{ gap: theme.spacing.xxs }}>
          <Text variant="h3" testID="summary-service">
            {service.subCategoryName ?? COPY.serviceFallback}
          </Text>
          <Text variant="caption" color="textSecondary" testID="summary-category">
            {service.categoryName ?? COPY.serviceFallback}
          </Text>
        </View>
      </RequestSummarySection>

      <RequestSummarySection
        title={COPY.sectionDetails}
        onEdit={editDetails}
        editLabel={COPY.editDetails}
        editHint={COPY.editDetailsHint}
        editTestID="request-confirmation-edit-details">
        {/*
          A badge rather than a word, because urgency is the one answer here
          that is a scale — the same badge the request cards already use.
        */}
        <RequestSummaryRow
          label={COPY.priorityLabel}
          value={priority.label}
          badge={priority}
          testID="summary-priority"
        />

        {/*
          Drawn only when answered. Section 14 makes both optional, and a row
          reading "Preferred date: none" is a row inventing an answer nobody
          gave.
        */}
        {draft.values.preferredDate ? (
          <RequestSummaryRow
            label={COPY.dateLabel}
            value={formatDateValue(draft.values.preferredDate, CUSTOMER_COPY.createRequest)}
            testID="summary-date"
          />
        ) : null}
        {draft.values.preferredTime ? (
          <RequestSummaryRow
            label={COPY.timeLabel}
            value={formatTimeValue(draft.values.preferredTime)}
            testID="summary-time"
          />
        ) : null}
      </RequestSummarySection>

      {/*
        Kept even when empty, and saying so.

        The group is where notes and photographs live; drawn only when there are
        some, a customer who meant to describe the problem and forgot has nothing
        on this screen to tell them so — and no edit control to fix it with.
      */}
      <RequestSummarySection
        title={COPY.sectionExtras}
        onEdit={editDetails}
        editLabel={COPY.editExtras}
        editHint={COPY.editExtrasHint}
        editTestID="request-confirmation-edit-extras">
        {hasExtras ? (
          <>
            {notes.length > 0 ? (
              <RequestSummaryBlock
                label={COPY.notesLabel}
                value={draft.values.notes}
                testID="summary-notes"
              />
            ) : null}
            {draft.imageUrls.length > 0 ? (
              <RequestPhotoStrip urls={draft.imageUrls} copy={COPY} testID="summary-photos" />
            ) : null}
          </>
        ) : (
          <Text variant="body" color="textSecondary" testID="summary-extras-empty">
            {COPY.extrasEmpty}
          </Text>
        )}
      </RequestSummarySection>

      {/*
        Where, before who.

        It sits between the request and the professional because that is the
        order the questions were asked in and the order they are answered in —
        and because "where" is the one a customer re-reads. The coordinates
        behind it are never drawn: a summary printing 12.9716 is a summary
        showing its working.
      */}
      <RequestSummarySection
        title={COPY.sectionLocation}
        onEdit={editAddress}
        editLabel={COPY.editAddress}
        editHint={COPY.editAddressHint}
        editTestID="request-confirmation-edit-address">
        <RequestSummaryLine
          icon="location"
          label={COPY.addressLabel}
          value={draft.address?.formattedAddress ?? ''}
          testID="summary-address"
        />
      </RequestSummarySection>

      {/*
        Always drawn, whichever way it was answered — the one group section 19
        says must never be missing.
      */}
      <RequestSummarySection
        title={COPY.sectionVendor}
        onEdit={editVendor}
        editLabel={COPY.editVendor}
        editHint={COPY.editVendorHint}
        editTestID="request-confirmation-edit-vendor">
        <RequestSummaryLine
          icon={draft.vendor.kind === 'vendor' ? 'business' : 'team'}
          label={COPY.vendorLabel}
          value={vendorLabel}
          testID="summary-vendor"
        />
      </RequestSummarySection>

      <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.xs }}>
        {/*
          The professional could not be checked, so Submit is locked (3D-12),
          and this says why beside it. With its own retry, unlike the failure
          below: Submit cannot be the retry of a read it is waiting on. Change
          professional, above, is the other way on — no preference needs no
          check.
        */}
        {vendorCheckError ? (
          <View style={{ gap: theme.spacing.sm }} testID="request-confirmation-vendor-check">
            <ErrorState
              error={vendorCheckError}
              onRetry={vendors.retry}
              fullScreen={false}
              testID="request-confirmation-vendor-error"
            />
            <Text variant="caption" color="textSecondary" align="center">
              {COPY.vendorCheckFailed}
            </Text>
          </View>
        ) : null}

        {/*
          Without its own retry: the button below is the retry, and a second
          full-width action saying the same thing is the mistake the details
          screen already made once.
        */}
        {submission.error ? (
          <ErrorState
            error={submission.error}
            fullScreen={false}
            testID="request-confirmation-error"
          />
        ) : null}

        <View style={[styles.assurance, { gap: theme.spacing.sm }]}>
          <Icon name="verified" size="sm" color="textTertiary" />
          <Text variant="caption" color="textSecondary" style={styles.grow}>
            {COPY.assurance}
          </Text>
        </View>

        <PrimaryButton
          label={COPY.submit}
          onPress={submit}
          fullWidth
          // The lock that stops a double submit — and, while a chosen
          // professional is still being checked, the wait for that. An
          // incomplete draft never reaches this screen.
          isLoading={submission.isSubmitting || isCheckingVendor}
          // Locked whenever the professional is not confirmed: beside the
          // failure above, and for the one frame in which a professional the
          // list no longer has is being taken off the draft.
          disabled={!isChoiceConfirmed}
          accessibilityHint={COPY.submitHint}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  assurance: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
