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

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { useVendorSignIn } from '@/features/auth/hooks/useAuth';
import { vendorLoginSchema, type VendorLoginForm } from '@/features/auth/validation/authSchemas';
import type { AuthStackParamList } from '@/navigation/types';
import {
  ControlledInput,
  ErrorState,
  PasswordInput,
  PhoneInput,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Text,
} from '@/shared/components';
import { useTheme } from '@/shared/theme';
import { normalisePhone } from '@/shared/validation/phone';

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

  return (
    <Screen scrollable keyboardAvoiding testID="vendor-login-screen">
      <View style={[styles.body, { gap: theme.spacing.xxl }]}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h1">{COPY.title}</Text>
          <Text variant="body" color="textSecondary">
            {COPY.subtitle}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <ControlledInput
            control={control}
            name="phone"
            as={PhoneInput}
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
            autoCapitalize="characters"
            editable={!isSubmitting}
            returnKeyType="done"
            onSubmitEditing={handleSubmitPress}
            testID="vendor-login-code"
          />

          {/* Retry is the submit button; both values survive the failure. */}
          <ErrorState error={error} fullScreen={false} testID="vendor-login-error" />

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
});
