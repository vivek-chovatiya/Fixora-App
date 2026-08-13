/**
 * OtpVerificationForm
 *
 * The one-time code step, shared by customer sign in and vendor onboarding.
 *
 * The two flows differ entirely in what verification *means* — a customer gets a
 * session, a vendor gets an auth code — but the step itself is the same: enter a
 * code, verify, resend after a cooldown, or go back and change the number. This
 * component owns that behaviour so the rules live in one place: the cooldown
 * comes from the challenge, a resend is refused while one is in flight, the
 * error surface is single, and an `unauthorized` failure is titled as an expired
 * code rather than an expired session.
 *
 * It owns no service call and reaches no hook of its own. Callers pass the two
 * operations and their state, which is what keeps the flows' different outcomes
 * out of here — and keeps the auth code, which this component never sees, in the
 * screen that asked for it.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { AppConfig } from '@/core/config/AppConfig';
import { formatCopy } from '@/features/auth/constants/authCopy';
import { otpSchema, type OtpForm } from '@/features/auth/validation/authSchemas';
import { ErrorState, Input, PrimaryButton, SecondaryButton, Text } from '@/shared/components';
import { useCountdown } from '@/shared/hooks/useCountdown';
import type { OtpChallenge } from '@/shared/services/types/AuthService';
import { useTheme } from '@/shared/theme';
import type { AppError } from '@/shared/types/error';

/** Copy each flow supplies. `subtitle` takes `{destination}`, `resendIn` `{seconds}`. */
export interface OtpFormCopy {
  subtitle: string;
  codeLabel: string;
  codePlaceholder: string;
  submit: string;
  submitHint: string;
  resend: string;
  resendIn: string;
  changeAction: string;
  expiredTitle: string;
}

export interface OtpVerificationFormProps {
  /** The challenge this attempt started from. Replaced by a successful resend. */
  challenge: OtpChallenge;
  copy: OtpFormCopy;
  /** Verifies the code. The result belongs to the caller; this never inspects it. */
  onVerify: (code: string) => Promise<unknown>;
  /** Requests a replacement. Resolves null on failure, per useServiceMutation. */
  onResend: () => Promise<OtpChallenge | null>;
  /** Returns to wherever the destination was entered. */
  onChangeDestination: () => void;
  isVerifying: boolean;
  isResending: boolean;
  /** Whichever of the two operations last failed. */
  error: AppError | null;
  testIDPrefix: string;
}

export function OtpVerificationForm({
  challenge: initialChallenge,
  copy,
  onVerify,
  onResend,
  onChangeDestination,
  isVerifying,
  isResending,
  error,
  testIDPrefix,
}: OtpVerificationFormProps) {
  const theme = useTheme();

  // The challenge belongs to this attempt and nothing outside reads it, so it
  // stays local rather than becoming a global for one consumer.
  const [challenge, setChallenge] = useState(initialChallenge);

  const {
    secondsRemaining,
    isRunning: isCoolingDown,
    start: startCooldown,
  } = useCountdown(initialChallenge.resendAfterSeconds);

  const { control, handleSubmit } = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submit = useCallback(
    async ({ code }: OtpForm) => {
      await onVerify(code.trim());
    },
    [onVerify],
  );

  const onSubmit = handleSubmit(submit);

  const handleVerifyPress = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  const handleResendPress = useCallback(() => {
    void (async () => {
      const next = await onResend();

      if (next) {
        // A replacement may mask the destination differently or set a different
        // cooldown, so both come from the response rather than being assumed.
        setChallenge(next);
        startCooldown(next.resendAfterSeconds);
      }
    })();
  }, [onResend, startCooldown]);

  const isBusy = isVerifying || isResending;

  // No session exists at this point in either flow, so `unauthorized` can only
  // mean the code was rejected as expired. Corrected here rather than in the
  // global kind -> title map, which reads correctly everywhere else.
  const errorTitle = error?.kind === 'unauthorized' ? copy.expiredTitle : undefined;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Text variant="body" color="textSecondary">
        {formatCopy(copy.subtitle, { destination: challenge.maskedDestination })}
      </Text>

      <Controller
        control={control}
        name="code"
        render={({ field: { onChange, onBlur, value }, fieldState: { error: fieldError } }) => (
          <Input
            label={copy.codeLabel}
            required
            placeholder={copy.codePlaceholder}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={fieldError?.message}
            editable={!isBusy}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={AppConfig.otp.length}
            returnKeyType="done"
            onSubmitEditing={handleVerifyPress}
            testID={`${testIDPrefix}-code`}
          />
        )}
      />

      {/* Retry is the verify button itself; a second primary action would compete. */}
      <ErrorState
        error={error}
        title={errorTitle}
        fullScreen={false}
        testID={`${testIDPrefix}-error`}
      />

      <PrimaryButton
        fullWidth
        label={copy.submit}
        onPress={handleVerifyPress}
        isLoading={isVerifying}
        disabled={isResending}
        accessibilityHint={copy.submitHint}
      />

      {/*
        The cooldown is status, not a disabled action.

        It used to be the label of a disabled button, which dimmed it with
        `opacity.disabled` — measured at 2.7:1 against the surface, making the
        one line that says when the user may act the least legible text on the
        screen. As plain text it inherits full contrast.

        The slot keeps a touch target's height either way, so the button
        appearing at zero does not shift what is below it. Deliberately not a
        live region: the value changes every second, and announcing each tick
        would talk over the user entering their code.
      */}
      <View style={[styles.resend, { minHeight: theme.hitSlop.minTarget }]}>
        {isCoolingDown ? (
          <Text variant="body" color="textSecondary" align="center">
            {formatCopy(copy.resendIn, { seconds: secondsRemaining })}
          </Text>
        ) : (
          // Disabled only while verifying, which is what stops a second request
          // being sent before the first has answered.
          <SecondaryButton
            fullWidth
            label={copy.resend}
            onPress={handleResendPress}
            isLoading={isResending}
            disabled={isVerifying}
          />
        )}
      </View>

      <SecondaryButton
        fullWidth
        label={copy.changeAction}
        onPress={onChangeDestination}
        disabled={isBusy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  resend: {
    justifyContent: 'center',
  },
});
