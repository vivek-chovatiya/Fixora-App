import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { VendorStackParamList } from '@/app/navigation/types';
import { Banner, ChipGroup, ErrorState, Loader, PrimaryButton, Screen, Text, TextField, useToast } from '@/shared/components';
import { useAppMeta } from '@/shared/hooks/useAppMeta';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { strings } from '@/shared/i18n/strings';
import { requestApi, type CompleteWorkPayload } from '@/shared/services/api';
import { Analytics } from '@/shared/services/analytics';
import { useTheme } from '@/shared/theme';

type Props = NativeStackScreenProps<VendorStackParamList, 'CompleteWork'>;
type Field = 'amount' | 'method';

/** Records the offline payment. Fixora never processes the money (§36–37). */
export function CompleteWorkScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { id, requestNumber, estimatedAmount } = route.params;
  const meta = useAppMeta();
  const [amount, setAmount] = useState(estimatedAmount ? String(estimatedAmount) : '');
  const [method, setMethod] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('PAID');
  const [notes, setNotes] = useState('');
  const errors = useFormErrors<Field>();
  const complete = useServiceMutation((payload: CompleteWorkPayload) => requestApi.complete(id, payload));

  const onSubmit = async () => {
    const value = Number(amount);
    const next = {
      amount: amount.trim() && Number.isFinite(value) && value >= 0 ? undefined : 'Enter the final amount.',
      method: method ? undefined : 'Select how the customer paid.',
    };
    errors.setErrors(next);
    if (next.amount || next.method) return;
    const result = await complete.mutate({ finalAmount: value, paymentMethod: method!, paymentStatus: status, completionNotes: notes.trim() });
    if (result) {
      Analytics.track('work_completed', { id });
      toast.show('Work completed and payment recorded.');
      navigation.goBack();
    }
  };

  if (meta.isLoading) return <Loader fullScreen />;
  if (meta.error) return <ErrorState error={meta.error} onRetry={meta.retry} />;

  return (
    <Screen testID="complete-work-screen" footer={<PrimaryButton testID="complete-submit" label="Mark as completed" onPress={onSubmit} loading={complete.isSubmitting} />}>
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="overline" color="textTertiary">
          {requestNumber}
        </Text>
        <Text variant="h2">Complete the job</Text>
      </View>
      <Banner icon="info" title="Payment recorded, not processed" message={strings.payment.offlineNote} />
      {complete.error ? <Banner tone="danger" icon="error" message={complete.error.userMessage} /> : null}
      <TextField
        testID="complete-amount"
        label="Final amount (₹)"
        keyboardType="numeric"
        value={amount}
        onChangeText={value => {
          setAmount(value);
          errors.edited('amount');
        }}
        error={errors.errorFor('amount')}
      />
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textSecondary">
          Payment method
        </Text>
        <ChipGroup
          options={meta.data?.paymentMethods ?? []}
          value={method}
          onChange={value => {
            setMethod(value);
            errors.edited('method');
          }}
          testIDPrefix="payment-method"
        />
        {errors.errorFor('method') ? (
          <Text variant="caption" color="danger">
            {errors.errorFor('method')}
          </Text>
        ) : null}
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textSecondary">
          Payment status
        </Text>
        <ChipGroup options={meta.data?.paymentStatuses ?? []} value={status} onChange={setStatus} testIDPrefix="payment-status" />
      </View>
      <TextField testID="complete-notes" label="Completion notes" optional multiline value={notes} onChangeText={setNotes} placeholder="What was done, parts replaced…" />
    </Screen>
  );
}
