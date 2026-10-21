/**
 * CreateRequestScreen
 *
 * What the customer wants doing (PROJECT_BIBLE.md sections 13 to 17).
 *
 * ⚠️ It arrives with two identifiers and sends back those two identifiers plus
 * what the customer told it. The service's name is fetched only so they can see
 * what they are asking for; it never reaches the payload, because a request
 * belongs to a category the backend owns and not to a word this screen happened
 * to render (sections 11 and 12).
 *
 * One question at a time, down the page, in the order section 13 gives them:
 * what, how urgent, when, what it looks like, anything else. Sections rather
 * than cards — six raised surfaces stacked would be six boxes competing with the
 * one button that matters.
 *
 * Photographs upload as they are added and the form refuses to submit until they
 * have finished or been taken off. Section 16 requires exactly that: a request
 * must never look submitted when its images are not.
 *
 * ⚠️ It collects; it does not send. Section 13 puts vendor selection between
 * these details and submission, so Continue hands the draft on and the request
 * is created on the other side of that choice. The button says Continue for the
 * same reason.
 *
 * ⚠️ Section 18's address is collected on the screen after this one, not here.
 * It is a search, a permission and a confirmation of its own, and folding it
 * into a form that already asks five questions would bury the one field that
 * decides whether anybody can be sent anywhere.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormSection } from '@/features/customer/components/FormSection';
import { InfoNotice } from '@/features/customer/components/InfoNotice';
import { PhotoAttachments } from '@/features/customer/components/PhotoAttachments';
import { PrioritySelector } from '@/features/customer/components/PrioritySelector';
import { RequestServiceSummary } from '@/features/customer/components/RequestServiceSummary';
import { ScheduleRail } from '@/features/customer/components/ScheduleRail';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { SELECTABLE_PRIORITIES } from '@/features/customer/constants/requestPresentation';
import {
  buildDateOptions,
  buildTimeOptions,
  NO_PREFERENCE,
} from '@/features/customer/constants/requestScheduling';
import { useOtherRequestDraft } from '@/features/customer/hooks/useOtherRequestDraft';
import { useRequestPhotos } from '@/features/customer/hooks/useRequestPhotos';
import { useRequestServiceContext } from '@/features/customer/hooks/useRequestServiceContext';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import {
  NO_VENDOR_CHOICE,
  isDraftWorthKeeping,
  type RequestDraft,
} from '@/features/customer/state/requestDraft';
import {
  createRequestSchema,
  REQUEST_NOTES_MAX_LENGTH,
  type CreateRequestForm,
} from '@/features/customer/validation/requestSchemas';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  ControlledInput,
  Loader,
  PrimaryButton,
  Screen,
  Text,
} from '@/shared/components';
import { useAnalytics } from '@/shared/hooks/useAnalytics';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.createRequest;

/** How close to the ceiling the counter appears. Silent until it is useful. */
const NOTES_COUNTER_THRESHOLD = 100;

/**
 * How long the form settles before it is written down.
 *
 * Long enough that typing a sentence is one write rather than forty, short
 * enough that an interruption a second later still finds the sentence saved.
 */
const AUTOSAVE_DELAY_MS = 800;

type Props = NativeStackScreenProps<CustomerStackParamList, 'CreateRequest'>;

/**
 * Waits for the draft to have been looked for, then renders the form once.
 *
 * The form seeds itself from the draft at mount and is the authority on those
 * values from then on, which only works if the draft is already known by the
 * time it mounts. Deciding there is nothing to resume before storage has
 * answered would quietly re-ask a customer every question they had already
 * answered — so the gate is a wrapper rather than a branch inside the form,
 * because a branch cannot un-initialise a form that has already started.
 *
 * In practice this resolves during app startup, long before anyone can tap
 * through four screens to get here.
 */
export function CreateRequestScreen(props: Props) {
  const { isRestored } = useRequestDraft();

  if (!isRestored) {
    return (
      <Screen testID="customer-create-request">
        <Loader label={COPY.loadingLabel} fullScreen />
      </Screen>
    );
  }

  return <RequestDetailsForm {...props} />;
}

function RequestDetailsForm({ navigation, route }: Props) {
  const theme = useTheme();
  const { categoryId, subCategoryId } = route.params;

  const service = useRequestServiceContext(categoryId, subCategoryId);
  const { draft, startDraft, updateDraft } = useRequestDraft();
  const elsewhere = useOtherRequestDraft(categoryId, subCategoryId, service);

  /*
    Read once, at mount, and never again.

    A resumed request opens on the answers it was left with; from then on this
    screen is the authority on them, so re-reading the draft would fight whatever
    the customer is typing. The ref is what keeps that true across re-renders
    without the draft becoming a dependency of everything below.
  */
  const resumed = useRef(draft?.subCategoryId === subCategoryId ? draft : null).current;

  const photos = useRequestPhotos(resumed?.imageUrls);

  const { control, handleSubmit, watch, getValues } = useForm<CreateRequestForm>({
    resolver: zodResolver(createRequestSchema),
    /*
      Priority opens empty; the two preferences open at "no preference".

      The difference is deliberate. Not choosing a date is an answer — most
      people have none — while not choosing a priority is a question still to be
      asked, and preselecting one would answer on the customer's behalf the only
      question here where being wrong costs them a day.
    */
    defaultValues: resumed?.values ?? {
      priority: '',
      preferredDate: NO_PREFERENCE,
      preferredTime: NO_PREFERENCE,
      notes: '',
    },
  });

  // Built once. `buildDateOptions` reads the clock, and a list rebuilt on every
  // keystroke would renumber the days under someone's finger at midnight.
  const dateOptions = useMemo(() => buildDateOptions(COPY), []);
  const timeOptions = useMemo(() => buildTimeOptions(COPY), []);

  /*
    What the unmount cleanup reads, without depending on any of it.

    The form is asked directly rather than mirrored during render: a Controller
    re-renders its own field and not this component, so a priority chosen and
    then walked away from would never have reached a render-time copy. `photos`
    does live in this component's state, so a ref refreshed each render is
    accurate for it.
  */
  const uploaded = useRef(photos.uploadedUrls);
  uploaded.current = photos.uploadedUrls;

  const liveDraft = useRef(draft);
  liveDraft.current = draft;

  /*
    The live draft, if it is this service's — and nothing otherwise.

    ⚠️ There is one draft (`RequestDraftContext`), and it may be for another
    service: a customer who started a fan repair can open a leak repair from
    Home without finishing it. That draft is not this screen's to write into or
    to borrow from. Found by the analytics work with a jest probe: `save` used to
    merge into whatever draft existed, so opening service B — even without
    typing, since `save` runs once on mount — rewrote A's priority, dates, notes
    and photos with B's, under A's ids, address and professional; A's notes were
    simply gone. And Continue carried A's address and A's *professional* into B's
    request, where Preferred Vendor never checks that a chosen professional is
    eligible for the service. Matched on the sub-category, as `resumed` is.
    (Since 21/10/2026 the address comes along again, on purpose and on Continue
    only — see `onContinue`. The professional never does.)
  */
  const ownDraft = useCallback(
    (): RequestDraft | null =>
      liveDraft.current?.subCategoryId === subCategoryId ? liveDraft.current : null,
    [subCategoryId],
  );

  /** Whether this screen has already passed a draft to the next step. */
  const handedOff = useRef(false);

  /*
    Section 54's `request_started`: the moment a draft for this service first
    exists, which is the first time this screen starts one — by autosave,
    Continue or leaving, whichever comes first — and only when it did not open
    on a draft of its own.

    ⚠️ A ref, not a look at the draft. The draft this screen starts only
    reaches `liveDraft` on the next render, so "was there a draft?" asked twice
    before that render — an autosave landing just as Continue is pressed —
    would answer no twice and count one request as two.

    A resumed draft is not a start: it began on an earlier visit, and was
    counted then. Opening the form and leaving without saying anything starts
    no draft, so it sends nothing.
  */
  const { track } = useAnalytics();
  const started = useRef(resumed !== null);

  const beginDraft = useCallback(
    (next: RequestDraft) => {
      startDraft(next);

      if (!started.current) {
        started.current = true;
        track('request_started', { categoryId, subCategoryId });
      }
    },
    [startDraft, track, categoryId, subCategoryId],
  );

  const notes = watch('notes');
  const notesRemaining = REQUEST_NOTES_MAX_LENGTH - notes.length;

  /*
    Why Submit is unavailable, in the customer's words, or null when it is not.

    One value rather than a disabled button and a separate message, so the two
    cannot disagree: whatever explains the state is what produces it.
  */
  const blockedReason = photos.isUploading
    ? COPY.photosBusy
    : photos.hasFailures
      ? COPY.photosUnresolved
      : null;

  const onContinue = useCallback(
    (values: CreateRequestForm) => {
      if (blockedReason) {
        return;
      }

      /*
        Handed on, not sent.

        Everything the customer entered goes into the draft — the form's own
        values and the URLs of photographs that finished uploading — and the
        route carries only the two identifiers the next screen needs to ask the
        backend who is eligible. Nothing is submitted until a vendor question has
        been answered, which is the order section 13 lays down.
      */
      /*
        The later answers are carried forward, not reset — this service's only.

        Coming back here from a later screen to change a date and going forward
        again must not quietly un-choose the professional already picked or throw
        away the address already given, so both are read from the live draft
        rather than from what this screen was opened with.

        A draft for another service is replaced, as it always was — there is one
        draft, and Continue here is the deliberate act of starting this request.
        Its address comes along (owner decision, 21/10/2026): it is almost always
        the same home, and Service Address opens with it filled in and still
        editable, so retyping it was friction with nothing to show for it.
        ⚠️ Its professional never does: they were chosen from another service's
        list, may not be offered for this one, and Preferred Vendor does not
        check (see `ownDraft`). Its answers — urgency, dates, notes, photos —
        stay with it too: they describe the other job.
      */
      const own = ownDraft();

      handedOff.current = true;
      beginDraft({
        categoryId,
        subCategoryId,
        values,
        imageUrls: photos.uploadedUrls,
        // This service's own address when it has a draft; otherwise the other
        // service's, when its draft holds one — which makes it a draft worth
        // keeping (`isDraftWorthKeeping`), the one the notice above names.
        address: own ? own.address : (liveDraft.current?.address ?? null),
        vendor: own?.vendor ?? NO_VENDOR_CHOICE,
      });
      navigation.navigate('ServiceAddress', { categoryId, subCategoryId });
    },
    [
      blockedReason,
      ownDraft,
      beginDraft,
      categoryId,
      subCategoryId,
      photos.uploadedUrls,
      navigation,
    ],
  );

  /*
    Writes down whatever has been entered, if it is worth writing down.

    Four cases, and the last two are the ones that bite:

    - this service's draft exists: merge into it, so the vendor answered on the
      next screen survives a trip back here to change a date
    - no draft and this screen never handed one on: the customer has said
      something, so start one — unless they barely opened the form, because
      offering to resume nothing is worse than offering nothing
    - no draft but this screen did hand one on: it was cleared by a successful
      submission. Writing here would resurrect a request that has already been
      sent.
    - another service's draft with something in it exists: write nothing.
      Merging rewrote that request with this one's answers (see `ownDraft`), and
      starting this one instead would throw that one away on an autosave nobody
      asked for. Only Continue — the deliberate act — replaces it, and the
      notice at the top of this form says so. So what is typed here and left
      without Continue is not kept: the one-draft model's price, paid by the
      request that was never started rather than the one that was.

    Everything is read at call time rather than captured: a Controller re-renders
    its own field and not this component, so a priority chosen and then walked
    away from would never reach a render-time copy.
  */
  const save = useCallback(() => {
    const live = liveDraft.current;
    const own = ownDraft();

    /*
      Another service's draft is left alone only while it holds something. One
      emptied back out (every answer cleared — `isDraftWorthKeeping` says no) is
      nothing to lose: it counts as no draft, so this form starts its own as it
      would with none, rather than an empty request elsewhere blocking this one
      (lead decision after review).
    */
    if (live && !own && isDraftWorthKeeping(live)) {
      return;
    }

    const pending = {
      categoryId,
      subCategoryId,
      values: getValues(),
      imageUrls: uploaded.current,
      address: own?.address ?? null,
      vendor: own?.vendor ?? NO_VENDOR_CHOICE,
    };

    if (own) {
      updateDraft({ values: pending.values, imageUrls: pending.imageUrls });
      return;
    }

    if (!handedOff.current && isDraftWorthKeeping(pending)) {
      beginDraft(pending);
    }
  }, [categoryId, subCategoryId, getValues, ownDraft, beginDraft, updateDraft]);

  /*
    Saved as it is typed, not only on the way out.

    Unmounting is the tidy signal that somebody left, and for a while it was the
    only one — which meant a phone call that killed the app mid-form lost
    everything, because nothing had been written yet. Being killed is exactly the
    case this feature exists for.

    Debounced rather than per keystroke: the point is to survive an interruption,
    not to write to the device on every letter.
  */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const subscription = watch(() => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    });

    return () => {
      subscription.unsubscribe();
      /*
        A pending write must not outlive this screen. `popToTop` after a
        successful submission unmounts us, and a timer still holding the old
        values would put the sent request back on the home screen.
      */
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [watch, save]);

  // Photographs live in this component's state, so they settle with a render
  // rather than through the form, and are saved as they land.
  useEffect(() => {
    save();
  }, [photos.uploadedUrls, save]);

  // And once more on the way out, so the last keystroke before Back is not left
  // sitting in a debounce that never fires.
  useEffect(() => () => save(), [save]);

  const submit = handleSubmit(onContinue);

  // Display only: the other request's name never leaves this sentence.
  const otherDraftNotice = COPY.otherDraftNotice.replace(
    '{service}',
    elsewhere.serviceName ?? CUSTOMER_COPY.home.resumeFallbackService,
  );

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
            testID="create-request-back"
          />
        </View>
      }
      contentContainerStyle={{ gap: theme.spacing.xxl, paddingBottom: theme.spacing.xxxl }}
      testID="customer-create-request">
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="create-request-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {/*
        Another service's unfinished request, said before Continue replaces it.

        There is one draft, so Continue here replaces that one — the only thing
        on this form that touches it (autosave and leaving write nothing into
        it). Said at the top, before any answer is given, in the info tone and
        not as a warning: nothing is wrong and nothing happens unless they press
        Continue. One spoken element, so a screen reader hears both sentences
        together rather than the second without the first. Held back while a
        request in this same category cannot be named yet, so it never first
        appears under this request's own category name (see the hook). Drawn
        by `InfoNotice`, shared with Preferred Vendor since 3D-12.
      */}
      {elsewhere.draft && elsewhere.isNamed ? (
        <InfoNotice
          text={otherDraftNotice}
          detail={COPY.otherDraftConsequence}
          testID="create-request-other-draft"
        />
      ) : null}

      <FormSection title={COPY.serviceTitle}>
        <RequestServiceSummary
          serviceName={service.subCategoryName}
          categoryName={service.categoryName}
          fallbackName={COPY.serviceFallback}
          isLoading={service.isLoading}
          testID="create-request-service"
        />

        {/*
          Said, and then got on with. The names are a caption; a request for a
          service whose name did not load is still a request for that service,
          so this explains the blank rather than replacing the form with an
          error and a retry button.
        */}
        {service.error && !service.subCategoryName ? (
          <Text
            variant="caption"
            color="textSecondary"
            accessibilityLiveRegion="polite"
            testID="create-request-service-notice">
            {COPY.serviceUnavailable}
          </Text>
        ) : null}
      </FormSection>

      <Controller
        control={control}
        name="priority"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <FormSection title={COPY.priorityTitle} support={COPY.prioritySupport}>
            <PrioritySelector
              options={SELECTABLE_PRIORITIES}
              value={value}
              onChange={onChange}
              accessibilityLabel={COPY.priorityTitle}
              testID="create-request-priority"
            />

            {error ? (
              <Text
                variant="caption"
                color="danger"
                accessibilityLiveRegion="polite"
                testID="create-request-priority-error">
                {error.message}
              </Text>
            ) : null}
          </FormSection>
        )}
      />

      <FormSection title={COPY.dateTitle} support={COPY.scheduleSupport}>
        <Controller
          control={control}
          name="preferredDate"
          render={({ field: { value, onChange } }) => (
            <ScheduleRail
              options={dateOptions}
              value={value}
              onChange={onChange}
              accessibilityLabel={COPY.dateTitle}
              accessibilityHint={COPY.dateHint}
              testID="create-request-date"
            />
          )}
        />
      </FormSection>

      <FormSection title={COPY.timeTitle}>
        <Controller
          control={control}
          name="preferredTime"
          render={({ field: { value, onChange } }) => (
            <ScheduleRail
              options={timeOptions}
              value={value}
              onChange={onChange}
              accessibilityLabel={COPY.timeTitle}
              accessibilityHint={COPY.timeHint}
              testID="create-request-time"
            />
          )}
        />
      </FormSection>

      <FormSection title={COPY.photosTitle} support={COPY.photosSupport}>
        <PhotoAttachments photos={photos} testID="create-request-photos" />
      </FormSection>

      <FormSection title={COPY.notesTitle} support={COPY.notesSupport}>
        <ControlledInput
          control={control}
          name="notes"
          label={COPY.notesLabel}
          placeholder={COPY.notesPlaceholder}
          multiline
          // Android otherwise centres the first line in a box four lines tall.
          textAlignVertical="top"
          // A rounded rectangle, not the capsule the single-line fields use.
          radiusToken="xl"
          /*
            No `maxLength`. A hard cap stops the keystroke without saying why
            and would make the schema's message unreachable; the count below
            warns, the schema explains, and the customer edits their own words
            down rather than discovering the field has stopped accepting them.
          */
          helperText={
            notesRemaining <= NOTES_COUNTER_THRESHOLD ? String(notesRemaining) : undefined
          }
          testID="create-request-notes"
        />
      </FormSection>

      <View style={{ gap: theme.spacing.md }}>
        {blockedReason ? (
          <Text
            variant="caption"
            color="textSecondary"
            align="center"
            accessibilityLiveRegion="polite"
            testID="create-request-blocked">
            {blockedReason}
          </Text>
        ) : null}

        <PrimaryButton
          label={COPY.submit}
          onPress={submit}
          fullWidth
          // No loading state: this navigates, it does not call anything. The
          // double-submit lock that used to be here moved to the screen that
          // now owns the call.
          disabled={blockedReason !== null}
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
});
