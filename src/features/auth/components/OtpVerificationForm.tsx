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
 *
 * The field is VerificationCodeInput, so both flows get the same cells and the
 * same orbit without either screen owning a frame of it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { AppConfig } from '@/core/config/AppConfig';
import { formatCopy } from '@/features/auth/constants/authCopy';
import { VerificationCodeInput } from '@/features/auth/components/verification/VerificationCodeInput';
import type { VerificationStatus } from '@/features/auth/components/verification/VerificationScene';
import { otpSchema, type OtpForm } from '@/features/auth/validation/authSchemas';
import { ErrorState, PrimaryButton, SecondaryButton, Text } from '@/shared/components';
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
  /**
   * Verifies the code.
   *
   * Resolves true only when the code was accepted. The result itself belongs to
   * the caller and is never inspected here — this component needs to know that
   * it succeeded, so it can show the verified state, and nothing more.
   */
  onVerify: (code: string) => Promise<boolean>;
  /** Requests a replacement. Resolves null on failure, per useServiceMutation. */
  onResend: () => Promise<OtpChallenge | null>;
  /** Returns to wherever the destination was entered. */
  onChangeDestination: () => void;
  /**
   * Called once the verified state has been on screen long enough to see.
   *
   * Callers that replace this screen on success should do it here rather than
   * the moment `onVerify` resolves, which lands on the same frame the animation
   * would have started. Must be stable, or the wait restarts on every render.
   */
  onVerified?: () => void;
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
  onVerified,
  isVerifying,
  isResending,
  error,
  testIDPrefix,
}: OtpVerificationFormProps) {
  const theme = useTheme();

  // The challenge belongs to this attempt and nothing outside reads it, so it
  // stays local rather than becoming a global for one consumer.
  const [challenge, setChallenge] = useState(initialChallenge);

  /**
   * Whether the code was accepted.
   *
   * Held here because the caller's reaction to success — a session, an auth code
   * — usually replaces this screen, and the verified state has to be something
   * this component can show on its own rather than something it waits to be told.
   */
  const [isVerified, setIsVerified] = useState(false);

  /**
   * How long the verified state stays before the caller moves on.
   *
   * Long enough to register as an answer, short enough not to feel like the app
   * has stalled after the work is already done. Composed from existing tokens
   * rather than a new one: it is the settle animation plus a beat to read it.
   */
  const verifiedHoldMs = theme.animation.duration.slow + theme.animation.duration.fast;

  useEffect(() => {
    if (!isVerified || !onVerified) {
      return undefined;
    }

    const timer = setTimeout(onVerified, verifiedHoldMs);

    // Cleared on unmount, so a caller that leaves for its own reasons — a tree
    // swap, a back gesture — is never called after it has gone.
    return () => clearTimeout(timer);
  }, [isVerified, onVerified, verifiedHoldMs]);

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
      const accepted = await onVerify(code.trim());

      if (accepted) {
        setIsVerified(true);
      }
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
        render={({ field: { onChange, value }, fieldState: { error: fieldError } }) => (
          <VerificationCodeInput
            value={value}
            onChangeText={onChange}
            length={AppConfig.otp.length}
            status={resolveStatus({
              value,
              length: AppConfig.otp.length,
              isVerifying,
              isVerified,
            })}
            accessibilityLabel={copy.codeLabel}
            error={fieldError?.message}
            editable={!isBusy && !isVerified}
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
        disabled={isResending || isVerified}
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
            disabled={isVerifying || isVerified}
          />
        )}
      </View>

      <SecondaryButton
        fullWidth
        label={copy.changeAction}
        onPress={onChangeDestination}
        disabled={isBusy || isVerified}
      />
    </View>
  );
}

/**
 * Which beat of the animation the code is on.
 *
 * `entered` is the completed-but-unsent state, and it is what makes the row curl
 * on the final keystroke rather than on the network call.
 */
function resolveStatus({
  value,
  length,
  isVerifying,
  isVerified,
}: {
  value: string;
  length: number;
  isVerifying: boolean;
  isVerified: boolean;
}): VerificationStatus {
  if (isVerified) {
    return 'verified';
  }

  if (isVerifying) {
    return 'verifying';
  }

  return value.length >= length ? 'entered' : 'idle';
}

const styles = StyleSheet.create({
  resend: {
    justifyContent: 'center',
  },
});
