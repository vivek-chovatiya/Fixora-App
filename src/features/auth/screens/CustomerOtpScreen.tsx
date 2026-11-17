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

import { AuthCityscape } from '@/features/auth/components/AuthCityscape';
import { AuthHeading } from '@/features/auth/components/AuthHeading';
import { AuthTopBar } from '@/features/auth/components/AuthTopBar';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { OtpVerificationForm } from '@/features/auth/components/OtpVerificationForm';
import { useCustomerSignIn, useRequestCustomerOtp } from '@/features/auth/hooks/useAuth';
import type { AuthStackParamList } from '@/navigation/types';
import { Screen } from '@/shared/components';
import { spacing, useTheme } from '@/shared/theme';

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
      // Anchored to the top, as the screen before it. The container still grows
      // past the viewport and the child still claims no `flex: 1`, which is what
      // keeps the code field reachable once the keyboard appears.
      contentContainerStyle={styles.content}
      /*
        The same bar as sign in, because this is the second half of that flow
        and should read as a continuation of it rather than a new place.

        It carries the back control now. That is not a new way out — the
        hardware back gesture and "Change phone number" have always led to the
        same place — but it is the first one visible without reading to the
        bottom of the screen, which is where a mistyped number is noticed.
      */
      header={<AuthTopBar onBack={changeNumber} testID="customer-otp-bar" />}
      // Page padding moved onto the form, because the skyline at the foot runs
      // edge to edge and a padded page cannot let it.
      padded={false}
      testID="customer-otp-screen">
      <View
        style={[
          styles.body,
          {
            gap: theme.spacing.xxxl,
            paddingHorizontal: theme.screenPadding,
            maxWidth: theme.maxContentWidth,
          },
        ]}>
        {/*
          No subtitle: the supporting line names the masked destination, which a
          successful resend replaces, so it belongs to the form that owns that
          value rather than to the heading above it.
        */}
        <AuthHeading title={COPY.title} testID="customer-otp-heading" />

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
          // Names where the button goes back to. The vendor flow returns to a
          // registration form and says so with its own glyph.
          changeIcon="call"
          testIDPrefix="customer-otp"
        />
      </View>

      {/*
        The same foot as sign in, so the two halves of the flow read as one
        screen the user is moving through rather than two places.

        It takes the slack under the form rather than a height of its own, which
        is what lets it collapse when the keyboard opens instead of pushing the
        code field off-screen — and on this screen the keyboard opens by itself.
      */}
      <View style={styles.foot} pointerEvents="none">
        <AuthCityscape testID="customer-otp-cityscape" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    // No `justifyContent`: `flexGrow: 1` from Screen still lets this grow past
    // the viewport, so the content scrolls under the keyboard while starting
    // at the top of the screen rather than the middle of it.
    /*
      Measured against the reference and against the screens either side of it.

      At `xl` the heading began about 50dp below the centre of the brand mark,
      where sign in and registration both begin at 70 — so the one screen in the
      middle of the flow crowded its own bar. `huge` is the value those screens
      already use.
    */
    paddingTop: spacing.huge,
  },
  foot: {
    // Flexes so the artwork sits at the bottom of whatever is left. A scroll
    // container's child with `flex: 1` collapses before it overflows, which is
    // what keeps the code field reachable once the keyboard has taken half the
    // window.
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  body: {
    // Deliberately no `flex: 1` — see the note on contentContainerStyle above.
    // Fills a phone, caps on a tablet.
    width: '100%',
    alignSelf: 'center',
  },
});
