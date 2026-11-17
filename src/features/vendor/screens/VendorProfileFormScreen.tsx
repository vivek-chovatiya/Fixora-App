/**
 * VendorProfileFormScreen
 *
 * The vendor's business profile form (PROJECT_BIBLE.md section 38; Phase 3E-1).
 * One form, two routes:
 *
 * - `VendorProfileSetup` — the only screen a vendor sees until setup is saved.
 *   No back control (there is nowhere to go back to) and a quiet Sign out, so a
 *   vendor who signed in on the wrong account is not trapped behind a form.
 * - `EditVendorProfile` — the same form, opened from the Profile tab, with a
 *   back control and a discard guard.
 *
 * ⚠️ Saving never navigates in setup. The service answers with the stored
 * profile, the provider adopts it, and the navigator — reading
 * `isSetupComplete` — swaps setup for the vendor application by itself. Editing
 * goes back once saved, as Edit Profile does.
 *
 * ⚠️ Contact details are shown, not asked for. The owner's name, phone and email
 * are the account's (they were proven at registration); the form reads them from
 * the profile and has no field that could change them.
 *
 * ⚠️ The photo uploads when it is chosen, through `useImageUpload` — the same
 * pipeline as the customer's avatar — but it is saved with the form. Until Save,
 * the uploaded URL is only a value in this form, so leaving without saving
 * leaves the profile's picture exactly as it was. Its card is `PhotoField`,
 * which the team member form shares (Phase 3G-4).
 *
 * The contact details show the phone formatted ("+91 90000 00001",
 * `formatPhone`, owner decision 21/10/2026) — display only; nothing here sends
 * it anywhere.
 *
 * A failed save keeps every value; Save is the retry. Leaving the edit form with
 * unsaved changes asks first, through `beforeRemove` so the Android back button
 * and the back gesture are guarded too.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { useSignOut } from '@/features/auth/hooks/useAuth';
import { PhotoField } from '@/features/vendor/components/PhotoField';
import { ProfileDetailRow } from '@/features/vendor/components/ProfileDetailRow';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useSaveVendorProfile } from '@/features/vendor/hooks/useSaveVendorProfile';
import { useVendorProfile } from '@/features/vendor/state/VendorProfileContext';
import {
  buildVendorProfileUpdate,
  vendorProfileSchema,
  type VendorProfileForm,
} from '@/features/vendor/validation/vendorProfileSchema';
import type { VendorStackParamList } from '@/navigation/types';
import {
  BackButton,
  Card,
  ConfirmDialog,
  ControlledInput,
  ErrorState,
  PrimaryButton,
  Screen,
  SecondaryButton,
  ServiceCategoryField,
  Text,
} from '@/shared/components';
import { useImageUpload } from '@/shared/hooks/useImageUpload';
import { formatPhone } from '@/shared/presentation/phone';
import {
  VENDOR_BUSINESS_NAME_MAX_LENGTH,
  VENDOR_DESCRIPTION_MAX_LENGTH,
  VENDOR_SERVICE_AREA_MAX_LENGTH,
  type VendorProfile,
} from '@/shared/services/types/VendorProfileService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.profileForm;

type Props = NativeStackScreenProps<
  VendorStackParamList,
  'VendorProfileSetup' | 'EditVendorProfile'
>;

function formValuesOf(profile: VendorProfile): VendorProfileForm {
  return {
    businessName: profile.businessName,
    description: profile.description ?? '',
    serviceCategoryIds: profile.serviceCategoryIds,
    serviceArea: profile.serviceArea?.description ?? '',
  };
}

export function VendorProfileFormScreen(props: Props) {
  const { profile } = useVendorProfile();

  // The navigator only mounts this once the profile has loaded.
  if (!profile) {
    return null;
  }

  return <VendorProfileForm {...props} profile={profile} />;
}

function VendorProfileForm({ navigation, route, profile }: Props & { profile: VendorProfile }) {
  const theme = useTheme();
  const isSetup = route.name === 'VendorProfileSetup';

  const { save, isSaving, error: saveError } = useSaveVendorProfile();
  const { mutate: signOut, isSubmitting: isSigningOut } = useSignOut();

  const [imageUrl, setImageUrl] = useState<string | undefined>(profile.imageUrl);
  const photo = useImageUpload({
    attach: setImageUrl,
    detach: () => setImageUrl(undefined),
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { isDirty, errors, isSubmitted },
  } = useForm<VendorProfileForm>({
    resolver: zodResolver(vendorProfileSchema),
    defaultValues: formValuesOf(profile),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const businessName = watch('businessName');
  const hasChanges = isDirty || imageUrl !== profile.imageUrl;
  const busy = isSaving || photo.isBusy || isSigningOut;
  const hasFieldErrors = isSubmitted && Object.keys(errors).length > 0;

  /* Leaving the edit form ------------------------------------------------ */

  const allowLeave = useRef(false);
  const interrupted = useRef<NavigationAction | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  useEffect(() => {
    if (isSetup) {
      return undefined;
    }
    return navigation.addListener('beforeRemove', event => {
      if (allowLeave.current || !hasChanges || isSaving) {
        return;
      }
      event.preventDefault();
      interrupted.current = event.data.action;
      setIsDiscarding(true);
    });
  }, [hasChanges, isSaving, isSetup, navigation]);

  const confirmDiscard = useCallback(() => {
    setIsDiscarding(false);
    allowLeave.current = true;

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

  /* Saving ---------------------------------------------------------------- */

  const submit = useCallback(
    async (values: VendorProfileForm) => {
      const saved = await save(buildVendorProfileUpdate(values, imageUrl));
      // Setup needs nothing more: adopting the profile has already swapped the tree.
      if (saved && !isSetup) {
        allowLeave.current = true;
        navigation.goBack();
      }
    },
    [imageUrl, isSetup, navigation, save],
  );

  const onSubmit = handleSubmit(submit);

  const handleSave = useCallback(() => {
    /*
      Not while a photo is still uploading: its URL would miss this save. Both
      checks, because each covers a frame the other cannot: `isRunning` is true
      from the tap that starts an upload, a render before `busy` lands (a Save
      pressed in that frame used to save the profile without the picture);
      `busy` stays true for the frame after it ends, before the uploaded URL
      reaches this handler. The team member form's Save has the same guard.
    */
    if (busy || photo.isRunning()) {
      return;
    }
    void onSubmit();
  }, [busy, onSubmit, photo]);

  const takePhoto = useCallback(() => photo.choose('camera'), [photo]);
  const choosePhoto = useCallback(() => photo.choose('gallery'), [photo]);

  return (
    <Screen
      scrollable
      keyboardAvoiding
      header={
        isSetup ? undefined : (
          <View
            style={[
              styles.bar,
              { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget },
            ]}>
            <BackButton
              onPress={navigation.goBack}
              accessibilityLabel={COPY.back}
              testID="vendor-profile-back"
            />
          </View>
        )
      }
      contentContainerStyle={{ gap: theme.spacing.xxl, paddingBottom: theme.spacing.xxxl }}
      testID={isSetup ? 'vendor-profile-setup' : 'vendor-profile-edit'}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="vendor-profile-heading">
          {isSetup ? COPY.setupTitle : COPY.editTitle}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {isSetup ? COPY.setupSubtitle : COPY.editSubtitle}
        </Text>
      </View>

      {/* The picture: it names itself, unlike a team member's. */}
      <PhotoField
        photo={photo}
        photoUrl={imageUrl}
        name={businessName}
        fallbackIcon="business"
        pictureSpoken={COPY.photoSpoken}
        copy={COPY}
        // Never while saving or signing out; Try again and Discard included.
        locked={isSaving || isSigningOut}
        onTakePhoto={takePhoto}
        onChoosePhoto={choosePhoto}
        onRemovePhoto={photo.remove}
        onRetryPhoto={photo.retry}
        testID="vendor-profile-photo"
      />

      {/* The business --------------------------------------------------- */}
      <View style={{ gap: theme.spacing.lg }}>
        <Text variant="overline" color="textSecondary" accessibilityRole="header">
          {COPY.businessSection}
        </Text>

        <ControlledInput
          control={control}
          name="businessName"
          label={COPY.businessNameLabel}
          required
          placeholder={COPY.businessNamePlaceholder}
          maxLength={VENDOR_BUSINESS_NAME_MAX_LENGTH}
          autoCapitalize="words"
          editable={!isSaving}
          testID="vendor-profile-business-name"
        />

        <ControlledInput
          control={control}
          name="description"
          label={COPY.descriptionLabel}
          placeholder={COPY.descriptionPlaceholder}
          helperText={COPY.descriptionHelper}
          maxLength={VENDOR_DESCRIPTION_MAX_LENGTH}
          multiline
          radiusToken="lg"
          editable={!isSaving}
          testID="vendor-profile-description"
        />
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <Text variant="overline" color="textSecondary" accessibilityRole="header">
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
              disabled={isSaving}
              testID="vendor-profile-categories"
            />
          )}
        />
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <Text variant="overline" color="textSecondary" accessibilityRole="header">
          {COPY.areaSection}
        </Text>

        <ControlledInput
          control={control}
          name="serviceArea"
          label={COPY.areaLabel}
          placeholder={COPY.areaPlaceholder}
          helperText={COPY.areaHelper}
          maxLength={VENDOR_SERVICE_AREA_MAX_LENGTH}
          autoCapitalize="words"
          editable={!isSaving}
          testID="vendor-profile-area"
        />
      </View>

      {/* From the account ----------------------------------------------- */}
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="overline" color="textSecondary" accessibilityRole="header">
            {COPY.contactSection}
          </Text>
          <Text variant="caption" color="textSecondary">
            {COPY.contactSupport}
          </Text>
        </View>
        <Card bordered style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          {profile.ownerName ? (
            <ProfileDetailRow
              label={COPY.ownerLabel}
              value={profile.ownerName}
              testID="vendor-profile-owner"
            />
          ) : null}
          <ProfileDetailRow
            label={COPY.phoneLabel}
            value={formatPhone(profile.phone)}
            testID="vendor-profile-phone"
          />
          {profile.email ? (
            <ProfileDetailRow
              label={COPY.emailLabel}
              value={profile.email}
              testID="vendor-profile-email"
            />
          ) : null}
        </Card>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {hasFieldErrors ? (
          <Text
            variant="caption"
            color="danger"
            accessibilityLiveRegion="polite"
            testID="vendor-profile-fix-errors">
            {COPY.fixErrors}
          </Text>
        ) : null}

        {saveError ? (
          <ErrorState
            error={saveError}
            title={COPY.saveFailedTitle}
            fullScreen={false}
            testID="vendor-profile-save-error"
          />
        ) : null}

        <PrimaryButton
          fullWidth
          label={isSaving ? COPY.saving : isSetup ? COPY.saveSetup : COPY.saveEdit}
          onPress={handleSave}
          isLoading={isSaving}
          disabled={photo.isBusy || isSigningOut}
          accessibilityHint={COPY.saveHint}
        />

        {isSetup ? (
          <SecondaryButton
            fullWidth
            label={COPY.signOut}
            icon="logout"
            // Never rejects: a failed sign out is the hook's `error`.
            onPress={signOut}
            isLoading={isSigningOut}
            disabled={isSaving}
            accessibilityHint={COPY.signOutHint}
          />
        ) : null}
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
        testID="vendor-profile-discard-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
});
