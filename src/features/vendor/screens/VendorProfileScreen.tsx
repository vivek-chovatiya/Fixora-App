/**
 * VendorProfileScreen
 *
 * The Profile tab (PROJECT_BIBLE.md sections 38 and 43): the business profile
 * read back, the way into editing it, the ways into the parts of it that have
 * screens of their own, and the way out.
 *
 * ⚠️ Built in parts, and never drawn ahead of them. Section 38 lists more than
 * the business profile — working hours, availability, rating, team management
 * — and each arrived with its own phase, as the paragraphs below record. Until
 * it did, nothing here pretended to it — no empty "Working hours" row, no
 * rating of zero — because an unbuilt feature drawn as data reads as data.
 * Whatever is added next follows the same rule.
 *
 * The rating arrived in Phase 3E-6 as a way in, not a figure: "Customer
 * reviews" opens the Reviews screen (section 41), which reads the average and
 * the reviews itself. Drawing the number here too would be a second read of
 * it on a screen that otherwise needs none.
 *
 * Team management (section 38's "Manage Team") arrived in Phase 3E-7 the same
 * way: "Manage team" switches to the Team tab, which is the team — one list,
 * not a second copy pushed from here.
 *
 * Reports (section 42) are a way in too: "Reports" pushes the Reports screen,
 * which reads its own figures. Section 43 allows Dashboard or Profile; Profile,
 * because the dashboard is settled and the tab bar stays at four.
 *
 * Shop images (section 38's "Shop Images" and "Upload Shop Images") are shown
 * here as small squares — or "No shop images yet" — from the profile this tree
 * already holds, with "Manage shop images" pushing the screen that changes
 * them. That screen hands every saved change to `VendorProfileContext`, so
 * coming back here shows it without a read of its own.
 *
 * Availability and working hours (section 38's "Availability", "Working
 * Hours" and "Manage Availability") are one card, `AvailabilitySection`: the
 * "Accepting new requests" switch, applied at once through the vendor's
 * profile line (`useAcceptingRequests`) and asking first only to turn new
 * requests off, then the week in short, with "Edit working hours" pushing the
 * screen that changes it. Like shop images, both are drawn from the profile
 * this tree holds, and every change is adopted into it.
 *
 * Logout asks first and never navigates: the root navigator follows the cleared
 * session to the sign-in flow. The profile itself stays saved under this
 * vendor's key for when they sign back in.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSignOut } from '@/features/auth/hooks/useAuth';
import { AvailabilitySection } from '@/features/vendor/components/AvailabilitySection';
import { ProfileDetailRow } from '@/features/vendor/components/ProfileDetailRow';
import { ShopImagesSection } from '@/features/vendor/components/ShopImagesSection';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useAcceptingRequests } from '@/features/vendor/hooks/useAcceptingRequests';
import { useCategoryNames } from '@/features/vendor/hooks/useCategoryNames';
import { useVendorProfile } from '@/features/vendor/state/VendorProfileContext';
import type { VendorStackParamList, VendorTabParamList } from '@/navigation/types';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Screen,
  SecondaryButton,
  Text,
} from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.profile;

/** The tab bar already clears the home indicator. */
const TOP_EDGE_ONLY = ['top'] as const;

type Props = CompositeScreenProps<
  BottomTabScreenProps<VendorTabParamList, 'Profile'>,
  NativeStackScreenProps<VendorStackParamList>
>;

export function VendorProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const { profile } = useVendorProfile();
  const categories = useCategoryNames(profile?.serviceCategoryIds ?? []);
  const { mutate: signOut, isSubmitting: isLoggingOut, error: logoutError } = useSignOut();
  const availability = useAcceptingRequests();

  const [isConfirming, setIsConfirming] = useState(false);

  const edit = useCallback(() => navigation.navigate('EditVendorProfile'), [navigation]);
  const openReviews = useCallback(() => navigation.navigate('VendorReviews'), [navigation]);
  const openReports = useCallback(() => navigation.navigate('VendorReports'), [navigation]);
  const openTeam = useCallback(() => navigation.navigate('Team'), [navigation]);
  const openShopImages = useCallback(() => navigation.navigate('ShopImages'), [navigation]);
  const openWorkingHours = useCallback(() => navigation.navigate('WorkingHours'), [navigation]);
  const askToLogOut = useCallback(() => setIsConfirming(true), []);
  const cancelLogOut = useCallback(() => setIsConfirming(false), []);
  const confirmLogOut = useCallback(async () => {
    await signOut();
    // Reached only when signing out did not unmount this screen — a failure.
    setIsConfirming(false);
  }, [signOut]);

  if (!profile) {
    return null;
  }

  const categoryText = categories.names.join(', ');

  return (
    <Screen
      scrollable
      edges={TOP_EDGE_ONLY}
      contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}
      testID="vendor-profile">
      <Text variant="hero" accessibilityRole="header" testID="vendor-profile-title">
        {COPY.title}
      </Text>

      <Card
        bordered
        shadow="sm"
        style={[styles.identity, { padding: theme.spacing.xl, gap: theme.spacing.md }]}
        testID="vendor-profile-identity">
        <Avatar
          uri={profile.imageUrl}
          name={profile.businessName}
          size="xl"
          fallbackIcon="business"
          testID="vendor-profile-overview-avatar"
        />
        <Text variant="h2" align="center" testID="vendor-profile-business">
          {profile.businessName}
        </Text>
      </Card>

      <Card
        bordered
        shadow="sm"
        style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
        testID="vendor-profile-business-card">
        <Text variant="overline" color="textTertiary" accessibilityRole="header">
          {COPY.businessSection}
        </Text>
        <ProfileDetailRow
          label={COPY.descriptionLabel}
          value={profile.description ?? COPY.notProvided}
          muted={!profile.description}
          testID="vendor-profile-about"
        />
        {categories.error ? (
          <ErrorState
            error={categories.error}
            title={COPY.categoriesFailed}
            onRetry={categories.retry}
            fullScreen={false}
            testID="vendor-profile-categories-error"
          />
        ) : categories.isLoading ? null : (
          <ProfileDetailRow
            label={COPY.categoriesLabel}
            value={categoryText || COPY.notProvided}
            muted={!categoryText}
            testID="vendor-profile-services"
          />
        )}
        <ProfileDetailRow
          label={COPY.areaLabel}
          value={profile.serviceArea?.description ?? COPY.notProvided}
          muted={!profile.serviceArea}
          testID="vendor-profile-service-area"
        />
      </Card>

      <AvailabilitySection
        accepting={availability.pending ?? availability.isAccepting}
        isChanging={availability.isChanging}
        onChangeAccepting={availability.setAccepting}
        workingHours={profile.workingHours}
        onEditHours={openWorkingHours}
        disabled={isLoggingOut}
        testID="vendor-profile-availability"
      />

      <ShopImagesSection
        imageUrls={profile.shopImageUrls}
        onManage={openShopImages}
        disabled={isLoggingOut}
        testID="vendor-profile-shop-images"
      />

      <Card
        bordered
        shadow="sm"
        style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
        testID="vendor-profile-contact">
        <Text variant="overline" color="textTertiary" accessibilityRole="header">
          {COPY.contactSection}
        </Text>
        {profile.ownerName ? (
          <ProfileDetailRow label={COPY.ownerLabel} value={profile.ownerName} />
        ) : null}
        <ProfileDetailRow label={COPY.phoneLabel} value={profile.phone} />
        {profile.email ? <ProfileDetailRow label={COPY.emailLabel} value={profile.email} /> : null}
      </Card>

      <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
        <SecondaryButton
          label={COPY.team}
          icon="team"
          onPress={openTeam}
          disabled={isLoggingOut}
          fullWidth
          accessibilityHint={COPY.teamHint}
        />

        <SecondaryButton
          label={COPY.reviews}
          icon="starOutline"
          onPress={openReviews}
          disabled={isLoggingOut}
          fullWidth
          accessibilityHint={COPY.reviewsHint}
        />

        <SecondaryButton
          label={COPY.reports}
          icon="reports"
          onPress={openReports}
          disabled={isLoggingOut}
          fullWidth
          accessibilityHint={COPY.reportsHint}
        />

        <SecondaryButton
          label={COPY.edit}
          icon="edit"
          onPress={edit}
          disabled={isLoggingOut}
          fullWidth
          accessibilityHint={COPY.editHint}
        />

        {logoutError ? (
          <ErrorState
            error={logoutError}
            title={COPY.logoutFailedTitle}
            fullScreen={false}
            testID="vendor-profile-logout-error"
          />
        ) : null}

        <Button
          label={COPY.logout}
          variant="danger"
          icon="logout"
          onPress={askToLogOut}
          isLoading={isLoggingOut}
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
        testID="vendor-profile-logout-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
  },
});
