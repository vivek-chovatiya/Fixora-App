/**
 * CustomerLoginScreen
 *
 * Step one of customer sign in: collect a phone number and ask for a one-time
 * code (PROJECT_BIBLE.md section 7A.1).
 *
 * The screen knows nothing about how the code is delivered, whether the number
 * belongs to an account, or what the code will be. It calls one hook and renders
 * the answer — that is the whole of its authority.
 *
 * Layering, unchanged from every other write in the app:
 *
 *   Screen → useRequestCustomerOtp → AuthService interface → implementation
 *
 * No service registry, no storage, no axios, and no branch on a hardcoded code.
 *
 * There is no signup here and no password. The account is created on first
 * successful verification, so signing in and signing up are the same flow.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { AuthCityscape } from '@/features/auth/components/AuthCityscape';
import { AuthHeading } from '@/features/auth/components/AuthHeading';
import { AuthTopBar } from '@/features/auth/components/AuthTopBar';
import { PhoneCountryPrefix } from '@/features/auth/components/PhoneCountryPrefix';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { useRequestCustomerOtp } from '@/features/auth/hooks/useAuth';
import { customerPhoneSchema, type CustomerPhoneForm } from '@/features/auth/validation/authSchemas';
import type { AuthStackParamList } from '@/navigation/types';
import {
  ControlledInput,
  PhoneInput,
  PrimaryButton,
  Screen,
  useErrorToast,
} from '@/shared/components';
import { spacing, useTheme } from '@/shared/theme';
import { capPhoneInput, normalisePhone } from '@/shared/validation/phone';

const COPY = AUTH_COPY.customerLogin;



type Props = NativeStackScreenProps<AuthStackParamList, 'CustomerLogin'>;

export function CustomerLoginScreen({ navigation }: Props) {
  const theme = useTheme();

  const { mutate: requestOtp, error, isSubmitting } = useRequestCustomerOtp();

  // The submit button is the retry: the typed number survives the failure, so
  // trying again is one tap and the message does not need to own any layout.
  useErrorToast(error);

  const { control, handleSubmit } = useForm<CustomerPhoneForm>({
    resolver: zodResolver(customerPhoneSchema),
    defaultValues: { phone: '' },
    // Validating on submit keeps the field quiet while a number is half typed;
    // once it has been corrected once, every keystroke is re-checked.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submit = useCallback(
    async ({ phone }: CustomerPhoneForm) => {
      // Normalised here so the service always receives digits, whatever the
      // user typed. `mutate` resolves null on failure and surfaces the error
      // through `error`, so there is nothing to catch.
      const digits = normalisePhone(phone);
      const challenge = await requestOtp(digits);

      if (challenge) {
        // The number travels with the challenge because verification needs it
        // and the challenge carries no identifier of its own.
        navigation.navigate('CustomerOtp', { phone: digits, challenge });
      }
    },
    [requestOtp, navigation],
  );

  const onSubmit = handleSubmit(submit);

  const handleSubmitPress = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <Screen
      scrollable
      keyboardAvoiding
      // The mark and the way back. The back control was the affordance this
      // stack never drew — the gesture and the hardware button already went
      // there and nothing on the screen said so.
      header={<AuthTopBar onBack={handleBack} testID="customer-login-bar" />}
      // The content is anchored to the top rather than centred in the window.
      // Centred, the brand and the single field it introduces hung in the
      // middle of a tall screen with a void above and below; reading starts at
      // the top, so the form does.
      //
      // What has not changed is where the sizing lives. The container grows and
      // the child does not claim `flex: 1` — a child sized to the viewport
      // cannot make the container taller than it, so once the keyboard shrinks
      // the window the overflow would be clipped with nothing to scroll, which
      // on a 360x640 device hides the submit button.
      contentContainerStyle={styles.content}
      // Page padding moved onto the form, because the skyline at the foot runs
      // edge to edge and a padded page cannot let it.
      padded={false}
      testID="customer-login-screen">
      <View
        style={[
          styles.body,
          {
            gap: theme.spacing.xxxl,
            paddingHorizontal: theme.screenPadding,
            // Same cap as role selection, so the column does not stretch across
            // a tablet and leave a form field a hand's width wide.
            maxWidth: theme.maxContentWidth,
          },
        ]}>
        <AuthHeading
          title={COPY.title}
          subtitle={COPY.subtitle}
          testID="customer-login-heading"
        />

        <View style={{ gap: theme.spacing.lg }}>
          {/*
            The shared binding, so the keyboard, autofill and icon treatment
            PhoneInput encodes are not restated here. Locked while the request
            is in flight: the number stays visible and stays submitted.
          */}
          <ControlledInput
            control={control}
            name="phone"
            as={PhoneInput}
            // Bounded as it is typed rather than only on submit, so the field
            // cannot hold a number it will refuse.
            sanitize={capPhoneInput}
            label={COPY.phoneLabel}
            required
            placeholder={COPY.phonePlaceholder}
            // Which country the app serves, stated in the field rather than
            // assumed. Display only: it is not part of the value and never
            // reaches the service.
            prefix={<PhoneCountryPrefix testID="customer-login-dial-code" />}
            editable={!isSubmitting}
            returnKeyType="send"
            onSubmitEditing={handleSubmitPress}
            testID="customer-login-phone"
          />

          <PrimaryButton
            fullWidth
            label={COPY.submit}
            // An arrow rather than a chevron, and trailing rather than
            // leading: the words say what the button does and the arrow says
            // that doing it moves you on. A chevron here would point at the
            // button's own edge.
            icon="arrowForward"
            iconPosition="trailing"
            onPress={handleSubmitPress}
            isLoading={isSubmitting}
            accessibilityHint={COPY.submitHint}
          />
        </View>
      </View>

      {/*
        Takes the slack under the form rather than a height of its own, so a
        tall screen has no void in it and a short one — or one with the keyboard
        open — gives the space back to the field and the button instead.
      */}
      <View style={styles.foot} pointerEvents="none">
        <AuthCityscape testID="customer-login-cityscape" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    // Deliberately empty of `justifyContent`. `flexGrow: 1` from Screen still
    // lets this grow past the viewport, which is what keeps the form scrollable
    // under the keyboard; the content simply starts at the top of it.
    paddingTop: spacing.xl,
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
