/**
 * CustomerOtpScreen
 *
 * Step two of customer sign in: the customer enters the code they received, and
 * a successful verification creates the session (PROJECT_BIBLE.md section 7A.1).
 *
 * The code is never the app's to know. It is not seeded, not defaulted, not
 * logged, and not kept anywhere after the call that uses it.
 *
 * The screen does not navigate on success. `useCustomerSignIn` establishes the
 * session, RootNavigator sees an authenticated customer and swaps the tree.
 * Navigating imperatively would make this screen a second source of truth about
 * who is signed in.
 *
 * The field, cooldown and error handling live in OtpVerificationForm, shared
 * with vendor onboarding. What stays here is the part that differs: which
 * service is called, and what a success means.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { OtpVerificationForm } from '@/features/auth/components/OtpVerificationForm';
import { useCustomerSignIn, useRequestCustomerOtp } from '@/features/auth/hooks/useAuth';
import type { AuthStackParamList } from '@/navigation/types';
import { Screen, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = AUTH_COPY.customerOtp;

type Props = NativeStackScreenProps<AuthStackParamList, 'CustomerOtp'>;

export function CustomerOtpScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { phone, challenge } = route.params;

  const { mutate: verifyCode, error: verifyError, isSubmitting: isVerifying } = useCustomerSignIn();

  const {
    mutate: requestOtp,
    error: resendError,
    isSubmitting: isResending,
  } = useRequestCustomerOtp();

  const verify = useCallback(
    // Nothing is done with the result. Success is published through auth state
    // by the thunk behind this hook, and RootNavigator reacts to it.
    (code: string) => verifyCode(phone, code),
    [verifyCode, phone],
  );

  const resend = useCallback(() => requestOtp(phone), [requestOtp, phone]);

  const changeNumber = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <Screen scrollable keyboardAvoiding testID="customer-otp-screen">
      <View style={[styles.body, { gap: theme.spacing.xxl }]}>
        <Text variant="h1">{COPY.title}</Text>

        <OtpVerificationForm
          challenge={challenge}
          copy={COPY}
          onVerify={verify}
          onResend={resend}
          onChangeDestination={changeNumber}
          isVerifying={isVerifying}
          isResending={isResending}
          // Only one can be in flight at a time, so they share one surface.
          error={verifyError ?? resendError}
          testIDPrefix="customer-otp"
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
});
