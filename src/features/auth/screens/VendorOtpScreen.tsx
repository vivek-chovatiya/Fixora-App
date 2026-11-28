/**
 * VendorOtpScreen
 *
 * The last step of vendor registration: verify the phone, and the vendor is
 * created and signed in (owner decision 28/11/2026, phase5-contract.md section
 * 1.2 — supersedes the auth-code steps of PROJECT_BIBLE.md section 7A.2).
 *
 * There used to be two more steps on this route — showing a permanent auth code
 * and confirming it. Both went with the code; there is no credential left to
 * hand between screens, show, copy or regenerate.
 *
 *   verifyVendorOtp   → SessionPayload   (creates the vendor, signs them in)
 *
 * The session is persisted and published by the thunk behind
 * `useCompleteVendorRegistration`, exactly like every other sign in, and
 * RootNavigator swaps the tree on its own. Nothing here navigates into the
 * application.
 *
 * ⚠️ Back to registration stays open until the code is accepted: before then
 * no vendor exists, so going back to fix a detail cannot orphan one. The form
 * locks "Change registration details" from the moment the code is accepted.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthHeading } from '@/features/auth/components/AuthHeading';
import { AuthTopBar } from '@/features/auth/components/AuthTopBar';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { OtpVerificationForm } from '@/features/auth/components/OtpVerificationForm';
import {
  useCompleteVendorRegistration,
  useRequestVendorOtp,
} from '@/features/auth/hooks/useAuth';
import type { AuthStackParamList } from '@/navigation/types';
import { Screen } from '@/shared/components';
import { spacing, useTheme } from '@/shared/theme';

const COPY = AUTH_COPY.vendorOtp;

type Props = NativeStackScreenProps<AuthStackParamList, 'VendorOtp'>;

export function VendorOtpScreen({ route, navigation }: Props) {
  const theme = useTheme();
  // `phone` is never sent with an onboarding call — only remembered once the
  // session exists (navigation/types.ts, `VendorOtp`).
  const { registrationId, phone, challenge } = route.params;

  const {
    mutate: verifyOtp,
    error: verifyOtpError,
    isSubmitting: isVerifyingOtp,
    reset: forgetVerifyFailure,
  } = useCompleteVendorRegistration();

  const { mutate: requestOtp, error: resendError, isSubmitting: isResending } =
    useRequestVendorOtp();

  const handleVerifyOtp = useCallback(
    // Nothing is done with the session. The thunk behind this hook persists and
    // publishes it, and RootNavigator reacts — so this screen never routes into
    // the vendor application. Only whether it arrived is reported back, so the
    // field can show the code as accepted rather than inferring it from silence.
    async (code: string) => {
      const session = await verifyOtp(registrationId, phone, code);

      return session !== null;
    },
    [verifyOtp, registrationId, phone],
  );

  // Takes a handle, not business details, so it cannot start a new registration.
  const handleResendOtp = useCallback(async () => {
    const next = await requestOtp(registrationId);

    if (next) {
      // A replacement is on its way, so "that code is not correct" now describes
      // an attempt against a code that no longer exists. Left alone it sits
      // under a freshly restarted countdown and reads as a new failure. Only
      // the message is dropped — the typed code stays, as on customer sign in.
      forgetVerifyFailure();
    }

    return next;
  }, [requestOtp, registrationId, forgetVerifyFailure]);

  const handleChangeDetails = useCallback(() => {
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
      // The vendor arrives here from registration and should read this as the
      // next step of it rather than a new place. The layout is unchanged from
      // when the auth-code steps shared it; reshaping it is not this change's.
      header={<AuthTopBar testID="vendor-otp-bar" />}
      testID="vendor-otp-screen">
      <View style={[styles.body, { gap: theme.spacing.xxxl, maxWidth: theme.maxContentWidth }]}>
        <AuthHeading title={COPY.title} testID="vendor-otp-heading" />

        <OtpVerificationForm
          challenge={challenge}
          copy={COPY}
          onVerify={handleVerifyOtp}
          onResend={handleResendOtp}
          onChangeDestination={handleChangeDetails}
          isVerifying={isVerifyingOtp}
          isResending={isResending}
          error={verifyOtpError ?? resendError}
          // This flow goes back to the registration form, not to a phone
          // field, so it names that rather than borrowing the other's glyph.
          changeIcon="edit"
          testIDPrefix="vendor-otp"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    // No `justifyContent`: `flexGrow: 1` from Screen still lets this grow past
    // the viewport, so the content scrolls under the keyboard while starting
    // at the top of the screen rather than the middle of it.
    paddingTop: spacing.xl,
  },
  body: {
    // Deliberately no `flex: 1` — see the note on contentContainerStyle above.
    // Fills a phone, caps on a tablet.
    width: '100%',
    alignSelf: 'center',
  },
});
