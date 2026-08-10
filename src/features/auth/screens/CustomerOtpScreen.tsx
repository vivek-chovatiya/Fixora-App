/**
 * CustomerOtpScreen
 *
 * Step two of customer sign in: the customer enters the code they received, and
 * a successful verification creates the session (PROJECT_BIBLE.md section 7A.1).
 *
 * Three rules shape this screen.
 *
 * The code is never the app's to know. It is not seeded, not defaulted, not
 * logged, and not kept anywhere after the call that uses it — it lives in form
 * state and is handed straight to the service. The mock's development code stays
 * in the mock.
 *
 * The screen does not navigate on success. `useCustomerSignIn` establishes the
 * session, RootNavigator sees an authenticated customer and swaps the tree.
 * Navigating imperatively would make this screen a second source of truth about
 * who is signed in.
 *
 * Timing comes from the challenge, never from here. `resendAfterSeconds` is the
 * backend's number; the countdown only displays it.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { AppConfig } from '@/core/config/AppConfig';
import { AUTH_COPY, formatCopy } from '@/features/auth/constants/authCopy';
import { useCustomerSignIn, useRequestCustomerOtp } from '@/features/auth/hooks/useAuth';
import { customerOtpSchema, type CustomerOtpForm } from '@/features/auth/validation/authSchemas';
import type { AuthStackParamList } from '@/navigation/types';
import { ErrorState, Input, PrimaryButton, Screen, SecondaryButton, Text } from '@/shared/components';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { useTheme } from '@/shared/theme';

const COPY = AUTH_COPY.customerOtp;

type Props = NativeStackScreenProps<AuthStackParamList, 'CustomerOtp'>;

export function CustomerOtpScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { phone, challenge: initialChallenge } = route.params;

  // Screen-local: the challenge belongs to this verification attempt and nothing
  // outside the screen reads it, so promoting it to Redux would add a global for
  // one consumer (CLAUDE.md section 12).
  const [challenge, setChallenge] = useState(initialChallenge);

  const { secondsRemaining, isRunning: isCoolingDown, start: startCooldown } = useCountdown(
    initialChallenge.resendAfterSeconds,
  );

  const { mutate: verifyCode, error: verifyError, isSubmitting: isVerifying } = useCustomerSignIn();

  const { mutate: requestOtp, error: resendError, isSubmitting: isResending } =
    useRequestCustomerOtp();

  const { control, handleSubmit } = useForm<CustomerOtpForm>({
    resolver: zodResolver(customerOtpSchema),
    defaultValues: { code: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submit = useCallback(
    async ({ code }: CustomerOtpForm) => {
      // Nothing is done with the result. Success is published through auth state
      // by the thunk behind this hook, and RootNavigator reacts to it.
      await verifyCode(phone, code.trim());
    },
    [verifyCode, phone],
  );

  const onSubmit = handleSubmit(submit);

  const handleVerifyPress = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  const handleResendPress = useCallback(() => {
    void (async () => {
      const next = await requestOtp(phone);

      if (next) {
        // The replacement challenge may mask the destination differently or set
        // a different cooldown, so both come from the response.
        setChallenge(next);
        startCooldown(next.resendAfterSeconds);
      }
    })();
  }, [requestOtp, phone, startCooldown]);

  const handleChangeNumber = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const isBusy = isVerifying || isResending;

  // A failed resend matters as much as a failed verification, and only one can
  // be in flight at a time, so they share one surface rather than stacking.
  const error = verifyError ?? resendError;

  // Before sign in there is no session, so `unauthorized` can only mean the code
  // was rejected as expired. Overriding the title here rather than changing the
  // global kind -> title map keeps the correction to the one screen where the
  // default reads wrongly.
  const errorTitle = error?.kind === 'unauthorized' ? COPY.expiredTitle : undefined;

  return (
    <Screen scrollable keyboardAvoiding testID="customer-otp-screen">
      <View style={[styles.body, { gap: theme.spacing.xxl }]}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h1">{COPY.title}</Text>
          <Text variant="body" color="textSecondary">
            {formatCopy(COPY.subtitle, { destination: challenge.maskedDestination })}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Controller
            control={control}
            name="code"
            render={({ field: { onChange, onBlur, value }, fieldState: { error: fieldError } }) => (
              <Input
                label={COPY.codeLabel}
                required
                placeholder={COPY.codePlaceholder}
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
                testID="customer-otp-code"
              />
            )}
          />

          {/* Retry is the verify button itself, as on the phone step. */}
          <ErrorState
            error={error}
            title={errorTitle}
            fullScreen={false}
            testID="customer-otp-error"
          />

          <PrimaryButton
            fullWidth
            label={COPY.submit}
            onPress={handleVerifyPress}
            isLoading={isVerifying}
            disabled={isResending}
            accessibilityHint={COPY.submitHint}
          />

          {/*
            Disabled for the cooldown the backend asked for, and while either
            call is in flight — which is what stops a second request being sent
            before the first has answered.
          */}
          <SecondaryButton
            fullWidth
            label={
              isCoolingDown ? formatCopy(COPY.resendIn, { seconds: secondsRemaining }) : COPY.resend
            }
            onPress={handleResendPress}
            isLoading={isResending}
            disabled={isCoolingDown || isVerifying}
          />

          <SecondaryButton
            fullWidth
            label={COPY.changeNumber}
            onPress={handleChangeNumber}
            disabled={isBusy}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
});
