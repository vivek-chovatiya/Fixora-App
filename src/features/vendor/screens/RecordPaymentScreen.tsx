/**
 * RecordPaymentScreen
 *
 * Recording, after the job, that a customer has now paid (owner decision,
 * 21/10/2026; PROJECT_BIBLE.md section 37, the offline payment record).
 * Opened by "Record payment" on a finished request's details, which offers it
 * only while the completion record says "Not paid yet" — and nowhere else.
 *
 * ⚠️ One direction, once. "Not paid yet" becomes "Paid", with how; the amount,
 * the currency and the completion notes stay exactly as recorded, and a paid
 * record cannot be changed again. So it is asked once more before anything is
 * sent (lead decision, 21/10/2026), as completing is: "Record payment"
 * validates, then the shared `ConfirmDialog` — worded and styled as
 * `CompleteWorkDialog`, confirm in the primary tone because recording a
 * payment is not destructive — asks "Mark as paid by UPI?" and says it cannot
 * be changed later. Cancel sends nothing and keeps the choice; while the call
 * is in the air the dialog is busy and cannot be dismissed, and five confirms
 * send one call.
 *
 * ⚠️ Recorded, never processed (section 37). Nothing here takes, requests or
 * confirms a payment; the vendor writes down what happened, and the subtitle
 * ends "Fixora does not process payments."
 *
 * ⚠️ A sibling of `CompleteWorkScreen`, not a mode of it. That form's amount,
 * status and notes, its confirmation and its tests all stay as they are; what
 * the two share is the field (`PaymentMethodField`), the rule
 * (`recordPaymentSchema`: the paid half of the completion rules), the methods
 * read (`usePaymentMethods`) and the way a result is said
 * (`useVendorRequestDecision`):
 *
 * - recorded → its toast, the other screens told the work changed, and back to
 *   the details — which read the request again (`VendorWorkSync`, as after a
 *   completion) and show "Paid · <method>";
 * - nothing to record any more (`invalidTransition` — completed elsewhere
 *   without a record, say) or no longer this vendor's → the calm 3E-5 message,
 *   the other screens read again, and the form is left;
 * - failed → the failure's own words (`userMessage` only); the dialog closes,
 *   the method chosen stays chosen, and the button is the retry.
 *
 * ⚠️ The confirm is busy, and further presses are ignored, while the call is
 * in the air — one guard for every vendor action, so five presses send one
 * call.
 * Leaving with a method chosen asks first, through `beforeRemove` — the Back
 * control, Android back and the gesture alike — as the completion form does;
 * an untouched form, one in flight, and one that has recorded leave without
 * asking.
 *
 * The route carries the reference and nothing else. Nothing about the job is
 * read here: the reference is shown so the vendor can see which job this is,
 * and the service checks that it is theirs, finished and not yet paid.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { PaymentMethodField } from '@/features/vendor/components/PaymentMethodField';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useRecordPayment } from '@/features/vendor/hooks/useRecordPayment';
import {
  buildPaymentInput,
  recordPaymentFormValues,
  recordPaymentSchema,
  type RecordPaymentForm,
} from '@/features/vendor/validation/completeWorkSchema';
import type { VendorStackParamList } from '@/navigation/types';
import { BackButton, ConfirmDialog, PrimaryButton, Screen, Text } from '@/shared/components';
import type { VendorPaymentInput } from '@/shared/services/types/VendorRequestService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.recordPaymentForm;

type Props = NativeStackScreenProps<VendorStackParamList, 'RecordPayment'>;

export function RecordPaymentScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { requestId } = route.params;
  const { methods, isLoadingMethods, methodsError, retryMethods, record, isRecording } =
    useRecordPayment(requestId);

  const {
    control,
    handleSubmit,
    formState: { isDirty, errors, isSubmitted },
  } = useForm<RecordPaymentForm>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: recordPaymentFormValues(),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const hasFieldErrors = isSubmitted && Object.keys(errors).length > 0;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* Leaving with a method chosen ------------------------------------------ */

  const allowLeave = useRef(false);
  const interrupted = useRef<NavigationAction | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (allowLeave.current || !isDirty || isRecording) {
          return;
        }
        event.preventDefault();
        interrupted.current = event.data.action;
        setIsDiscarding(true);
      }),
    [isDirty, isRecording, navigation],
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

  /* Recording ------------------------------------------------------------- */

  /**
   * The payment being confirmed, built from the form when "Record payment"
   * passed — so what is confirmed is exactly what is sent.
   */
  const [confirming, setConfirming] = useState<VendorPaymentInput | null>(null);

  const ask = useCallback((values: RecordPaymentForm) => {
    setConfirming(buildPaymentInput(values));
  }, []);

  const onSubmit = handleSubmit(ask);

  const cancelConfirm = useCallback(() => setConfirming(null), []);

  const confirm = useCallback(() => {
    if (confirming === null) {
      return;
    }
    record(confirming).then(outcome => {
      // A second press while the first is in the air is not an answer; the first one settles it.
      if (outcome.kind === 'ignored' || !mounted.current) {
        return;
      }
      setConfirming(null);
      if (outcome.kind === 'failed') {
        // The method chosen is still chosen, and the button is the retry.
        return;
      }
      // Recorded, or nothing left here to record: back to the request.
      allowLeave.current = true;
      navigation.goBack();
    });
  }, [confirming, navigation, record]);

  // Named in the question by the service's own word for it — never by its id.
  const confirmingMethod = confirming
    ? methods?.find(method => method.id === confirming.paymentMethodId)?.label
    : undefined;

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
            testID="record-payment-back"
          />
        </View>
      }
      contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
      testID="record-payment">
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="record-payment-heading">
          {COPY.title}
        </Text>
        <Text variant="caption" color="textSecondary" testID="record-payment-reference">
          {`${VENDOR_COPY.job.referencePrefix} ${requestId}`}
        </Text>
        <Text variant="subtitle" color="textSecondary" testID="record-payment-subtitle">
          {COPY.subtitle}
        </Text>
      </View>

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
            testID="record-payment"
          />
        )}
      />

      <View style={{ gap: theme.spacing.md }}>
        {hasFieldErrors ? (
          <Text
            variant="caption"
            color="danger"
            accessibilityLiveRegion="polite"
            testID="record-payment-fix-errors">
            {COPY.fixErrors}
          </Text>
        ) : null}

        <PrimaryButton
          fullWidth
          label={COPY.submit}
          icon="success"
          onPress={onSubmit}
          isLoading={isRecording}
          accessibilityHint={COPY.submitHint}
        />
      </View>

      <ConfirmDialog
        visible={confirming !== null}
        title={confirmingMethod ? COPY.confirmTitle(confirmingMethod) : COPY.confirmTitlePlain}
        message={COPY.confirmMessage}
        cancelLabel={COPY.confirmCancel}
        cancelHint={COPY.confirmCancelHint}
        confirmLabel={COPY.confirmConfirm}
        confirmHint={COPY.confirmConfirmHint}
        confirmVariant="primary"
        isConfirming={isRecording}
        onCancel={cancelConfirm}
        onConfirm={confirm}
        testID="record-payment-confirm-dialog"
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
        testID="record-payment-discard-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
});
