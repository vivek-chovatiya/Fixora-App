/**
 * CompleteWorkScreen
 *
 * Completing a job, and recording what it came to (PROJECT_BIBLE.md section 36:
 * "Completion Notes, Final Amount, Payment Method, Payment Status"; section 37:
 * the offline payment record). Opened by "Mark completed" — from the request's
 * details or from its card in the list — and nowhere else.
 *
 * ⚠️ Recorded, never processed (section 37). Nothing here takes, requests or
 * confirms a payment: the vendor writes down the amount, whether the customer
 * has paid them and how, and the app keeps that record. The subtitle says so,
 * and no word on the screen suggests Fixora handled the money.
 *
 * ⚠️ The final amount is required, typed in rupees on a decimal keypad, and
 * read as text into whole paise (`completeWorkSchema`) — never through
 * floating point. The payment status is a required choice with nothing
 * preselected. The method is asked for only when the customer has paid, and
 * its options are the service's (section 37: "must follow backend
 * configuration"): while they load the field says so, and if they fail it says
 * so beside itself with Try again — the rest of the form keeps working and
 * keeps its values, and a paid job cannot be sent without a method. Notes are
 * optional and sent exactly as typed. Each message sits beside its own field
 * (section 49), and "Check the highlighted fields." beside the button.
 *
 * ⚠️ Asked once more before anything is sent. "Complete work" validates, then
 * opens the same confirmation completion has always had (`CompleteWorkDialog`):
 * completing cannot be undone. The dialog stays, busy and undismissable, while
 * the completion is in the air; five confirms send one call.
 *
 * ⚠️ What happens next is said once, by `useVendorRequestDecision`, in the words
 * every vendor action uses:
 *
 * - completed → its toast, the other screens told the work changed, and back to
 *   wherever the form was opened — the details read the request again and show
 *   it completed, with what was recorded;
 * - the job had already moved on (`invalidTransition`) or is no longer this
 *   vendor's → the calm 3E-5 message, the other screens read again, and the
 *   form is left: there is nothing here left to complete;
 * - failed → the failure's own words; the form stays exactly as typed, and the
 *   button is the retry.
 *
 * ⚠️ Leaving with something typed asks first, through `beforeRemove` — so the
 * Back control, Android back and the gesture are all guarded (3D-8, 3E-7). An
 * untouched form, and a completed one, leave without asking.
 *
 * The route carries the reference and nothing else. Nothing about the job is
 * read here: the reference is shown so the vendor can see which job this is,
 * and the service checks that it is theirs and in progress.
 *
 * The method field and its chips are `PaymentMethodField` (21/10/2026), shared
 * with recording a payment after the job, so the two cannot ask differently.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { AppConfig } from '@/core/config/AppConfig';
import { CompleteWorkDialog } from '@/features/vendor/components/CompleteWorkDialog';
import { PaymentChoice, PaymentMethodField } from '@/features/vendor/components/PaymentMethodField';
import {
  presentPaymentStatus,
  SELECTABLE_PAYMENT_STATUSES,
} from '@/features/vendor/constants/paymentPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useCompleteWork } from '@/features/vendor/hooks/useCompleteWork';
import {
  buildCompletionInput,
  completeWorkFormValues,
  completeWorkSchema,
  type CompleteWorkForm,
} from '@/features/vendor/validation/completeWorkSchema';
import type { VendorStackParamList } from '@/navigation/types';
import {
  BackButton,
  ConfirmDialog,
  ControlledInput,
  FieldLabel,
  PrimaryButton,
  Screen,
  Text,
} from '@/shared/components';
import { currencySymbol } from '@/shared/presentation/money';
import {
  COMPLETION_NOTES_MAX_LENGTH,
  PAYMENT_STATUS_PAID,
  type VendorCompletionInput,
} from '@/shared/services/types/VendorRequestService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.completeForm;

/** How close to the ceiling the notes counter appears — the customer notes' threshold. */
const NOTES_COUNTER_THRESHOLD = 100;

type Props = NativeStackScreenProps<VendorStackParamList, 'CompleteWork'>;

export function CompleteWorkScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { requestId } = route.params;
  const { methods, isLoadingMethods, methodsError, retryMethods, complete, isCompleting } =
    useCompleteWork(requestId);

  const {
    control,
    handleSubmit,
    clearErrors,
    formState: { isDirty, errors, isSubmitted },
  } = useForm<CompleteWorkForm>({
    resolver: zodResolver(completeWorkSchema),
    defaultValues: completeWorkFormValues(),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const paymentStatus = useWatch({ control, name: 'paymentStatus' });
  const notes = useWatch({ control, name: 'notes' });
  const isPaid = paymentStatus === PAYMENT_STATUS_PAID;
  const notesRemaining = COMPLETION_NOTES_MAX_LENGTH - notes.length;

  const hasFieldErrors = isSubmitted && Object.keys(errors).length > 0;

  const symbol = currencySymbol(AppConfig.money.currency);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* Leaving with unsaved changes ------------------------------------------ */

  const allowLeave = useRef(false);
  const interrupted = useRef<NavigationAction | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (allowLeave.current || !isDirty || isCompleting) {
          return;
        }
        event.preventDefault();
        interrupted.current = event.data.action;
        setIsDiscarding(true);
      }),
    [isCompleting, isDirty, navigation],
  );

  const confirmDiscard = useCallback(() => {
    setIsDiscarding(false);
    allowLeave.current = true;

    const action = interrupted.current;
    interrupted.current = null;
    if (action) {
      navigation.dispatch(action);
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const keepEditing = useCallback(() => {
    interrupted.current = null;
    setIsDiscarding(false);
  }, []);

  /* Completing ------------------------------------------------------------ */

  /**
   * The completion being confirmed, built from the form when "Complete work"
   * passed — so what is confirmed is exactly what is sent.
   */
  const [confirming, setConfirming] = useState<VendorCompletionInput | null>(null);

  const ask = useCallback((values: CompleteWorkForm) => {
    const completion = buildCompletionInput(values);
    if (completion) {
      setConfirming(completion);
    }
  }, []);

  const onSubmit = handleSubmit(ask);

  const cancelConfirm = useCallback(() => setConfirming(null), []);

  const confirm = useCallback(() => {
    if (confirming === null) {
      return;
    }
    complete(confirming).then(outcome => {
      // A second press while the first is in the air is not an answer; the first one closes it.
      if (outcome.kind === 'ignored' || !mounted.current) {
        return;
      }
      setConfirming(null);
      if (outcome.kind === 'failed') {
        // Everything typed is still here, and the button is the retry.
        return;
      }
      // Completed, or nothing left here to complete: back to where the form was opened.
      allowLeave.current = true;
      navigation.goBack();
    });
  }, [complete, confirming, navigation]);

  /*
    A method error belongs to a paid job. Choosing "Not paid yet" hides the
    field, so its message goes too — otherwise "Check the highlighted fields."
    would point at nothing on screen.
  */
  const onStatusChosen = useCallback(
    (status: string) => {
      if (status !== PAYMENT_STATUS_PAID) {
        clearErrors('paymentMethodId');
      }
    },
    [clearErrors],
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
            testID="complete-work-back"
          />
        </View>
      }
      contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
      testID="complete-work">
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="complete-work-heading">
          {COPY.title}
        </Text>
        <Text variant="caption" color="textSecondary" testID="complete-work-reference">
          {`${VENDOR_COPY.job.referencePrefix} ${requestId}`}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <ControlledInput
          control={control}
          name="amount"
          label={COPY.amountLabel}
          // The symbol is said with the name, and the drawn one is left out of
          // the reading order, so the field is heard once as one thing.
          accessibilityLabel={`${COPY.amountLabel}, ${symbol}`}
          required
          prefix={
            <Text
              variant="body"
              color="textSecondary"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              {symbol}
            </Text>
          }
          placeholder={COPY.amountPlaceholder}
          helperText={COPY.amountHelper}
          keyboardType="decimal-pad"
          editable={!isCompleting}
          testID="complete-work-amount"
        />

        <Controller
          control={control}
          name="paymentStatus"
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <ChoiceField
              label={COPY.statusLabel}
              error={error?.message}
              testID="complete-work-status">
              {SELECTABLE_PAYMENT_STATUSES.map(status => (
                <PaymentChoice
                  key={status}
                  value={status}
                  label={presentPaymentStatus(status)}
                  selected={value === status}
                  onChange={onChange}
                  onChosen={onStatusChosen}
                  hint={COPY.statusHint}
                  testID={`complete-work-status-${status}`}
                />
              ))}
            </ChoiceField>
          )}
        />

        {/*
          Only for a paid job. Hidden, its value is kept — a vendor who picks
          "Not paid yet" by mistake gets their method back — but never sent.
        */}
        {isPaid ? (
          <Controller
            control={control}
            name="paymentMethodId"
            render={({ field: { value, onChange }, fieldState: { error } }) => (
              <PaymentMethodField
                methods={methods}
                isLoading={isLoadingMethods}
                loadError={methodsError}
                onRetry={retryMethods}
                value={value}
                onChange={onChange}
                error={error?.message}
                testID="complete-work"
              />
            )}
          />
        ) : null}

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
            No `maxLength`, as on the customer's notes: a hard cap stops the
            keystroke without saying why. The count warns near the ceiling and
            the schema explains past it.
          */
          helperText={
            notesRemaining <= NOTES_COUNTER_THRESHOLD ? String(notesRemaining) : COPY.notesHelper
          }
          editable={!isCompleting}
          testID="complete-work-notes"
        />
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {hasFieldErrors ? (
          <Text
            variant="caption"
            color="danger"
            accessibilityLiveRegion="polite"
            testID="complete-work-fix-errors">
            {COPY.fixErrors}
          </Text>
        ) : null}

        <PrimaryButton
          fullWidth
          label={COPY.submit}
          icon="completeWork"
          onPress={onSubmit}
          isLoading={isCompleting}
          accessibilityHint={COPY.submitHint}
        />
      </View>

      <CompleteWorkDialog
        visible={confirming !== null}
        isCompleting={isCompleting}
        onCancel={cancelConfirm}
        onConfirm={confirm}
      />

      <ConfirmDialog
        visible={isDiscarding}
        title={COPY.discardTitle}
        message={COPY.discardMessage}
        cancelLabel={COPY.discardKeep}
        cancelHint={COPY.discardKeepHint}
        confirmLabel={COPY.discardConfirm}
        confirmHint={COPY.discardConfirmHint}
        onCancel={keepEditing}
        onConfirm={confirmDiscard}
        testID="complete-work-discard-dialog"
      />
    </Screen>
  );
}

interface ChoiceFieldProps {
  label: string;
  /** The field's validation message, beside it (section 49). */
  error?: string;
  testID: string;
  children: React.ReactNode;
}

/**
 * A required one-of choice: its name, the chips as one radio group, and its
 * message. Wrapped rather than scrolled, so every option is visible at 360dp.
 */
function ChoiceField({ label, error, testID, children }: ChoiceFieldProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <FieldLabel required>{label}</FieldLabel>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={[styles.choices, { gap: theme.spacing.sm }]}
        testID={testID}>
        {children}
      </View>
      {error ? (
        <Text
          variant="caption"
          color="danger"
          accessibilityLiveRegion="polite"
          testID={`${testID}-error`}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
