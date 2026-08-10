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
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { AppConfig } from '@/core/config/AppConfig';
import { useRequestCustomerOtp } from '@/features/auth/hooks/useAuth';
import { customerPhoneSchema, type CustomerPhoneForm } from '@/features/auth/validation/authSchemas';
import {
  Card,
  ErrorState,
  Icon,
  PhoneInput,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Text,
} from '@/shared/components';
import { useTheme } from '@/shared/theme';
import { normalisePhone } from '@/shared/validation/phone';

export function CustomerLoginScreen() {
  const theme = useTheme();

  const {
    mutate: requestOtp,
    data: challenge,
    error,
    isSubmitting,
    reset: clearRequest,
  } = useRequestCustomerOtp();

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
      await requestOtp(normalisePhone(phone));
    },
    [requestOtp],
  );

  const onSubmit = handleSubmit(submit);

  const handleSubmitPress = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  // Returns to the form with the number still typed, so correcting a digit does
  // not mean entering it again.
  const handleChangeNumber = useCallback(() => {
    clearRequest();
  }, [clearRequest]);

  if (challenge) {
    return (
      <Screen scrollable testID="customer-login-screen">
        <View style={[styles.body, { gap: theme.spacing.xxl }]}>
          <Card style={[styles.confirmation, { gap: theme.spacing.md }]}>
            <Icon name="success" size="xxl" color="success" />
            <Text variant="h2" align="center">
              Code sent
            </Text>
            <Text variant="body" color="textSecondary" align="center">
              We have sent a verification code to {challenge.maskedDestination}.
            </Text>
          </Card>

          {/*
            The verification step is the next sub-stage. When it lands this is
            the single seam that changes: navigate to it with `challenge`,
            instead of rendering this confirmation.
          */}

          <SecondaryButton fullWidth label="Use a different number" onPress={handleChangeNumber} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable keyboardAvoiding testID="customer-login-screen">
      <View style={[styles.body, { gap: theme.spacing.xxl }]}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h1" color="primary">
            {AppConfig.app.name}
          </Text>
          <Text variant="body" color="textSecondary">
            Local services, requested in a few taps.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="h2">Sign in</Text>
            <Text variant="body" color="textSecondary">
              Enter your phone number and we will send you a verification code.
            </Text>
          </View>

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value }, fieldState: { error: fieldError } }) => (
              <PhoneInput
                label="Phone number"
                required
                placeholder="Your phone number"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={fieldError?.message}
                editable={!isSubmitting}
                returnKeyType="send"
                onSubmitEditing={handleSubmitPress}
                testID="customer-login-phone"
              />
            )}
          />

          {/*
            No retry handler: the submit button below is the retry, and a second
            primary action would compete with it. The typed number survives the
            failure, so retrying is one tap.
          */}
          <ErrorState error={error} fullScreen={false} testID="customer-login-error" />

          <PrimaryButton
            fullWidth
            label="Send code"
            onPress={handleSubmitPress}
            isLoading={isSubmitting}
            accessibilityHint="Sends a verification code to the number you entered"
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
  confirmation: {
    alignItems: 'center',
  },
});
