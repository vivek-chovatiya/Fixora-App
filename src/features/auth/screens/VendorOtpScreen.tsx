/**
 * VendorOtpScreen
 *
 * The whole of vendor onboarding after registration, in one mounted screen:
 * verify the phone, receive the permanent auth code, save it, confirm it
 * (PROJECT_BIBLE.md section 7A.2).
 *
 * Three steps, one route. That is a security decision, not a layout one. The
 * auth code is a standing credential, and separate routes would mean handing it
 * between screens — through navigation params, a store, or storage, each of
 * which is a place it must never be. Keeping the steps local means the code
 * lives in one component's state, for as long as that component is mounted, and
 * nowhere else.
 *
 * The boundary this screen holds:
 *
 *   verifyVendorOtp        → VendorAuthCode   (activates the business)
 *   verifyVendorAuthCode   → SessionPayload   (signs the vendor in)
 *
 * Verifying the phone does not sign anyone in. Only confirmation does, and it
 * does so through the existing thunk — so the session is persisted and published
 * exactly like every other sign in, and RootNavigator swaps the tree on its own.
 * Nothing here navigates into the application.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getClipboard } from '@/core/clipboard/Clipboard';
import { createLogger } from '@/core/logger/Logger';
import { AuthHeading } from '@/features/auth/components/AuthHeading';
import { AuthTopBar } from '@/features/auth/components/AuthTopBar';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { OtpVerificationForm } from '@/features/auth/components/OtpVerificationForm';
import { VendorAuthCodeConfirmation } from '@/features/auth/components/VendorAuthCodeConfirmation';
import { VendorAuthCodeDisplay } from '@/features/auth/components/VendorAuthCodeDisplay';
import {
  useConfirmVendorAuthCode,
  useRegenerateVendorAuthCode,
  useRequestVendorOtp,
  useVerifyVendorOtp,
} from '@/features/auth/hooks/useAuth';
import type { AuthStackParamList } from '@/navigation/types';
import { Screen } from '@/shared/components';
import type { VendorAuthCode } from '@/shared/services/types/AuthService';
import { spacing, useTheme } from '@/shared/theme';

const COPY = AUTH_COPY.vendorOtp;


const log = createLogger('VendorOnboarding');

/** Where the vendor is in onboarding. Local, and gone when the screen unmounts. */
type OnboardingStep = 'otp' | 'authCodeDisplay' | 'authCodeConfirm';

type Props = NativeStackScreenProps<AuthStackParamList, 'VendorOtp'>;

export function VendorOtpScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { registrationId, challenge } = route.params;

  const [step, setStep] = useState<OnboardingStep>('otp');

  /**
   * The credential, for as long as this screen is mounted.
   *
   * Regeneration replaces it outright rather than keeping a history: the
   * previous code is revoked the moment a new one is issued, and holding a dead
   * credential serves nothing.
   */
  const [authCode, setAuthCode] = useState<VendorAuthCode | null>(null);

  const {
    mutate: verifyOtp,
    error: verifyOtpError,
    isSubmitting: isVerifyingOtp,
    reset: forgetVerifyFailure,
  } = useVerifyVendorOtp();

  const { mutate: requestOtp, error: resendError, isSubmitting: isResending } =
    useRequestVendorOtp();

  const { mutate: regenerate, error: regenerateError, isSubmitting: isRegenerating } =
    useRegenerateVendorAuthCode();

  const { mutate: confirmCode, error: confirmError, isSubmitting: isConfirming } =
    useConfirmVendorAuthCode();

  /**
   * Once a code has been issued, going back would return to registration and
   * risk a second registration for a vendor already activated — orphaning this
   * one. The steps after the code exists are therefore a one-way door.
   *
   * This guards the gesture and the Android back button, which are the only ways
   * back: the stack shows no header.
   */
  const isCommitted = authCode !== null;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isCommitted });

    if (!isCommitted) {
      return undefined;
    }

    return navigation.addListener('beforeRemove', event => {
      event.preventDefault();
      log.info('Blocked leaving vendor onboarding after activation');
    });
  }, [navigation, isCommitted]);

  /* Step one: the one-time code --------------------------------------------- */

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      const issued = await verifyOtp(registrationId, code);

      if (issued) {
        // Activation, not authentication. There is no session at this point and
        // nothing is dispatched or persisted.
        //
        // The code is taken now rather than after the animation: it exists from
        // this moment, and `isCommitted` is what closes the door back to
        // registration. Waiting would leave a window where the business is
        // active and the back gesture still says otherwise.
        setAuthCode(issued);
      }

      // Reports acceptance, not the credential. The code itself stays in this
      // screen's state, and the form that asked is never handed it.
      return issued !== null;
    },
    [verifyOtp, registrationId],
  );

  /**
   * Moving on is what waits, not the verification and not the credential.
   *
   * Nothing here is a session: verifying the phone activates the business and
   * returns a code, so this step is free to hold on screen for a moment without
   * any of the questions a delayed sign in would raise. The other two flows do
   * not have that freedom.
   */
  const handleOtpVerified = useCallback(() => {
    setStep('authCodeDisplay');
  }, []);

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

  /* Step two: the code is shown --------------------------------------------- */

  const handleCopy = useCallback(async (): Promise<boolean> => {
    if (!authCode) {
      return false;
    }

    try {
      // Copying is all this does. It proves nothing and authenticates nobody.
      await getClipboard().copy(authCode.code);
      return true;
    } catch {
      // The failure is reported to the vendor by the display component. It is
      // not logged, because the only interesting detail would be the value.
      return false;
    }
  }, [authCode]);

  const handleContinueToConfirm = useCallback(() => {
    setStep('authCodeConfirm');
  }, []);

  /* Step three: the vendor confirms it -------------------------------------- */

  const handleConfirm = useCallback(
    // Nothing is done with the session. The thunk behind this hook persists and
    // publishes it, and RootNavigator reacts — so this screen never routes into
    // the vendor application.
    //
    // Only whether it arrived is reported back, so the field can show the code
    // it was given as accepted rather than inferring it from silence.
    async (enteredCode: string) => {
      const session = await confirmCode(registrationId, enteredCode);

      return session !== null;
    },
    [confirmCode, registrationId],
  );

  const handleRegenerate = useCallback(() => {
    void (async () => {
      const replacement = await regenerate(registrationId);

      if (replacement) {
        // The previous code stopped working the moment this resolved, so the
        // vendor is sent back to see, save and confirm the new one explicitly.
        setAuthCode(replacement);
        setStep('authCodeDisplay');
      }
    })();
  }, [regenerate, registrationId]);

  const handleShowCodeAgain = useCallback(() => {
    setStep('authCodeDisplay');
  }, []);

  /* Render ------------------------------------------------------------------ */

  return (
    <Screen
      scrollable
      keyboardAvoiding
      // Anchored to the top, as the screen before it. The container still grows
      // past the viewport and the child still claims no `flex: 1`, which is what
      // keeps the code field reachable once the keyboard appears.
      contentContainerStyle={styles.content}
      /*
        The bar stays across all three steps; the heading belongs to the first
        one only.

        The vendor arrives here from registration and should read this as the
        next step of it rather than a new place, so the bar cannot come and go
        between steps. But the two steps after this one are the auth-code UI,
        which titles itself — putting "Verify your business number" above a
        screen showing an auth code would simply be wrong, and re-titling for
        them would be redesigning them ahead of their turn.
      */
      header={<AuthTopBar testID="vendor-otp-bar" />}
      testID="vendor-otp-screen">
      <View
        style={[styles.body, { gap: theme.spacing.xs, maxWidth: theme.maxContentWidth }]}>
        {step === 'otp' ? (
          // Its own gap: the body's is tuned for the auth-code steps, and four
          // points between a 34px heading and the form under it is not a gap.
          <View style={{ gap: theme.spacing.xxxl }}>
            <AuthHeading title={COPY.title} testID="vendor-otp-heading" />

            <OtpVerificationForm
              challenge={challenge}
              copy={COPY}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onChangeDestination={handleChangeDetails}
              onVerified={handleOtpVerified}
              isVerifying={isVerifyingOtp}
              isResending={isResending}
              error={verifyOtpError ?? resendError}
              // This flow goes back to the registration form, not to a phone
              // field, so it names that rather than borrowing the other's glyph.
              changeIcon="edit"
              testIDPrefix="vendor-otp"
            />
          </View>
        ) : null}

        {step === 'authCodeDisplay' && authCode ? (
          <VendorAuthCodeDisplay
            code={authCode.code}
            onCopy={handleCopy}
            onContinue={handleContinueToConfirm}
          />
        ) : null}

        {step === 'authCodeConfirm' ? (
          <VendorAuthCodeConfirmation
            onConfirm={handleConfirm}
            onRegenerate={handleRegenerate}
            onBack={handleShowCodeAgain}
            isConfirming={isConfirming}
            isRegenerating={isRegenerating}
            error={confirmError ?? regenerateError}
          />
        ) : null}
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
