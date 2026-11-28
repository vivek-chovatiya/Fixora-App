/**
 * CustomerProfileScreen
 *
 * The customer's own details, and the way out (PROJECT_BIBLE.md section 25 and
 * the Profile tab of section 26).
 *
 * ⚠️ Still read-only itself. Section 25's four actions are all here now: Edit
 * Profile and Change Profile Image (Phase 3D-8), Manage Addresses (Phase 3D-9)
 * and Logout. Nothing on this screen is typed into — editing and the address
 * book each happen on their own screen, which is where section 26 puts them.
 *
 * Everything shown comes from the session (`useCustomerProfile`): the name —
 * or, for an account with no name, the phone number in its place — the phone,
 * and the email only when there is one. The avatar is the stored picture, then
 * initials, then the profile glyph. The phone is written for reading
 * (`formatPhone`, "+91 98765 43210") in both places it appears; what is stored
 * and sent is unchanged.
 *
 * ⚠️ The picture saves as soon as it is chosen (owner decision, 2026-09-29),
 * because it is an action on this screen rather than a field on a form. The
 * avatar keeps showing the stored image until a new one is genuinely stored —
 * a picture that failed to upload appears beside its failure, with Try again,
 * and never as though it had been saved (section 16's rule, applied here).
 *
 * ⚠️ Logout asks first, and then clears the unsent request draft before signing
 * out (`useCustomerLogout`). It never navigates: the root navigator follows the
 * cleared session to the sign-in flow. While it runs the dialog stays open and
 * busy, so it cannot be pressed twice; if it fails, the dialog closes and the
 * failure is said here, with Log out still there to try again.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  RequestSummaryBlock,
  RequestSummarySection,
} from '@/features/customer/components/RequestSummary';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useCustomerLogout } from '@/features/customer/hooks/useCustomerLogout';
import { useCustomerProfile } from '@/features/customer/hooks/useCustomerProfile';
import { useProfileImage } from '@/features/customer/hooks/useProfileImage';
import { LanguageRow } from '@/features/language/components/LanguageRow';
import type { CustomerStackParamList, CustomerTabParamList } from '@/navigation/types';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  PhotoUploadProgress,
  Screen,
  SecondaryButton,
  Text,
} from '@/shared/components';
import { formatPhone } from '@/shared/presentation/phone';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.profile;

/** The tab bar already clears the home indicator; see Home. */
const TOP_EDGE_ONLY = ['top'] as const;

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Profile'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export function CustomerProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const profile = useCustomerProfile();
  const { logOut, isLoggingOut, error } = useCustomerLogout();
  const photo = useProfileImage();

  const [isConfirming, setIsConfirming] = useState(false);

  const askToLogOut = useCallback(() => setIsConfirming(true), []);

  const editProfile = useCallback(() => navigation.navigate('EditProfile'), [navigation]);

  const manageAddresses = useCallback(() => navigation.navigate('Addresses'), [navigation]);

  const changeLanguage = useCallback(() => navigation.navigate('Language'), [navigation]);

  const takePhoto = useCallback(() => photo.choose('camera'), [photo]);
  const choosePhoto = useCallback(() => photo.choose('gallery'), [photo]);

  const cancelLogOut = useCallback(() => setIsConfirming(false), []);

  const confirmLogOut = useCallback(async () => {
    await logOut();
    // Reached only when signing out did not unmount this screen, which means it
    // failed: the failure is shown beside Log out rather than inside a dialog.
    setIsConfirming(false);
  }, [logOut]);

  // Signing out clears the user a moment before the customer application
  // unmounts; there is nothing to draw in between.
  if (!profile) {
    return null;
  }

  return (
    <Screen
      scrollable
      edges={TOP_EDGE_ONLY}
      contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}
      testID="customer-profile">
      <Text variant="hero" accessibilityRole="header" testID="profile-heading">
        {COPY.title}
      </Text>

      {/*
        Who this is. The avatar names itself ("… profile picture"); the heading
        is the name, or the number for an account that has no name, and wraps
        rather than truncating.
      */}
      <Card
        bordered
        shadow="sm"
        style={[styles.identity, { padding: theme.spacing.xl, gap: theme.spacing.md }]}
        testID="profile-identity">
        {/*
          The stored picture, never the pending one: until an upload has
          finished there is nothing saved for this to show.
        */}
        <Avatar
          uri={profile.avatarUrl}
          name={profile.name}
          size="xl"
          fallbackIcon="profile"
          testID="profile-avatar"
        />
        <Text variant="h2" align="center" testID="profile-name">
          {profile.heading}
        </Text>

        <View style={[styles.photoActions, { gap: theme.spacing.sm }]} testID="profile-photo">
          <SecondaryButton
            label={COPY.photoCamera}
            icon="camera"
            onPress={takePhoto}
            disabled={photo.isBusy || isLoggingOut}
            style={styles.photoAction}
          />
          <SecondaryButton
            label={COPY.photoGallery}
            icon="gallery"
            onPress={choosePhoto}
            disabled={photo.isBusy || isLoggingOut}
            style={styles.photoAction}
          />
        </View>

        {/* Only once there is a picture to delete. */}
        {profile.avatarUrl && !photo.pending ? (
          <SecondaryButton
            label={COPY.photoRemove}
            icon="remove"
            onPress={photo.remove}
            disabled={photo.isBusy || isLoggingOut}
            accessibilityHint={COPY.photoRemoveHint}
          />
        ) : null}

        {/*
          The upload's progress, as the vendor's photo cards show it (3G-4):
          the waiting words once, then "Uploading… 42%" as one progressbar
          whose figure never speaks. Shared, not copied (`PhotoUploadProgress`).
        */}
        <PhotoUploadProgress
          isBusy={photo.isBusy}
          progress={photo.progress}
          waitingLabel={COPY.photoUploading}
          progressLabel={COPY.photoProgress}
          testID="profile-photo"
        />

        {/*
          A failed picture and its retry, together. The image itself is not
          drawn as the avatar — it is not saved, and showing it there would say
          it was.
        */}
        {photo.error ? (
          <View style={[styles.stretch, { gap: theme.spacing.sm }]}>
            <ErrorState
              error={photo.error}
              title={COPY.photoFailedTitle}
              fullScreen={false}
              testID="profile-photo-error"
            />
            {photo.pending ? (
              <View style={[styles.photoActions, { gap: theme.spacing.sm }]}>
                <Button
                  label={COPY.photoRetry}
                  onPress={photo.retry}
                  disabled={photo.isBusy}
                  style={styles.photoAction}
                />
                <SecondaryButton
                  label={COPY.photoDiscard}
                  onPress={photo.discard}
                  disabled={photo.isBusy}
                  accessibilityHint={COPY.photoDiscardHint}
                  style={styles.photoAction}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>

      <RequestSummarySection title={COPY.contactTitle} testID="profile-contact">
        {/*
          Written for reading — "+91 98765 43210", the owner's choice
          (21/10/2026) — and never anything but display: the stored digits are
          what any form or service still gets.
        */}
        <RequestSummaryBlock
          label={COPY.phoneLabel}
          value={formatPhone(profile.phone)}
          testID="profile-phone"
        />
        {/* Hidden, not "Add email": there is nowhere to add one yet. */}
        {profile.email ? (
          <RequestSummaryBlock
            label={COPY.emailLabel}
            value={profile.email}
            testID="profile-email"
          />
        ) : null}
      </RequestSummarySection>

      {/* Apart from the details, because these are the things here that act. */}
      <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
        <SecondaryButton
          label={COPY.edit}
          icon="edit"
          onPress={editProfile}
          disabled={photo.isBusy || isLoggingOut}
          fullWidth
          accessibilityHint={COPY.editHint}
        />

        {error ? (
          <ErrorState
            error={error}
            title={COPY.logoutFailedTitle}
            fullScreen={false}
            testID="profile-logout-error"
          />
        ) : null}

        <SecondaryButton
          label={COPY.addresses}
          icon="location"
          onPress={manageAddresses}
          disabled={photo.isBusy || isLoggingOut}
          fullWidth
          accessibilityHint={COPY.addressesHint}
        />

        {/* The way back to the first launch's language chooser (phase5-contract.md section 7). */}
        <LanguageRow onPress={changeLanguage} disabled={photo.isBusy || isLoggingOut} />

        <Button
          label={COPY.logout}
          variant="danger"
          icon="logout"
          onPress={askToLogOut}
          isLoading={isLoggingOut}
          disabled={photo.isBusy}
          fullWidth
          accessibilityHint={COPY.logoutHint}
        />
      </View>

      <ConfirmDialog
        visible={isConfirming}
        title={COPY.logoutConfirmTitle}
        message={COPY.logoutConfirmMessage}
        cancelLabel={COPY.logoutCancel}
        cancelHint={COPY.logoutCancelHint}
        confirmLabel={COPY.logoutConfirm}
        confirmHint={COPY.logoutConfirmHint}
        onCancel={cancelLogOut}
        onConfirm={confirmLogOut}
        isConfirming={isLoggingOut}
        testID="profile-logout-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
  },
  stretch: {
    alignSelf: 'stretch',
  },
  /* Side by side where they fit, stacked where they do not — as ConfirmDialog. */
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },
  photoAction: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '40%',
  },
});
