/**
 * VendorSignInOtpScreen
 *
 * Step two of vendor sign in: the vendor enters the one-time code they received,
 * and a successful verification creates the session (owner decision 28/11/2026,
 * phase5-contract.md section 1.1 — supersedes the permanent auth code of
 * PROJECT_BIBLE.md section 7A.2).
 *
 * A sibling of CustomerOtpScreen rather than a branch inside it, for the reason
 * VendorLogin is a sibling of CustomerLogin: the two call different services
 * and sign in different roles, and one screen asking "which role is this?"
 * would be deciding something only the route should. The layout is the same on
 * purpose — the same bar, heading, form and foot — so the two flows read as one
 * product. Everything that behaves lives in OtpVerificationForm, shared by both.
 *
 * The code is never the app's to know. It is not seeded, not defaulted, not
 * logged, and not kept anywhere after the call that uses it.
 *
 * The screen does not navigate on success. `useVendorSignIn` establishes the
 * session (and remembers the number on this device), RootNavigator sees an
 * authenticated vendor and swaps the tree.
 *
 * ⚠️ A number with no vendor account is sent here too: the code request answers
 * alike for every number, and its code is refused as a wrong one — the backend
 * has no "not registered" answer, and must not (contract section 1.1). So the
 * way to register is always offered under the form, to everyone, rather than
 * waiting for a not-found that never comes; nothing here may guess which
 * numbers need it.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthCityscape } from '@/features/auth/components/AuthCityscape';
import { AuthHeading } from '@/features/auth/components/AuthHeading';
import { AuthTopBar } from '@/features/auth/components/AuthTopBar';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { OtpVerificationForm } from '@/features/auth/components/OtpVerificationForm';
import { useRequestVendorSignInOtp, useVendorSignIn } from '@/features/auth/hooks/useAuth';
import type { AuthStackParamList } from '@/navigation/types';
import { Screen, SecondaryButton, Text } from '@/shared/components';
import { spacing, useTheme } from '@/shared/theme';

const COPY = AUTH_COPY.vendorSignInOtp;

type Props = NativeStackScreenProps<AuthStackParamList, 'VendorSignInOtp'>;

export function VendorSignInOtpScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { phone, challenge } = route.params;

  const {
    mutate: verifyCode,
    error: verifyError,
    isSubmitting: isVerifying,
    reset: forgetVerifyFailure,
  } = useVendorSignIn();

  const {
    mutate: requestOtp,
    error: resendError,
    isSubmitting: isResending,
  } = useRequestVendorSignInOtp();

  const verify = useCallback(
    async (code: string) => {
      // The session is published through auth state by the thunk behind this
      // hook. Only whether it arrived is reported back, so the field can show
      // the code as verified rather than guessing from the absence of an error.
      const session = await verifyCode(phone, code);

      return session !== null;
    },
    [verifyCode, phone],
  );

  const resend = useCallback(async () => {
    const next = await requestOtp(phone);

    if (next) {
      // "That code is not correct" describes a code that no longer exists once
      // a replacement is on its way. Only the message is dropped — the typed
      // code stays, as on customer sign in.
      forgetVerifyFailure();
    }

    return next;
  }, [requestOtp, phone, forgetVerifyFailure]);

  const changeNumber = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const register = useCallback(() => {
    navigation.navigate('VendorRegistration');
  }, [navigation]);

  return (
    <Screen
      scrollable
      keyboardAvoiding
      // Anchored to the top, as the screen before it; see CustomerOtpScreen for
      // why the container grows and the body claims no `flex: 1`.
      contentContainerStyle={styles.content}
      header={<AuthTopBar onBack={changeNumber} testID="vendor-signin-otp-bar" />}
      // Page padding moved onto the form, because the skyline at the foot runs
      // edge to edge and a padded page cannot let it.
      padded={false}
      testID="vendor-signin-otp-screen">
      <View
        style={[
          styles.body,
          {
            gap: theme.spacing.xxxl,
            paddingHorizontal: theme.screenPadding,
            maxWidth: theme.maxContentWidth,
          },
        ]}>
        <AuthHeading title={COPY.title} testID="vendor-signin-otp-heading" />

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
          // Goes back to a phone field, as the customer's does.
          changeIcon="call"
          testIDPrefix="vendor-signin-otp"
        />

        {/*
          The same prompt and button vendor sign in ends with. Held while a code
          is being checked or sent, so a tap cannot leave mid-request.
        */}
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="body" color="textSecondary" align="center">
            {COPY.registerPrompt}
          </Text>
          <SecondaryButton
            fullWidth
            label={COPY.registerAction}
            onPress={register}
            disabled={isVerifying || isResending}
          />
        </View>
      </View>

      {/* The same foot as vendor sign in; see CustomerOtpScreen for its sizing. */}
      <View style={styles.foot} pointerEvents="none">
        <AuthCityscape testID="vendor-signin-otp-cityscape" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    // The value every auth screen with a top bar uses (DESIGN_CHANGES.md
    // section 5, vertical rhythm).
    paddingTop: spacing.huge,
  },
  foot: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  body: {
    // Deliberately no `flex: 1`. Fills a phone, caps on a tablet.
    width: '100%',
    alignSelf: 'center',
  },
});
