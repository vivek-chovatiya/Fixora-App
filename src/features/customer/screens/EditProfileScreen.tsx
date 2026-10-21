/**
 * EditProfileScreen
 *
 * The name and email the account carries (PROJECT_BIBLE.md section 25's "Edit
 * Profile" action; section 26 puts it below Profile as a pushed screen).
 *
 * ⚠️ Editable and read-only are drawn differently, not merely disabled
 * differently. The phone number is a summary row rather than a greyed-out box:
 * a dimmed field invites a tap and then refuses it, while a row that was never
 * a field says what it is on sight. Section 7A makes the number the identity a
 * customer signs in with, so it is not editable here by design, and the help
 * text says why rather than leaving it a mystery.
 *
 * ⚠️ Nothing on this screen changes the saved profile until Save succeeds.
 * `react-hook-form` holds the edits; the session is only written from what the
 * service returns. A refusal therefore leaves both the stored profile and the
 * typed values exactly where they were, and Save can be pressed again.
 *
 * ⚠️ Leaving with unsaved edits asks first (owner decision, 2026-09-29), using
 * the same `ConfirmDialog` that guards logging out — and it asks however the
 * screen is left. The guard sits on `beforeRemove` rather than on the header
 * button, because on Android the hardware back button and the back gesture are
 * how most people leave a screen; a confirmation only the header honoured would
 * look present while being trivially avoidable. An untouched form leaves
 * without a word — a confirmation that fires when there is nothing to lose is
 * how people learn to dismiss confirmations without reading them.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  RequestSummaryBlock,
  RequestSummarySection,
} from '@/features/customer/components/RequestSummary';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useCustomerProfile } from '@/features/customer/hooks/useCustomerProfile';
import { useUpdateProfile } from '@/features/customer/hooks/useUpdateProfile';
import {
  profileSchema,
  type ProfileFormValues,
} from '@/features/customer/validation/profileSchemas';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  Button,
  ConfirmDialog,
  ControlledInput,
  ErrorState,
  Screen,
  Text,
} from '@/shared/components';
import { PROFILE_NAME_MAX_LENGTH } from '@/shared/services/types/ProfileService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.editProfile;

type Props = NativeStackScreenProps<CustomerStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const profile = useCustomerProfile();
  const { mutate: save, isSubmitting, error } = useUpdateProfile();

  const [isDiscarding, setIsDiscarding] = useState(false);

  /*
    Seeded once, from the profile as it stands.

    Deliberately not kept in step with the session afterwards: the session is
    about to change underneath this screen when Save succeeds, and a form that
    re-seeded itself would fight whoever is typing in it.
  */
  const { control, handleSubmit, formState } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      email: profile?.email ?? '',
    },
  });

  /**
   * The leaving this screen is allowed to do without asking.
   *
   * A ref rather than state because the guard below reads it inside a
   * navigation event, which fires before a re-render would reach it.
   */
  const allowLeave = useRef(false);
  /** The navigation this screen interrupted, replayed if the answer is discard. */
  const interrupted = useRef<NavigationAction | null>(null);

  const onSave = useCallback(
    async (values: ProfileFormValues) => {
      const result = await save(values);
      /*
        `useServiceMutation` resolves with null when the service refused. Going
        back on a refusal would hide the failure and quietly discard the edits,
        so the screen stays and the error is drawn above Save.
      */
      if (result !== null) {
        // Saved, so the edits are no longer unsaved and the guard must not ask.
        allowLeave.current = true;
        navigation.goBack();
      }
    },
    [navigation, save],
  );

  const submit = handleSubmit(onSave);

  /*
    Guards every way out, not merely the button in the header.

    On Android the hardware back button and the back gesture are how most
    people leave a screen, and neither goes anywhere near a header control —
    guarding only the button would leave the confirmation looking present while
    being trivially avoidable. `beforeRemove` is the one place all of them meet,
    so the answer is the same whichever way the screen is left.
  */
  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (allowLeave.current || !formState.isDirty || isSubmitting) {
          return;
        }
        event.preventDefault();
        interrupted.current = event.data.action;
        setIsDiscarding(true);
      }),
    [formState.isDirty, isSubmitting, navigation],
  );

  const leave = useCallback(() => navigation.goBack(), [navigation]);

  const confirmDiscard = useCallback(() => {
    setIsDiscarding(false);
    allowLeave.current = true;

    /*
      Replayed rather than assumed to be a goBack: the interrupted navigation
      may have been anything — a tab press, a deep link — and sending the
      customer back one screen instead of where they asked to go would be its
      own small betrayal.
    */
    const action = interrupted.current;
    interrupted.current = null;
    if (action) {
      navigation.dispatch(action);
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const keepEditing = useCallback(() => {
    interrupted.current = null;
    setIsDiscarding(false);
  }, []);

  // Signing out clears the user a moment before this stack unmounts; there is
  // nothing to draw in between.
  if (!profile) {
    return null;
  }

  return (
    <Screen
      scrollable
      keyboardAvoiding
      header={
        <View
          style={[
            styles.bar,
            { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget },
          ]}>
          <BackButton
            onPress={leave}
            accessibilityLabel={CUSTOMER_COPY.profile.title}
            testID="edit-profile-back"
          />
        </View>
      }
      contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      testID="customer-edit-profile">
      <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xs }}>
        <Text variant="hero" accessibilityRole="header" testID="edit-profile-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <ControlledInput
          control={control}
          name="firstName"
          label={COPY.firstNameLabel}
          placeholder={COPY.firstNamePlaceholder}
          required
          autoCapitalize="words"
          autoComplete="given-name"
          maxLength={PROFILE_NAME_MAX_LENGTH}
          testID="edit-profile-first-name"
        />
        <ControlledInput
          control={control}
          name="lastName"
          label={COPY.lastNameLabel}
          placeholder={COPY.lastNamePlaceholder}
          autoCapitalize="words"
          autoComplete="family-name"
          maxLength={PROFILE_NAME_MAX_LENGTH}
          testID="edit-profile-last-name"
        />
        <ControlledInput
          control={control}
          name="email"
          label={COPY.emailLabel}
          placeholder={COPY.emailPlaceholder}
          helperText={COPY.emailHelp}
          // Addresses are case-insensitive and never sentence-cased; the
          // keyboard should not capitalise one on the customer's behalf.
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          testID="edit-profile-email"
        />
      </View>

      {/* Not a field: shown as what it is, with the reason it cannot change. */}
      <RequestSummarySection title={COPY.phoneLabel} testID="edit-profile-identity">
        <RequestSummaryBlock
          label={COPY.phoneLabel}
          value={profile.phone}
          testID="edit-profile-phone"
        />
        <Text variant="caption" color="textSecondary">
          {COPY.phoneHelp}
        </Text>
      </RequestSummarySection>

      <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.xs }}>
        {error ? (
          <ErrorState
            error={error}
            title={COPY.saveFailedTitle}
            fullScreen={false}
            testID="edit-profile-error"
          />
        ) : null}

        <Button
          label={isSubmitting ? COPY.saving : COPY.save}
          onPress={submit}
          isLoading={isSubmitting}
          fullWidth
          accessibilityHint={COPY.saveHint}
        />
      </View>

      <ConfirmDialog
        visible={isDiscarding}
        title={COPY.discardTitle}
        message={COPY.discardMessage}
        cancelLabel={COPY.discardKeep}
        cancelHint={COPY.discardKeepHint}
        confirmLabel={COPY.discardConfirm}
        confirmHint={COPY.discardConfirmHint}
        onCancel={keepEditing}
        onConfirm={confirmDiscard}
        testID="edit-profile-discard-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
});
