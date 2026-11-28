/**
 * VendorLoginScreen
 *
 * Step one of a returning vendor's sign in: the phone number a one-time code is
 * sent to (owner decision 28/11/2026, phase5-contract.md section 1.1 —
 * supersedes the permanent auth code of PROJECT_BIBLE.md section 7A.2). The
 * code is entered on VendorSignInOtp, the next screen, exactly as a customer's
 * is.
 *
 * Nothing here registers, re-registers or signs anybody in. The code request
 * answers alike for every well-formed number — with a vendor account or
 * without — so this screen moves on for both, and cannot be used to learn which
 * numbers are vendors. A number with no account is told so only in the way the
 * contract allows: its code is refused as a wrong one.
 *
 * Separate from CustomerLogin on purpose. The two roles reach different
 * services, and one screen branching on role would have to decide which applies
 * before knowing who is signing in.
 *
 * Two faces, one form (PROJECT_BIBLE.md section 7A.2, amended 21/10/2026).
 * Where a vendor has signed in on this device before, the number they used is
 * remembered and the screen opens on "Welcome back": that number masked, "Send
 * code", and "Use a different number", which forgets it and brings the phone
 * field back. Everywhere else — and whenever the remembered number cannot be
 * read — it is the phone form. Underneath both is one form: the remembered
 * number fills the phone field the vendor no longer sees, so one schema checks
 * one value and both faces send the same request.
 *
 * ⚠️ Neither face is drawn until the device has said whether a number is
 * remembered. Drawing the phone field first and swapping it away a moment later
 * would move the form under a vendor's thumb; the read is local and normally
 * finishes inside the push animation, so the wait is never seen. A slow read —
 * a busy device — shows the shared loader in the form's place after
 * `READING_LOADER_DELAY_MS`, so the screen is never blank with no sign of why.
 * The loader is not a face: what replaces it is the one face the read decided.
 *
 * ⚠️ The remembered number fills the hidden phone field in a layout effect, not
 * a passive one, so it is set before the face is painted. A passive effect runs
 * after the paint, and a tap in between would submit an empty phone the vendor
 * cannot see — refused by the form with nothing on screen to fix.
 *
 * The phone number is not logged or dispatched. It travels to the code screen
 * as a param, as the customer's does, because verification needs it; it is
 * remembered on this device only after a successful sign in, by the thunk
 * rather than here, so an attempt that never finished never replaces a number
 * that worked.
 */

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { AuthCityscape } from '@/features/auth/components/AuthCityscape';
import { AuthHeading } from '@/features/auth/components/AuthHeading';
import { AuthTopBar } from '@/features/auth/components/AuthTopBar';
import { AUTH_COPY, formatCopy } from '@/features/auth/constants/authCopy';
import {
  maskPhone,
  phoneEnding,
  spellOut,
} from '@/features/auth/constants/vendorAuthPresentation';
import {
  useRememberedVendorPhone,
  useRequestVendorSignInOtp,
} from '@/features/auth/hooks/useAuth';
import { vendorLoginSchema, type VendorLoginForm } from '@/features/auth/validation/authSchemas';
import type { AuthStackParamList } from '@/navigation/types';
import {
  Card,
  ControlledInput,
  Icon,
  Loader,
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

/**
 * How long the remembered-number read may take before its wait is shown.
 *
 * Long enough that the ordinary read — local, finished inside the push
 * animation — never flashes a spinner for a frame, which reads as a fault;
 * short enough that a slow one is never a blank screen for long.
 */
const READING_LOADER_DELAY_MS = 300;

type Props = NativeStackScreenProps<AuthStackParamList, 'VendorLogin'>;

export function VendorLoginScreen({ navigation }: Props) {
  const theme = useTheme();

  const { mutate: requestOtp, error, isSubmitting } = useRequestVendorSignInOtp();

  // The submit button is the retry: the number survives the failure, so trying
  // again is one tap. Every failure here is the service's own sentence — a
  // rate limit, a code that could not be sent, the network — and none of them
  // says anything about whether the number has an account.
  useErrorToast(error);

  const { phone: rememberedPhone, isReading, forget } = useRememberedVendorPhone();
  const isRemembered = rememberedPhone !== null;

  const { control, handleSubmit, setValue } = useForm<VendorLoginForm>({
    resolver: zodResolver(vendorLoginSchema),
    defaultValues: { phone: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  // The remembered number becomes the phone field's value, unseen. It already
  // passed the shared phone rule on its way into storage, so the field it
  // fills can never fail where nobody can see it — provided it is there before
  // the face can be tapped, which is why this is a layout effect (see above).
  useLayoutEffect(() => {
    if (rememberedPhone !== null) {
      setValue('phone', rememberedPhone);
    }
  }, [rememberedPhone, setValue]);

  // Only a read that outlasts the delay is shown waiting; see the constant.
  const [isReadingSlowly, setIsReadingSlowly] = useState(false);
  useEffect(() => {
    if (!isReading) {
      return undefined;
    }
    const timer = setTimeout(() => setIsReadingSlowly(true), READING_LOADER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isReading]);

  const submit = useCallback(
    async ({ phone }: VendorLoginForm) => {
      // Normalised here so the service always receives digits, whatever was
      // typed. `mutate` resolves null on failure and surfaces the error through
      // `error`, so there is nothing to catch.
      const digits = normalisePhone(phone);
      const challenge = await requestOtp(digits);

      if (challenge) {
        // The number travels with the challenge because verification needs it
        // and the challenge carries no identifier of its own.
        navigation.navigate('VendorSignInOtp', { phone: digits, challenge });
      }
    },
    [requestOtp, navigation],
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

  // Forgotten on the device as well as here, so the next visit asks for a
  // number too.
  const handleUseDifferentNumber = useCallback(() => {
    forget();
    setValue('phone', '');
  }, [forget, setValue]);

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
        {isReading ? (
          isReadingSlowly ? <Loader /> : null
        ) : (
          <>
            <AuthHeading
              title={isRemembered ? COPY.welcomeTitle : COPY.title}
              subtitle={isRemembered ? COPY.welcomeSubtitle : COPY.subtitle}
              testID="vendor-login-heading"
            />

            <View style={{ gap: theme.spacing.lg }}>
              {rememberedPhone !== null ? (
                /*
                  Which account, without the number: masked as the backend
                  masks the numbers it reports, and spoken as its last four
                  digits one at a time. Read-only — changing it is the action
                  below the button, which forgets it on purpose.
                */
                <Card bordered testID="vendor-login-remembered">
                  <View
                    accessible
                    accessibilityLabel={formatCopy(COPY.rememberedPhoneSpoken, {
                      digits: spellOut(phoneEnding(rememberedPhone)),
                    })}
                    style={[styles.rememberedRow, { gap: theme.spacing.md }]}>
                    <Icon name="call" size="md" color="textSecondary" />
                    <Text
                      variant="body"
                      style={styles.rememberedPhone}
                      testID="vendor-login-remembered-phone">
                      {maskPhone(rememberedPhone)}
                    </Text>
                  </View>
                </Card>
              ) : (
                <ControlledInput
                  control={control}
                  name="phone"
                  as={PhoneInput}
                  sanitize={capPhoneInput}
                  label={COPY.phoneLabel}
                  required
                  placeholder={COPY.phonePlaceholder}
                  // Locked while the request is in flight: the number stays
                  // visible and stays submitted.
                  editable={!isSubmitting}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmitPress}
                  testID="vendor-login-phone"
                />
              )}

              <PrimaryButton
                fullWidth
                label={COPY.submit}
                // As customer sign in's "Send code": the words say what the
                // button does and the arrow says that doing it moves you on.
                icon="arrowForward"
                iconPosition="trailing"
                onPress={handleSubmitPress}
                isLoading={isSubmitting}
                accessibilityHint={COPY.submitHint}
              />

              {rememberedPhone !== null ? (
                <SecondaryButton
                  fullWidth
                  label={COPY.useDifferentNumber}
                  // The glyph customer sign in uses for changing its number.
                  icon="call"
                  onPress={handleUseDifferentNumber}
                  disabled={isSubmitting}
                  accessibilityHint={COPY.useDifferentNumberHint}
                />
              ) : null}
            </View>

            {/*
              Registration belongs to the full form. A returning vendor is not
              offered it; somebody else on this device reaches it in one tap,
              through "Use a different number".
            */}
            {rememberedPhone !== null ? null : (
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
            )}
          </>
        )}
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
  rememberedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberedPhone: {
    // A definite width in the row, so a large font scale wraps the number
    // rather than clipping it (WORKING_NOTES section 11, 3E-3).
    flex: 1,
  },
});
