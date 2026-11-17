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
 * Validation is shape only: six digits once spaces and hyphens are removed
 * (owner's decision, 21/10/2026), so a code typed back as it was displayed —
 * "482 913" — or pasted from wherever the vendor saved it is accepted, and
 * anything else is refused beside the field with the reason.
 *
 * It keeps a plain field rather than the cells the one-time code steps use, even
 * now the length is known. Cells strip what is not a digit and stop at the last
 * cell, so a pasted "4829135" would arrive as a complete-looking wrong code and
 * a letter would vanish without a word — where this field says what is wrong.
 * And confirming stays an act, with its own button: the sixth digit is not the
 * vendor saying they saved the code. It shares the verification animation
 * instead: once the code is sent, its digits curl onto the same ring the other
 * two flows use.
 */

import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { AppConfig } from '@/core/config/AppConfig';
import { AUTH_COPY, formatCopy } from '@/features/auth/constants/authCopy';
import {
  VENDOR_AUTH_CODE_INPUT_MAX_LENGTH,
  normaliseVendorAuthCode,
  vendorAuthCodeSchema,
  type VendorAuthCodeForm,
} from '@/features/auth/validation/authSchemas';
import { VerificationScene } from '@/features/auth/components/verification/VerificationScene';
import {
  Input,
  PrimaryButton,
  SecondaryButton,
  Text,
  useErrorToast,
} from '@/shared/components';
import { useTheme } from '@/shared/theme';
import type { AppError } from '@/shared/types/error';

const COPY = AUTH_COPY.vendorAuthCode;

export interface VendorAuthCodeConfirmationProps {
  /**
   * Confirms the code. Resolves true only when it was accepted.
   *
   * The session it produces belongs to the caller and is never inspected here;
   * this component needs to know that it succeeded, so it can show the verified
   * state, and nothing more.
   */
  onConfirm: (authCode: string) => Promise<boolean>;
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

  // Retry is the confirm button; the typed value survives a failure.
  useErrorToast(error);

  /**
   * Whether the code was accepted.
   *
   * The session that follows replaces this screen, so the verified state has to
   * be something this component can show on its own. It needs no timer of its
   * own: the auth layer holds the publish back for exactly as long as this is
   * worth looking at.
   */
  const [isVerified, setIsVerified] = useState(false);

  const { control, handleSubmit } = useForm<VendorAuthCodeForm>({
    resolver: zodResolver(vendorAuthCodeSchema),
    defaultValues: { authCode: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submit = useCallback(
    async ({ authCode }: VendorAuthCodeForm) => {
      // The digits alone, however they were typed or pasted.
      const accepted = await onConfirm(normaliseVendorAuthCode(authCode));

      if (accepted) {
        setIsVerified(true);
      }
    },
    [onConfirm],
  );

  const onSubmit = handleSubmit(submit);

  const handleConfirmPress = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  const isBusy = isConfirming || isRegenerating || isVerified;

  return (
    <View style={{ gap: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">{COPY.confirmTitle}</Text>
        <Text variant="body" color="textSecondary">
          {formatCopy(COPY.confirmBody, { length: AppConfig.vendorAuthCode.length })}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <Controller
          control={control}
          name="authCode"
          render={({ field: { onChange, onBlur, value }, fieldState: { error: fieldError } }) =>
            isConfirming || isVerified ? (
              /*
                The field steps aside for the animation rather than sitting
                disabled beneath it. What orbits is the characters the vendor
                actually typed, so this is the same code being checked and not a
                decoration playing over it — and what settles into the hub at the
                end is that same code, accepted. Its digits, that is: the spaces
                a vendor typed it back with are not part of it and get no node.
              */
              <VerificationScene
                status={isVerified ? 'verified' : 'verifying'}
                characters={Array.from(normaliseVendorAuthCode(value))}
                testID="vendor-auth-code-scene"
              />
            ) : (
              <Input
                label={COPY.confirmLabel}
                required
                placeholder={COPY.confirmPlaceholder}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={fieldError?.message}
                editable={!isBusy}
                keyboardType="number-pad"
                // The same ceiling the returning-vendor form uses, so one field
                // cannot accept a code the other would refuse — room for a code
                // pasted in groups, refused with a reason when it is not one.
                maxLength={VENDOR_AUTH_CODE_INPUT_MAX_LENGTH}
                autoCorrect={false}
                // Out of autofill, and deliberately not `oneTimeCode`: the
                // one-time code sent minutes ago is exactly what the keyboard
                // would offer here, and it is the wrong code.
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
                returnKeyType="done"
                onSubmitEditing={handleConfirmPress}
                testID="vendor-auth-code-input"
              />
            )
          }
        />

        <PrimaryButton
          fullWidth
          label={COPY.confirmAction}
          onPress={handleConfirmPress}
          isLoading={isConfirming}
          disabled={isRegenerating || isVerified}
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
          disabled={isConfirming || isVerified}
          accessibilityHint={COPY.regenerateHint}
        />
      </View>
    </View>
  );
}
