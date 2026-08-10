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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { AppConfig } from '@/core/config/AppConfig';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { useRequestCustomerOtp } from '@/features/auth/hooks/useAuth';
import { customerPhoneSchema, type CustomerPhoneForm } from '@/features/auth/validation/authSchemas';
import type { AuthStackParamList } from '@/navigation/types';
import { ErrorState, PhoneInput, PrimaryButton, Screen, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';
import { normalisePhone } from '@/shared/validation/phone';

const COPY = AUTH_COPY.customerLogin;

type Props = NativeStackScreenProps<AuthStackParamList, 'CustomerLogin'>;

export function CustomerLoginScreen({ navigation }: Props) {
  const theme = useTheme();

  const { mutate: requestOtp, error, isSubmitting } = useRequestCustomerOtp();

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

  return (
    <Screen scrollable keyboardAvoiding testID="customer-login-screen">
      <View style={[styles.body, { gap: theme.spacing.xxl }]}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h1" color="primary">
            {AppConfig.app.name}
          </Text>
          <Text variant="body" color="textSecondary">
            {AUTH_COPY.brand.tagline}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="h2">{COPY.title}</Text>
            <Text variant="body" color="textSecondary">
              {COPY.subtitle}
            </Text>
          </View>

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value }, fieldState: { error: fieldError } }) => (
              <PhoneInput
                label={COPY.phoneLabel}
                required
                placeholder={COPY.phonePlaceholder}
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
            label={COPY.submit}
            onPress={handleSubmitPress}
            isLoading={isSubmitting}
            accessibilityHint={COPY.submitHint}
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
