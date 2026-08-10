/**
 * VendorRegistrationScreen
 *
 * Vendor onboarding, step one: business details in, one-time code out
 * (PROJECT_BIBLE.md section 7A.2).
 *
 * What this screen is not allowed to do shapes it more than what it does.
 *
 * It creates no session. `registerVendor` returns a registration handle and a
 * challenge, never a token, so there is no thunk here and nothing reaches Redux.
 * Registering is not signing in.
 *
 * There is no approval step. The vendor is activated automatically once their
 * phone is verified, so nothing here mentions pending, review or approval.
 *
 * It collects exactly the fields `VendorRegistrationDetails` carries. Anything
 * more would be data with nowhere to go.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { ServiceCategoryField } from '@/features/auth/components/ServiceCategoryField';
import { useVendorRegistration } from '@/features/auth/hooks/useAuth';
import {
  VENDOR_BUSINESS_NAME_MAX_LENGTH,
  VENDOR_NAME_MAX_LENGTH,
  vendorRegistrationSchema,
  type VendorRegistrationForm,
} from '@/features/auth/validation/authSchemas';
import type { AuthStackParamList } from '@/navigation/types';
import {
  ControlledInput,
  EmailInput,
  ErrorState,
  PhoneInput,
  PrimaryButton,
  Screen,
  Text,
} from '@/shared/components';
import { useTheme } from '@/shared/theme';
import { normalisePhone } from '@/shared/validation/phone';

const COPY = AUTH_COPY.vendorRegistration;

type Props = NativeStackScreenProps<AuthStackParamList, 'VendorRegistration'>;

export function VendorRegistrationScreen({ navigation }: Props) {
  const theme = useTheme();

  const { mutate: register, error, isSubmitting } = useVendorRegistration();

  const { control, handleSubmit } = useForm<VendorRegistrationForm>({
    resolver: zodResolver(vendorRegistrationSchema),
    defaultValues: {
      businessName: '',
      ownerFirstName: '',
      ownerLastName: '',
      phone: '',
      email: '',
      serviceCategoryIds: [],
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submit = useCallback(
    async (values: VendorRegistrationForm) => {
      // The schema has already trimmed and lowercased. Two things still need
      // doing before this leaves the app: the phone is reduced to digits, and a
      // blank email is sent as absent rather than as an empty string. A failure
      // leaves the form exactly as it is, so nothing typed is lost.
      const registration = await register({
        ...values,
        phone: normalisePhone(values.phone),
        email: values.email === '' ? undefined : values.email,
      });

      if (registration) {
        // `registrationId` is the onboarding identity from here on — the phone
        // number is not carried forward as one. The challenge holds only the
        // masked destination and timings; no code travels in params.
        navigation.navigate('VendorOtp', {
          registrationId: registration.registrationId,
          challenge: registration.challenge,
        });
      }
    },
    [register, navigation],
  );

  const onSubmit = handleSubmit(submit);

  const handleSubmitPress = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  return (
    <Screen scrollable keyboardAvoiding testID="vendor-registration-screen">
      <View style={{ gap: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h1">{COPY.title}</Text>
          <Text variant="body" color="textSecondary">
            {COPY.subtitle}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="overline" color="textTertiary">
            {COPY.businessSection}
          </Text>

          <ControlledInput
            control={control}
            name="businessName"
            label={COPY.businessNameLabel}
            required
            placeholder={COPY.businessNamePlaceholder}
            maxLength={VENDOR_BUSINESS_NAME_MAX_LENGTH}
            editable={!isSubmitting}
            testID="vendor-business-name"
          />
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="overline" color="textTertiary">
            {COPY.contactSection}
          </Text>

          <ControlledInput
            control={control}
            name="ownerFirstName"
            label={COPY.firstNameLabel}
            required
            placeholder={COPY.firstNamePlaceholder}
            maxLength={VENDOR_NAME_MAX_LENGTH}
            editable={!isSubmitting}
            testID="vendor-first-name"
          />

          <ControlledInput
            control={control}
            name="ownerLastName"
            label={COPY.lastNameLabel}
            required
            placeholder={COPY.lastNamePlaceholder}
            maxLength={VENDOR_NAME_MAX_LENGTH}
            editable={!isSubmitting}
            testID="vendor-last-name"
          />

          <ControlledInput
            control={control}
            name="phone"
            as={PhoneInput}
            label={COPY.phoneLabel}
            required
            placeholder={COPY.phonePlaceholder}
            helperText={COPY.phoneHelper}
            editable={!isSubmitting}
            testID="vendor-phone"
          />

          <ControlledInput
            control={control}
            name="email"
            as={EmailInput}
            label={COPY.emailLabel}
            placeholder={COPY.emailPlaceholder}
            helperText={COPY.emailHelper}
            editable={!isSubmitting}
            testID="vendor-email"
          />
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="overline" color="textTertiary">
            {COPY.servicesSection}
          </Text>

          <Controller
            control={control}
            name="serviceCategoryIds"
            render={({ field: { onChange, value }, fieldState: { error: fieldError } }) => (
              <ServiceCategoryField
                label={COPY.categoriesLabel}
                value={value}
                onChange={onChange}
                error={fieldError?.message}
                disabled={isSubmitting}
                testID="vendor-categories"
              />
            )}
          />
        </View>

        {/* Retry is the submit button: the form keeps every value on failure. */}
        <ErrorState error={error} fullScreen={false} testID="vendor-registration-error" />

        <PrimaryButton
          fullWidth
          label={COPY.submit}
          onPress={handleSubmitPress}
          isLoading={isSubmitting}
          accessibilityHint={COPY.submitHint}
        />
      </View>
    </Screen>
  );
}
