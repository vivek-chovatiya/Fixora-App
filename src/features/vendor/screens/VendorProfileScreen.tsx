import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import type { VendorStackParamList, VendorTabParamList } from '@/app/navigation/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { Avatar, Badge, Card, Divider, ImageUploader, InfoRow, MenuRow, PrimaryButton, RatingStars, Row, Screen, SectionHeader, Text, useDialog, useToast } from '@/shared/components';
import { useImageUploads } from '@/shared/hooks/useImageUploads';
import { useSingleImageUpload } from '@/shared/hooks/useSingleImageUpload';
import { vendorApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
import type { VendorProfile } from '@/shared/types/models';
import { formatPhone } from '@/shared/utils/format';

type Props = CompositeScreenProps<BottomTabScreenProps<VendorTabParamList, 'VendorProfile'>, NativeStackScreenProps<VendorStackParamList>>;

export function VendorProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { confirm } = useDialog();
  const { user, setUser, signOut } = useAuth();
  const vendor = user as VendorProfile;
  const photo = useSingleImageUpload('PROFILE');
  const shop = useImageUploads('SHOP', vendor.shopImages, 10);
  const [savingShop, setSavingShop] = useState(false);
  const shopChanged = shop.urls.join('|') !== vendor.shopImages.join('|');

  const save = async (task: () => Promise<VendorProfile>, message: string) => {
    try {
      setUser(await task());
      toast.show(message);
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    }
  };

  const onPhoto = async () => {
    const url = await photo.pickAndUpload();
    if (url) await save(() => vendorApi.update({ profileImage: url }), 'Profile photo updated.');
  };

  const onSaveShop = async () => {
    setSavingShop(true);
    await save(() => vendorApi.update({ shopImages: shop.urls }), 'Shop images saved.');
    setSavingShop(false);
  };

  const onLogout = async () => {
    if (await confirm({ title: 'Log out?', confirmLabel: 'Log out', destructive: true })) await signOut();
  };

  return (
    <Screen testID="vendor-profile">
      <Row gap="lg">
        <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={onPhoto}>
          <Avatar name={vendor.businessName} uri={vendor.profileImage} size={72} />
          {photo.isUploading ? (
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Text variant="h2">{vendor.businessName}</Text>
          <Text variant="caption" color="textSecondary">
            {vendor.ownerName}
          </Text>
          <Row gap="xs">
            <RatingStars value={vendor.averageRating} size={14} />
            <Text variant="caption" color="textSecondary">
              {vendor.averageRating.toFixed(1)} ({vendor.totalReviews})
            </Text>
          </Row>
          <Badge label={vendor.availability ? 'Available' : 'Unavailable'} tone={vendor.availability ? 'success' : 'neutral'} />
        </View>
      </Row>

      <Card>
        <View style={{ gap: theme.spacing.lg }}>
          <InfoRow icon="call" label="Phone" value={formatPhone(vendor.phone)} />
          <InfoRow icon="send" label="Email" value={vendor.email} />
          <InfoRow icon="location" label="Shop address" value={vendor.address} />
          <InfoRow icon="categories" label="Services" value={vendor.categories.map(c => c.name).join(', ') || '—'} />
          <InfoRow icon="location" label="Working areas" value={vendor.workingAreas.join(', ') || '—'} />
          <InfoRow icon="pending" label="Working hours" value={vendor.workingHours || '—'} />
          {vendor.description ? <InfoRow icon="document" label="About" value={vendor.description} /> : null}
        </View>
      </Card>

      <SectionHeader title="Shop images" />
      <ImageUploader controller={shop} testID="shop-uploader" />
      {shopChanged ? <PrimaryButton label="Save shop images" onPress={onSaveShop} loading={savingShop} disabled={shop.isBusy || shop.hasFailures} /> : null}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <MenuRow testID="vendor-edit-profile" icon="edit" label="Edit profile" onPress={() => navigation.navigate('EditVendorProfile')} />
        <Divider />
        <MenuRow testID="vendor-reviews" icon="star" label="Reviews" onPress={() => navigation.navigate('VendorReviews')} />
        <Divider />
        <MenuRow testID="vendor-reports" icon="reports" label="Reports" onPress={() => navigation.navigate('VendorReports')} />
        <Divider />
        <MenuRow icon="notifications" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
        <Divider />
        <MenuRow icon="verified" label="Change password" onPress={() => navigation.navigate('ChangePassword')} />
      </Card>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <MenuRow testID="vendor-logout" icon="logout" label="Log out" tone="danger" onPress={onLogout} />
      </Card>
    </Screen>
  );
}
