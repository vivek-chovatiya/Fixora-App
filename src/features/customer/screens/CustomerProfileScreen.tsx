import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import type { CustomerStackParamList, CustomerTabParamList } from '@/app/navigation/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { Avatar, Banner, Card, Divider, MenuRow, Screen, Text, useDialog, useToast } from '@/shared/components';
import { useSingleImageUpload } from '@/shared/hooks/useSingleImageUpload';
import { customerApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
import type { CustomerProfile } from '@/shared/types/models';
import { formatPhone } from '@/shared/utils/format';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Profile'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export function CustomerProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const { user, signOut, setUser } = useAuth();
  const { confirm } = useDialog();
  const toast = useToast();
  const photo = useSingleImageUpload('PROFILE');
  const profile = user as CustomerProfile | null;

  const onChangePhoto = async () => {
    const url = await photo.pickAndUpload();
    if (!url) return;
    try {
      setUser(await customerApi.update({ profileImage: url }));
      toast.show('Profile photo updated.');
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    }
  };

  const onLogout = async () => {
    if (await confirm({ title: 'Log out?', confirmLabel: 'Log out', destructive: true })) {
      await signOut();
    }
  };

  return (
    <Screen testID="customer-profile">
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <Pressable testID="profile-change-photo" accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={onChangePhoto}>
          <Avatar name={profile?.fullName} uri={profile?.profileImage} size={88} />
          {photo.isUploading ? (
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : null}
        </Pressable>
        <Text variant="label" color="primary">
          Change photo
        </Text>
        <Text variant="h2" testID="profile-name">
          {profile?.fullName}
        </Text>
        <Text variant="body" color="textSecondary">
          {profile?.email}
        </Text>
        <Text variant="body" color="textSecondary">
          {formatPhone(profile?.phone)}
        </Text>
      </View>
      {photo.error ? <Banner tone="danger" icon="error" message={photo.error.userMessage} /> : null}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <MenuRow testID="profile-edit" icon="edit" label="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
        <Divider />
        <MenuRow testID="profile-addresses" icon="location" label="Manage addresses" onPress={() => navigation.navigate('Addresses')} />
        <Divider />
        <MenuRow testID="profile-notifications" icon="notifications" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
        <Divider />
        <MenuRow icon="verified" label="Change password" onPress={() => navigation.navigate('ChangePassword')} />
      </Card>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <MenuRow testID="profile-logout" icon="logout" label="Log out" tone="danger" onPress={onLogout} />
      </Card>
    </Screen>
  );
}
