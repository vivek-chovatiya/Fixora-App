/**
 * VendorAuthCodeConfirmation
 *
 * The vendor types back the code they were shown, and only this step creates a
 * session (PROJECT_BIBLE.md section 7A.2).
 *
 * Presentational. It never sees the expected code — it collects input and hands
 * it up. That is what makes it impossible for this component to compare the two
 * locally, which the backend must decide.
 *
 * Validation is completeness only, for the same reason: the code is opaque, so
 * the app has no format to check against.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import {
  vendorAuthCodeSchema,
  type VendorAuthCodeForm,
} from '@/features/auth/validation/authSchemas';
import { ErrorState, Input, PrimaryButton, SecondaryButton, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';
import type { AppError } from '@/shared/types/error';

const COPY = AUTH_COPY.vendorAuthCode;

export interface VendorAuthCodeConfirmationProps {
  onConfirm: (authCode: string) => Promise<unknown>;
  onRegenerate: () => void;
  onBack: () => void;
  isConfirming: boolean;
  isRegenerating: boolean;
  /** Whichever operation last failed. Rendered through userMessage only. */
  error: AppError | null;
}

export function VendorAuthCodeConfirmation({
  onConfirm,
  onRegenerate,
  onBack,
  isConfirming,
  isRegenerating,
  error,
}: VendorAuthCodeConfirmationProps) {
  const theme = useTheme();

  const { control, handleSubmit } = useForm<VendorAuthCodeForm>({
    resolver: zodResolver(vendorAuthCodeSchema),
    defaultValues: { authCode: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submit = useCallback(
    async ({ authCode }: VendorAuthCodeForm) => {
      await onConfirm(authCode.trim());
    },
    [onConfirm],
  );

  const onSubmit = handleSubmit(submit);

  const handleConfirmPress = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  const isBusy = isConfirming || isRegenerating;

  return (
    <View style={{ gap: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">{COPY.confirmTitle}</Text>
        <Text variant="body" color="textSecondary">
          {COPY.confirmBody}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <Controller
          control={control}
          name="authCode"
          render={({ field: { onChange, onBlur, value }, fieldState: { error: fieldError } }) => (
            <Input
              label={COPY.confirmLabel}
              required
              placeholder={COPY.confirmPlaceholder}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={fieldError?.message}
              editable={!isBusy}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleConfirmPress}
              testID="vendor-auth-code-input"
            />
          )}
        />

        {/* Retry is the confirm button; the typed value survives a failure. */}
        <ErrorState error={error} fullScreen={false} testID="vendor-auth-code-error" />

        <PrimaryButton
          fullWidth
          label={COPY.confirmAction}
          onPress={handleConfirmPress}
          isLoading={isConfirming}
          disabled={isRegenerating}
          accessibilityHint={COPY.confirmHint}
        />

        <SecondaryButton
          fullWidth
          label={COPY.back}
          onPress={onBack}
          disabled={isBusy}
        />

        <SecondaryButton
          fullWidth
          label={COPY.regenerate}
          onPress={onRegenerate}
          isLoading={isRegenerating}
          disabled={isConfirming}
          accessibilityHint={COPY.regenerateHint}
        />
      </View>
    </View>
  );
}
