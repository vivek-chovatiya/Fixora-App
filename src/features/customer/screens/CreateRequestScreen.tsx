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
 * ⚠️ Section 18's address is still not collected — it has no contract yet — and
 * section 19's confirmation summary is still not built. Neither is faked here.
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormSection } from '@/features/customer/components/FormSection';
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
import { useRequestPhotos } from '@/features/customer/hooks/useRequestPhotos';
import { useRequestServiceContext } from '@/features/customer/hooks/useRequestServiceContext';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import {
  createRequestSchema,
  REQUEST_NOTES_MAX_LENGTH,
  type CreateRequestForm,
} from '@/features/customer/validation/requestSchemas';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  ControlledInput,
  PrimaryButton,
  Screen,
  Text,
} from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.createRequest;

/** How close to the ceiling the counter appears. Silent until it is useful. */
const NOTES_COUNTER_THRESHOLD = 100;

type Props = NativeStackScreenProps<CustomerStackParamList, 'CreateRequest'>;

export function CreateRequestScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { categoryId, subCategoryId } = route.params;

  const service = useRequestServiceContext(categoryId, subCategoryId);
  const photos = useRequestPhotos();
  const { startDraft } = useRequestDraft();

  const { control, handleSubmit, watch } = useForm<CreateRequestForm>({
    resolver: zodResolver(createRequestSchema),
    /*
      Priority opens empty; the two preferences open at "no preference".

      The difference is deliberate. Not choosing a date is an answer — most
      people have none — while not choosing a priority is a question still to be
      asked, and preselecting one would answer on the customer's behalf the only
      question here where being wrong costs them a day.
    */
    defaultValues: {
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
      startDraft({ categoryId, subCategoryId, values, imageUrls: photos.uploadedUrls });
      navigation.navigate('PreferredVendor', { categoryId, subCategoryId });
    },
    [blockedReason, startDraft, categoryId, subCategoryId, photos.uploadedUrls, navigation],
  );

  const submit = handleSubmit(onContinue);

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
