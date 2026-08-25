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
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { AuthCityscape } from '@/features/auth/components/AuthCityscape';
import { AuthHeading } from '@/features/auth/components/AuthHeading';
import { AuthTopBar } from '@/features/auth/components/AuthTopBar';
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
  PhoneInput,
  PrimaryButton,
  Screen,
  Text,
  useErrorToast,
} from '@/shared/components';
import { spacing, useTheme } from '@/shared/theme';
import { capPhoneInput, normalisePhone } from '@/shared/validation/phone';

const COPY = AUTH_COPY.vendorRegistration;


type Props = NativeStackScreenProps<AuthStackParamList, 'VendorRegistration'>;

export function VendorRegistrationScreen({ navigation }: Props) {
  const theme = useTheme();

  const { mutate: register, error, isSubmitting } = useVendorRegistration();

  // Retry is the submit button: the form keeps every value on failure.
  useErrorToast(error);

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

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <Screen
      scrollable
      keyboardAvoiding
      // The way back matters most here: this is the longest form in the app and
      // the easiest to open by mistake.
      header={<AuthTopBar onBack={handleBack} testID="vendor-registration-bar" />}
      contentContainerStyle={styles.content}
      // Page padding moved onto the form, because the skyline at the foot runs
      // edge to edge and a padded page cannot let it.
      padded={false}
      testID="vendor-registration-screen">
      {/*
        Top-aligned rather than centred, unlike the short auth screens: a form
        this long always exceeds the viewport, so centring it would only push
        the first field under the fold.
      */}
      <View
        style={[
          styles.body,
          {
            gap: theme.spacing.xxl,
            paddingHorizontal: theme.screenPadding,
            maxWidth: theme.maxContentWidth,
          },
        ]}>
        <AuthHeading
          title={COPY.title}
          subtitle={COPY.subtitle}
          testID="vendor-registration-heading"
        />

        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="overline" color="textSecondary">
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
          <Text variant="overline" color="textSecondary">
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
            sanitize={capPhoneInput}
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
          <Text variant="overline" color="textSecondary">
            {COPY.servicesSection}
          </Text>

          <Controller
            control={control}
            name="serviceCategoryIds"
            render={({ field: { onChange, value }, fieldState: { error: fieldError } }) => (
              <ServiceCategoryField
                label={COPY.categoriesLabel}
                required
                value={value}
                onChange={onChange}
                error={fieldError?.message}
                disabled={isSubmitting}
                testID="vendor-categories"
              />
            )}
          />
        </View>

        <PrimaryButton
          fullWidth
          label={COPY.submit}
          onPress={handleSubmitPress}
          isLoading={isSubmitting}
          accessibilityHint={COPY.submitHint}
        />
      </View>

      {/*
        The same foot as both sign-in screens, so registration is not the one
        auth screen that ends on a bare page. It takes the slack under the form
        rather than a height of its own, which is what lets it collapse when the
        keyboard shrinks the window instead of pushing Continue off-screen — and
        on this form, the longest in the app, there is usually no slack at all.
      */}
      <View style={styles.foot} pointerEvents="none">
        <AuthCityscape testID="vendor-registration-cityscape" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    /*
      Measured against the reference rather than picked.

      With the page's own padding the heading began 45dp below the centre of the
      brand mark, against 65dp in the reference and 70dp on vendor sign in — the
      one screen in the flow whose heading crowded the bar above it. `huge` is
      the value the sign-in screens already use, so this closes the gap and ends
      the inconsistency with the same number.
    */
    paddingTop: spacing.huge,
  },
  foot: {
    /*
      `flexGrow` rather than `flex`.

      The sign-in screens use `flex: 1` here so the artwork collapses before the
      page overflows, which keeps their submit button on screen without a
      scroll. That trade only works on a form short enough to fit. This one
      never is: with `flex: 1` the foot was handed no slack to grow into and,
      having a zero basis and being allowed to shrink, it rendered as a sliver
      of sky.

      Growing without shrinking keeps the drawing its own height and still lets
      it drop to the bottom of the page on a tall screen. Nothing above it
      moves, because it is the last thing on the page — Continue is already
      above it, and both are reached the same way: by scrolling, which this form
      requires regardless.
    */
    flexGrow: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  body: {
    // Fills a phone, caps on a tablet.
    width: '100%',
    alignSelf: 'center',
  },
});
