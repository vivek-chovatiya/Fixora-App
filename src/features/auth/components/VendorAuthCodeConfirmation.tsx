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
 *
 * That opacity is also why this step keeps a plain field rather than the cells
 * the one-time code steps use. Cells have to be drawn before anything is typed,
 * which means committing to a length — and a length is precisely what the
 * contract does not promise. It shares the verification animation instead: once
 * the code is sent, the characters the vendor typed curl onto the same ring the
 * other two flows use, so the experience matches without the app inventing a
 * shape for a credential it is meant to treat as opaque.
 */

import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import {
  VENDOR_AUTH_CODE_MAX_LENGTH,
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
      const accepted = await onConfirm(authCode.trim());

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
          {COPY.confirmBody}
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
                end is that same code, accepted.
              */
              <VerificationScene
                status={isVerified ? 'verified' : 'verifying'}
                characters={Array.from(value)}
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
                // The same ceiling the returning-vendor form uses, so one field
                // cannot accept a code the other would refuse.
                maxLength={VENDOR_AUTH_CODE_MAX_LENGTH}
                autoCapitalize="characters"
                autoCorrect={false}
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
