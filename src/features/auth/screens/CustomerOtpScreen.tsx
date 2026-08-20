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

  const {
    mutate: verifyCode,
    error: verifyError,
    isSubmitting: isVerifying,
    reset: forgetVerifyFailure,
  } = useCustomerSignIn();

  const {
    mutate: requestOtp,
    error: resendError,
    isSubmitting: isResending,
  } = useRequestCustomerOtp();

  const verify = useCallback(
    async (code: string) => {
      // The session itself is not used here. It is published through auth state
      // by the thunk behind this hook, and RootNavigator reacts to it. Only
      // whether it arrived is reported back, so the field can show the code it
      // was given as verified rather than guessing from the absence of an error.
      const session = await verifyCode(phone, code);

      return session !== null;
    },
    [verifyCode, phone],
  );

  const resend = useCallback(async () => {
    const next = await requestOtp(phone);

    if (next) {
      // A replacement is on its way, so "that code is not correct" now describes
      // an attempt against a code that no longer exists. Left alone it sits
      // under a freshly restarted countdown and reads as a new failure. Only
      // the message is dropped — the typed code stays, because clearing a field
      // the user may still be reading from is its own annoyance.
      forgetVerifyFailure();
    }

    return next;
  }, [requestOtp, phone, forgetVerifyFailure]);

  const changeNumber = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <Screen
      scrollable
      keyboardAvoiding
      // Centring belongs to the scroll container rather than to a `flex: 1`
      // child, which could not grow past the viewport and so clipped its
      // overflow with nothing to scroll once the keyboard appeared.
      contentContainerStyle={styles.content}
      testID="customer-otp-screen">
      {/*
        Wordmark, heading and supporting line form one group at the tightest
        spacing, exactly as on sign in — this screen is the second half of that
        flow and should read as a continuation of it rather than a new place.
        The supporting line lives inside the form because the masked destination
        it names is replaced by a successful resend.
      */}
      <View
        style={[styles.body, { gap: theme.spacing.xs, maxWidth: theme.maxContentWidth }]}>
        <Text variant="display" color="primary">
          {AUTH_COPY.brand.wordmark}
        </Text>
        <Text variant="h2">{COPY.title}</Text>

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
  content: {
    justifyContent: 'center',
  },
  body: {
    // Deliberately no `flex: 1` — see the note on contentContainerStyle above.
    // Fills a phone, caps on a tablet.
    width: '100%',
    alignSelf: 'center',
  },
});
