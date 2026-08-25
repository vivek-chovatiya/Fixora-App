/**
 * VendorLoginScreen
 *
 * A returning vendor signs in with their phone number and the permanent auth
 * code they saved during onboarding (PROJECT_BIBLE.md section 7A.2).
 *
 * No one-time code is involved. Onboarding already proved the number, and
 * requiring an OTP on every sign in is not the approved flow. Nothing here
 * registers, re-registers, or regenerates anything: an authentication failure is
 * a failure, not a reason to start onboarding again.
 *
 * Separate from CustomerLogin on purpose. The two roles authenticate by
 * different mechanisms, and one screen branching on role would have to decide
 * which mechanism applies before knowing who is signing in.
 *
 * The screen does not navigate on success. `useVendorSignIn` establishes the
 * session and RootNavigator swaps the tree, so auth state stays the only thing
 * that decides who is signed in.
 *
 * Both values typed here are credentials. Neither is logged, dispatched,
 * persisted, or put in navigation params — they are passed to the service and
 * forgotten with the screen.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { AuthCityscape } from '@/features/auth/components/AuthCityscape';
import { AuthHeading } from '@/features/auth/components/AuthHeading';
import { AuthTopBar } from '@/features/auth/components/AuthTopBar';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { useVendorSignIn } from '@/features/auth/hooks/useAuth';
import {
  VENDOR_AUTH_CODE_MAX_LENGTH,
  vendorLoginSchema,
  type VendorLoginForm,
} from '@/features/auth/validation/authSchemas';
import type { AuthStackParamList } from '@/navigation/types';
import {
  ControlledInput,
  PasswordInput,
  PhoneInput,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Text,
  useErrorToast,
} from '@/shared/components';
import { spacing, useTheme } from '@/shared/theme';
import { capPhoneInput, normalisePhone } from '@/shared/validation/phone';

const COPY = AUTH_COPY.vendorLogin;




type Props = NativeStackScreenProps<AuthStackParamList, 'VendorLogin'>;

export function VendorLoginScreen({ navigation }: Props) {
  const theme = useTheme();

  const { mutate: signIn, error, isSubmitting } = useVendorSignIn();

  const { control, handleSubmit } = useForm<VendorLoginForm>({
    resolver: zodResolver(vendorLoginSchema),
    defaultValues: { phone: '', authCode: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submit = useCallback(
    // Nothing is done with the session. The thunk behind this hook persists and
    // publishes it; RootNavigator reacts. A failure leaves both fields as they
    // are, so a mistyped character costs one edit rather than a retype.
    async ({ phone, authCode }: VendorLoginForm) => {
      await signIn(normalisePhone(phone), authCode);
    },
    [signIn],
  );

  const onSubmit = handleSubmit(submit);

  const handleSubmitPress = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  const handleRegisterPress = useCallback(() => {
    navigation.navigate('VendorRegistration');
  }, [navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Retry is the submit button; both values survive the failure. The message
  // carries itself — "Those sign-in details were not recognised" needs no
  // heading, and says nothing about which of the two was wrong.
  useErrorToast(error);

  return (
    <Screen
      scrollable
      keyboardAvoiding
      // Anchored to the top rather than centred, matching role selection and
      // customer sign in. The container still grows past the viewport and the
      // child still claims no `flex: 1`, which is what keeps the form scrollable
      // once the keyboard shrinks the window.
      contentContainerStyle={styles.content}
      header={<AuthTopBar onBack={handleBack} testID="vendor-login-bar" />}
      // Page padding moved onto the form, because the skyline at the foot runs
      // edge to edge and a padded page cannot let it.
      padded={false}
      testID="vendor-login-screen">
      <View
        style={[
          styles.body,
          {
            gap: theme.spacing.xxxl,
            paddingHorizontal: theme.screenPadding,
            // The same cap the rest of authentication uses.
            maxWidth: theme.maxContentWidth,
          },
        ]}>
        <AuthHeading
          title={COPY.title}
          subtitle={COPY.subtitle}
          testID="vendor-login-heading"
        />

        <View style={{ gap: theme.spacing.lg }}>
          <ControlledInput
            control={control}
            name="phone"
            as={PhoneInput}
            sanitize={capPhoneInput}
            label={COPY.phoneLabel}
            required
            placeholder={COPY.phonePlaceholder}
            editable={!isSubmitting}
            returnKeyType="next"
            testID="vendor-login-phone"
          />

          {/*
            Masked, with the reveal toggle PasswordInput already provides: this
            is a standing credential, and it is entered in the same places a
            password would be. `autoCapitalize` overrides the password default
            because codes are issued in upper case — the value itself is passed
            through untouched, since only the backend knows its format.
          */}
          <ControlledInput
            control={control}
            name="authCode"
            as={PasswordInput}
            label={COPY.codeLabel}
            required
            placeholder={COPY.codePlaceholder}
            helperText={COPY.codeHelper}
            revealLabel={COPY.codeReveal}
            hideLabel={COPY.codeHide}
            // A ceiling on absurdity, not on the format. Characters here rather
            // than digits: the code is opaque, so nothing about its content is
            // assumed.
            maxLength={VENDOR_AUTH_CODE_MAX_LENGTH}
            autoCapitalize="characters"
            editable={!isSubmitting}
            returnKeyType="done"
            onSubmitEditing={handleSubmitPress}
            testID="vendor-login-code"
          />

          <PrimaryButton
            fullWidth
            label={COPY.submit}
            onPress={handleSubmitPress}
            isLoading={isSubmitting}
            accessibilityHint={COPY.submitHint}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="body" color="textSecondary" align="center">
            {COPY.registerPrompt}
          </Text>
          <SecondaryButton
            fullWidth
            label={COPY.registerAction}
            onPress={handleRegisterPress}
            disabled={isSubmitting}
          />
        </View>
      </View>

      {/*
        The same foot as customer sign in, so the two halves of authentication
        read as one product. It takes the slack under the form rather than a
        height of its own, which is what lets it collapse when the keyboard
        shrinks the window instead of pushing the submit button off-screen.
      */}
      <View style={styles.foot} pointerEvents="none">
        <AuthCityscape testID="vendor-login-cityscape" />
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
      Measured against the approved render rather than picked.

      At `xl` the whole content column sat about 18dp high of the reference —
      every internal gap matched, so the only thing out was where the column
      began. This is that gap, closed.
    */
    paddingTop: spacing.huge,
  },
  foot: {
    // Flexes so the artwork sits at the bottom of whatever is left. It cannot
    // push the form: a scroll container's child with `flex: 1` collapses before
    // it overflows, which is what keeps the submit button reachable when the
    // keyboard shrinks the window.
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
