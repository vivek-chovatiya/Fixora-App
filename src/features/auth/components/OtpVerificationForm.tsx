/**
 * OtpVerificationForm
 *
 * The one-time code step, shared by customer sign in and vendor onboarding.
 *
 * The two flows differ entirely in what verification *means* — a customer gets a
 * session, a vendor gets an auth code — but the step itself is the same: enter a
 * code, verify, resend after a cooldown, or go back and change the number. This
 * component owns that behaviour so the rules live in one place.
 *
 * There is no verify button. The code is a known length, so the last digit is
 * an unambiguous statement that the user has finished, and asking them to
 * confirm it adds a tap that can only ever be answered one way. What replaces
 * the button as feedback is the animation the code itself performs.
 *
 * A failure is a toast, not a block in the layout. It is transient, it does not
 * describe the screen, and giving it a place in the flow pushed the resend and
 * change-number controls below the fold behind an icon the size of a heading.
 *
 * It owns no service call and reaches no hook of its own. Callers pass the two
 * operations and their state, which is what keeps the flows' different outcomes
 * out of here — and keeps the auth code, which this component never sees, in the
 * screen that asked for it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { AppConfig } from '@/core/config/AppConfig';
import { formatCopy } from '@/features/auth/constants/authCopy';
import { VerificationCodeInput } from '@/features/auth/components/verification/VerificationCodeInput';
import type { VerificationStatus } from '@/features/auth/components/verification/VerificationScene';
import { otpSchema, type OtpForm } from '@/features/auth/validation/authSchemas';
import { SecondaryButton, Text, useErrorToast } from '@/shared/components';
import { useCountdown } from '@/shared/hooks/useCountdown';
import type { OtpChallenge } from '@/shared/services/types/AuthService';
import { useTheme } from '@/shared/theme';
import type { AppError } from '@/shared/types/error';

/** Copy each flow supplies. `resendIn` takes `{seconds}`. */
export interface OtpFormCopy {
  codeLabel: string;
  /** Tells assistive technology that no confirming action is coming. */
  codeHint: string;
  resend: string;
  resendIn: string;
  changeAction: string;
}

export interface OtpVerificationFormProps {
  /** The challenge this attempt started from. Supplies the initial cooldown. */
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
  /** Whichever of the two operations last failed. Surfaced as a toast. */
  error: AppError | null;
  testIDPrefix: string;
}

export function OtpVerificationForm({
  challenge,
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

  const codeLength = AppConfig.otp.length;

  /**
   * Whether the code was accepted.
   *
   * Held here because the caller's reaction to success — a session, an auth code
   * — usually replaces this screen, and the verified state has to be something
   * this component can show on its own rather than something it waits to be told.
   */
  const [isVerified, setIsVerified] = useState(false);

  // Every failure, from either operation, leaves as a toast.
  useErrorToast(error);

  /**
   * How long the verified state stays before the caller moves on.
   *
   * The same token the auth layer holds a session publish for, so a flow that
   * ends in a session and one that ends in a credential pause for equally long.
   */
  const verifiedHoldMs = theme.animation.duration.verifiedHold;

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
  } = useCountdown(challenge.resendAfterSeconds);

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

  const submitCode = useCallback(() => {
    void handleSubmit(submit)();
  }, [handleSubmit, submit]);

  const code = useWatch({ control, name: 'code' });

  const isBusy = isVerifying || isResending;

  /**
   * The code this component has already sent.
   *
   * Without it the effect below would fire again on every unrelated render while
   * a complete code sits in the field — including the render that reports the
   * failure of the attempt it just made.
   */
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (code.length < codeLength) {
      // Re-arms. Editing the code makes the next completion a new attempt, even
      // when the user retypes exactly what was there — which is the only way to
      // retry now that there is no button to press.
      attempted.current = null;
      return;
    }

    // Deliberately not marked as attempted while something else is in flight:
    // the code has not been sent, so it must stay eligible once the operation
    // holding it up has answered.
    if (attempted.current === code || isBusy || isVerified) {
      return;
    }

    attempted.current = code;
    submitCode();
  }, [code, codeLength, isBusy, isVerified, submitCode]);

  const handleResendPress = useCallback(() => {
    void (async () => {
      const next = await onResend();

      if (next) {
        // A replacement may carry a different cooldown, so it comes from the
        // response rather than being assumed.
        startCooldown(next.resendAfterSeconds);
      }
    })();
  }, [onResend, startCooldown]);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Controller
        control={control}
        name="code"
        render={({ field: { onChange, value }, fieldState: { error: fieldError } }) => (
          <VerificationCodeInput
            value={value}
            onChangeText={onChange}
            length={codeLength}
            status={resolveStatus({
              value,
              length: codeLength,
              isVerifying,
              isVerified,
            })}
            accessibilityLabel={copy.codeLabel}
            hint={copy.codeHint}
            error={fieldError?.message}
            editable={!isBusy && !isVerified}
            onSubmitEditing={submitCode}
            testID={`${testIDPrefix}-code`}
          />
        )}
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
 * `entered` is the completed-but-unsent state. It is brief now that submission
 * follows the last keystroke, but it is not dead: it is what the row curls on
 * during the frames before the request is in flight.
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
