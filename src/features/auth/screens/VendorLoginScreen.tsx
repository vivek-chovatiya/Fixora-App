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
 * Two faces, one form (PROJECT_BIBLE.md section 7A.2, amended 21/10/2026).
 * Where a vendor has signed in on this device before, the number they used is
 * remembered and the screen opens on "Welcome back": that number masked, the
 * code field alone, and "Use a different number", which forgets it and brings
 * the phone field back.
 * Everywhere else — and whenever the remembered number cannot be read — it is
 * the phone-and-code form it always was. Underneath both is one form: the
 * remembered number fills the phone field the vendor no longer sees, so one
 * schema checks one set of values and a sign in sends the same two things.
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
 * Both values typed here are credentials. Neither is logged, dispatched, or put
 * in navigation params. The code is passed to the service and forgotten with the
 * screen — never stored (PROJECT_BIBLE.md section 7A.2). The phone number is
 * remembered on this device after a successful sign in, by the thunk rather than
 * here, so a refused attempt never replaces a number that worked.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { AppConfig } from '@/core/config/AppConfig';
import { AuthCityscape } from '@/features/auth/components/AuthCityscape';
import { AuthHeading } from '@/features/auth/components/AuthHeading';
import { AuthTopBar } from '@/features/auth/components/AuthTopBar';
import { AUTH_COPY, formatCopy } from '@/features/auth/constants/authCopy';
import {
  maskPhone,
  phoneEnding,
  spellOut,
} from '@/features/auth/constants/vendorAuthPresentation';
import { useRememberedVendorPhone, useVendorSignIn } from '@/features/auth/hooks/useAuth';
import {
  VENDOR_AUTH_CODE_INPUT_MAX_LENGTH,
  normaliseVendorAuthCode,
  vendorLoginSchema,
  type VendorLoginForm,
} from '@/features/auth/validation/authSchemas';
import type { AuthStackParamList } from '@/navigation/types';
import {
  Card,
  ControlledInput,
  Icon,
  Loader,
  PasswordInput,
  PhoneInput,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Text,
  useErrorToast,
} from '@/shared/components';
import { spacing, useTheme } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
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

  const { mutate: signIn, error, isSubmitting } = useVendorSignIn();

  const { phone: rememberedPhone, isReading, forget } = useRememberedVendorPhone();
  const isRemembered = rememberedPhone !== null;

  const { control, handleSubmit, setValue } = useForm<VendorLoginForm>({
    resolver: zodResolver(vendorLoginSchema),
    defaultValues: { phone: '', authCode: '' },
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

  /**
   * The sentence a refused sign in gets, fixed when the attempt is made.
   *
   * State rather than read from `isRemembered` while rendering: "Use a
   * different number" after a refusal would otherwise rebuild the message, and
   * the toast — which tells failures apart by identity — would announce the old
   * failure a second time.
   */
  const [refusal, setRefusal] = useState<string>(COPY.detailsRefused);

  const submit = useCallback(
    // Nothing is done with the session. The thunk behind this hook persists and
    // publishes it; RootNavigator reacts. A failure leaves both fields as they
    // are, so a mistyped character costs one edit rather than a retype.
    async ({ phone, authCode }: VendorLoginForm) => {
      setRefusal(isRemembered ? COPY.codeRefused : COPY.detailsRefused);
      await signIn(normalisePhone(phone), normaliseVendorAuthCode(authCode));
    },
    [signIn, isRemembered],
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
  // number too. The typed code is left alone: the person may well be the same
  // vendor with a new number.
  const handleUseDifferentNumber = useCallback(() => {
    forget();
    setValue('phone', '');
  }, [forget, setValue]);

  /**
   * A refusal reads as the app's sentence; every other failure as the service's.
   *
   * Rebuilt only when a new failure arrives (or a new attempt fixes the
   * sentence, in the same render that clears the old failure), so one failure
   * is one toast.
   */
  const shownError = useMemo(
    () =>
      error?.kind === 'unauthorized'
        ? new AppError({ kind: 'unauthorized', userMessage: refusal })
        : error,
    [error, refusal],
  );

  // Retry is the submit button; both values survive the failure. The message
  // carries itself, needs no heading, and says nothing about which of the two
  // was wrong.
  useErrorToast(shownError);

  const codeHelper = formatCopy(COPY.codeHelper, { length: AppConfig.vendorAuthCode.length });

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
                  editable={!isSubmitting}
                  returnKeyType="next"
                  testID="vendor-login-phone"
                />
              )}

              {/*
                Masked, with the reveal toggle PasswordInput already provides:
                this is a standing credential, entered where a password would be.

                Digits on a number pad, but the ceiling is characters, twice the
                code: a code pasted in groups ("482 913") must fit, and anything
                that is not the code is refused with a reason beside the field
                rather than trimmed by `maxLength` into something that looks
                complete.

                Kept out of autofill, so the OS does not offer to save it as a
                password: the app must not persist this credential, and should
                not prompt it into another store either. `autoComplete="off"`
                does that on Android; on iOS a secure field is taken for a
                password unless it is marked `oneTimeCode`.
              */}
              <ControlledInput
                control={control}
                name="authCode"
                as={PasswordInput}
                label={COPY.codeLabel}
                required
                placeholder={COPY.codePlaceholder}
                helperText={codeHelper}
                revealLabel={COPY.codeReveal}
                hideLabel={COPY.codeHide}
                keyboardType="number-pad"
                maxLength={VENDOR_AUTH_CODE_INPUT_MAX_LENGTH}
                autoComplete="off"
                importantForAutofill="no"
                textContentType="oneTimeCode"
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
