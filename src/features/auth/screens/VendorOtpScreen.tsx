/**
 * VendorOtpScreen
 *
 * Vendor onboarding, step two: the vendor enters the code sent to the number
 * they registered (PROJECT_BIBLE.md section 7A.2).
 *
 * The security boundary this screen exists to hold:
 *
 *   verifying the code activates the business and issues a permanent auth code.
 *   It does not sign the vendor in.
 *
 * So nothing here dispatches, writes storage, or routes into the application.
 * `verifyVendorOtp` returns a `VendorAuthCode`, not a `SessionPayload` — the
 * type system enforces it, and this screen must not work around that. A session
 * is created only when the vendor confirms the code they were shown, which is
 * the next step.
 *
 * The auth code is a standing credential. It stays in the mutation state of the
 * hook that fetched it, is never rendered here, and never reaches Redux,
 * storage, logs, analytics or navigation params.
 *
 * Onboarding is identified by `registrationId` throughout. The phone number is
 * never the identity: knowing a number must not be enough to resume someone
 * else's registration.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { OtpVerificationForm } from '@/features/auth/components/OtpVerificationForm';
import { useRequestVendorOtp, useVerifyVendorOtp } from '@/features/auth/hooks/useAuth';
import type { AuthStackParamList } from '@/navigation/types';
import { Card, Icon, Screen, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = AUTH_COPY.vendorOtp;

type Props = NativeStackScreenProps<AuthStackParamList, 'VendorOtp'>;

export function VendorOtpScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { registrationId, challenge } = route.params;

  const {
    mutate: verifyOtp,
    data: issuedCode,
    error: verifyError,
    isSubmitting: isVerifying,
  } = useVerifyVendorOtp();

  const {
    mutate: requestOtp,
    error: resendError,
    isSubmitting: isResending,
  } = useRequestVendorOtp();

  const verify = useCallback(
    (code: string) => verifyOtp(registrationId, code),
    [verifyOtp, registrationId],
  );

  // Re-sends against the same onboarding. It cannot start a new registration:
  // this operation takes a registrationId, not business details.
  const resend = useCallback(() => requestOtp(registrationId), [requestOtp, registrationId]);

  const changeDetails = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (issuedCode) {
    return (
      <Screen scrollable testID="vendor-otp-screen">
        <View style={[styles.body, { gap: theme.spacing.xxl }]}>
          <Card style={[styles.confirmation, { gap: theme.spacing.md }]}>
            <Icon name="verified" size="xxl" color="success" />
            <Text variant="h2" align="center">
              {COPY.verifiedTitle}
            </Text>
            <Text variant="body" color="textSecondary" align="center">
              {COPY.verifiedBody}
            </Text>
          </Card>

          {/*
            The auth code display is the next sub-stage, and it is the only thing
            allowed to render the code. `issuedCode` is held in the hook's
            mutation state and is deliberately not shown here.

            How it reaches that screen is an open decision: it must not travel in
            navigation params. The likely answer is that display and confirmation
            become states of a screen mounted here, so the credential never
            leaves the component that received it.
          */}
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable keyboardAvoiding testID="vendor-otp-screen">
      <View style={[styles.body, { gap: theme.spacing.xxl }]}>
        <Text variant="h1">{COPY.title}</Text>

        <OtpVerificationForm
          challenge={challenge}
          copy={COPY}
          onVerify={verify}
          onResend={resend}
          onChangeDestination={changeDetails}
          isVerifying={isVerifying}
          isResending={isResending}
          error={verifyError ?? resendError}
          testIDPrefix="vendor-otp"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  confirmation: {
    alignItems: 'center',
  },
});
