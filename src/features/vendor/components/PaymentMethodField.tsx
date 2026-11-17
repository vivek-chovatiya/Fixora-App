/**
 * PaymentMethodField
 *
 * How the customer paid (PROJECT_BIBLE.md section 37): the service's methods
 * as a radio group of chips — or, while they load, a placeholder that says so;
 * or, when they could not be read, the reason and a way to try again, beside
 * the field and nowhere else. And `PaymentChoice`, the one chip it is made of,
 * which the completion form's payment status uses too.
 *
 * Moved out of `CompleteWorkScreen` on 21/10/2026, when recording a payment
 * after the job (`RecordPaymentScreen`) needed the same field: one field asked
 * two ways would drift, and a vendor should meet the same chips, the same
 * failure and the same Try again in both places. The words are the completion
 * form's (`completeForm.method…`) in both, for the same reason.
 *
 * ⚠️ The options are the service's, never the app's (section 37: "must follow
 * backend configuration"). Nothing here holds a list of methods.
 *
 * ⚠️ The test ids are built from the caller's `testID`, so the completion
 * form's — `complete-work-method`, `complete-work-methods`,
 * `complete-work-method-<id>` and the rest — are exactly what they were before
 * the move.
 */

import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { FieldLabel, SecondaryButton, SelectionChip, Skeleton, Text } from '@/shared/components';
import type { PaymentMethodOption } from '@/shared/services/types/VendorRequestService';
import { useTheme } from '@/shared/theme';
import type { AppError } from '@/shared/types/error';

const COPY = VENDOR_COPY.completeForm;

export interface PaymentChoiceProps {
  /** What is stored when chosen: a status constant, or a method's id. */
  value: string;
  label: string;
  selected: boolean;
  onChange: (value: string) => void;
  /** Told after the form has the new value. */
  onChosen?: (value: string) => void;
  hint: string;
  testID: string;
}

/** One option: the chip, handed its own value so no render builds a new handler. */
function PaymentChoiceComponent({
  value,
  label,
  selected,
  onChange,
  onChosen,
  hint,
  testID,
}: PaymentChoiceProps) {
  const press = useCallback(() => {
    onChange(value);
    onChosen?.(value);
  }, [onChange, onChosen, value]);

  return (
    <SelectionChip
      label={label}
      selected={selected}
      onPress={press}
      accessibilityHint={hint}
      testID={testID}
    />
  );
}

export const PaymentChoice = memo(PaymentChoiceComponent);

export interface PaymentMethodFieldProps {
  methods: PaymentMethodOption[] | undefined;
  isLoading: boolean;
  loadError: AppError | null;
  onRetry: () => void;
  value: string;
  onChange: (methodId: string) => void;
  /** The field's validation message, beside it (section 49). */
  error?: string;
  /** The form's own prefix: `<testID>-method`, `<testID>-methods`, `<testID>-method-<id>`… */
  testID: string;
}

function PaymentMethodFieldComponent({
  methods,
  isLoading,
  loadError,
  onRetry,
  value,
  onChange,
  error,
  testID,
}: PaymentMethodFieldProps) {
  const theme = useTheme();

  /*
    Each state is keyed, so it replaces the one before rather than updating it:
    a native view that was a busy progress indicator and is reused for the
    chips keeps its busy state (found on the recent-requests list).
  */
  let options: React.ReactNode;
  if (methods && methods.length > 0) {
    options = (
      <View
        key="methods"
        accessibilityRole="radiogroup"
        accessibilityLabel={COPY.methodLabel}
        style={[styles.choices, { gap: theme.spacing.sm }]}
        testID={`${testID}-methods`}>
        {methods.map(method => (
          <PaymentChoice
            key={method.id}
            value={method.id}
            label={method.label}
            selected={value === method.id}
            onChange={onChange}
            hint={COPY.methodHint}
            testID={`${testID}-method-${method.id}`}
          />
        ))}
      </View>
    );
  } else if (isLoading) {
    options = (
      <View
        key="methods-loading"
        accessible
        accessibilityRole="progressbar"
        // Label and busy state together and from the first render.
        accessibilityLabel={COPY.methodsLoading}
        accessibilityState={{ busy: true }}
        testID={`${testID}-methods-loading`}>
        <Skeleton height={theme.hitSlop.minTarget} radiusToken="full" />
      </View>
    );
  } else {
    // Failed — or the service offered none, which a retry is also the answer to.
    const reason = loadError ? `${COPY.methodsFailed} ${loadError.userMessage}` : COPY.methodsNone;
    options = (
      <View
        key="methods-failed"
        style={[styles.start, { gap: theme.spacing.sm }]}
        testID={`${testID}-methods-error`}>
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {reason}
        </Text>
        <SecondaryButton
          label={COPY.methodsRetry}
          icon="retry"
          onPress={onRetry}
          accessibilityHint={COPY.methodsRetryHint}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }} testID={`${testID}-method`}>
      <FieldLabel required>{COPY.methodLabel}</FieldLabel>
      {options}
      {error ? (
        <Text
          variant="caption"
          color="danger"
          accessibilityLiveRegion="polite"
          testID={`${testID}-method-error`}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export const PaymentMethodField = memo(PaymentMethodFieldComponent);

const styles = StyleSheet.create({
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  start: {
    alignItems: 'flex-start',
  },
});
