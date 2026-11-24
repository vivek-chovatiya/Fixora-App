import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { VendorStackParamList } from '@/app/navigation/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { Banner, Card, Chip, Loader, PrimaryButton, Row, Screen, Text, TextField, useToast } from '@/shared/components';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { catalogApi, vendorApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import type { VendorProfile } from '@/shared/types/models';
import { compact, hasErrors, mergeFieldErrors, normalizePhone, validators } from '@/shared/utils/validation';

type Props = NativeStackScreenProps<VendorStackParamList, 'EditVendorProfile'>;
type Field = 'businessName' | 'ownerName' | 'phone' | 'address' | 'workingAreas' | 'workingHours' | 'description';

export function EditVendorProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const vendor = user as VendorProfile;
  const categories = useServiceQuery(() => catalogApi.categories(), []);
  const [form, setForm] = useState<Record<Field, string>>({
    businessName: vendor.businessName,
    ownerName: vendor.ownerName,
    phone: vendor.phone,
    address: vendor.address,
    workingAreas: vendor.workingAreas.join(', '),
    workingHours: vendor.workingHours,
    description: vendor.description,
  });
  const [categoryIds, setCategoryIds] = useState<string[]>(vendor.categoryIds.map(String));
  const errors = useFormErrors<Field | 'categoryIds'>();
  const save = useServiceMutation(vendorApi.update);
  const set = (k: Field) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    errors.edited(k);
  };
  const toggleCategory = (id: string) => {
    setCategoryIds(ids => (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]));
    errors.edited('categoryIds');
  };

  const onSave = async () => {
    const next = compact<Field | 'categoryIds'>({
      businessName: validators.minLength(form.businessName, 2, 'Business name'),
      ownerName: validators.minLength(form.ownerName, 2, 'Owner name'),
      phone: validators.phone(form.phone),
      address: validators.minLength(form.address, 3, 'Address'),
      categoryIds: categoryIds.length ? undefined : 'Select at least one service.',
    });
    errors.setErrors(next);
    if (hasErrors(next)) return;
    const updated = await save.mutate({
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      phone: normalizePhone(form.phone),
      address: form.address.trim(),
      workingAreas: form.workingAreas.split(',').map(s => s.trim()).filter(Boolean),
      workingHours: form.workingHours.trim(),
      description: form.description.trim(),
      categoryIds,
    });
    if (updated) {
      setUser(updated);
      toast.show('Profile updated.');
      navigation.goBack();
    }
  };

  const server = mergeFieldErrors(save.error, ['businessName', 'ownerName', 'phone', 'address'] as const);
  const err = (k: Field) => errors.errorFor(k, server[k as keyof typeof server]);

  return (
    <Screen footer={<PrimaryButton testID="vendor-profile-save" label="Save changes" onPress={onSave} loading={save.isSubmitting} />}>
      {save.error && !save.error.fieldErrors ? <Banner tone="danger" icon="error" message={save.error.userMessage} /> : null}
      <Card>
        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="overline" color="textTertiary">
            Business
          </Text>
          <TextField testID="vendor-businessName" label="Business name" value={form.businessName} onChangeText={set('businessName')} error={err('businessName')} />
          <TextField testID="vendor-ownerName" label="Owner name" value={form.ownerName} onChangeText={set('ownerName')} error={err('ownerName')} />
          <TextField testID="vendor-phone" label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={err('phone')} />
          <TextField testID="vendor-address" label="Shop address" value={form.address} onChangeText={set('address')} error={err('address')} />
          <TextField testID="vendor-workingAreas" label="Working areas" optional helper="Comma separated" value={form.workingAreas} onChangeText={set('workingAreas')} />
          <TextField testID="vendor-workingHours" label="Working hours" optional value={form.workingHours} onChangeText={set('workingHours')} />
          <TextField testID="vendor-description" label="About your business" optional multiline value={form.description} onChangeText={set('description')} />
        </View>
      </Card>
      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="overline" color="textTertiary">
            Services you offer
          </Text>
          {categories.isLoading ? <Loader /> : null}
          <Row gap="sm" style={{ flexWrap: 'wrap' }}>
            {(categories.data ?? []).map(c => (
              <Chip key={c.id} label={c.name} selected={categoryIds.includes(c.id)} onPress={() => toggleCategory(c.id)} />
            ))}
          </Row>
          {errors.errorFor('categoryIds') ? (
            <Text variant="caption" color="danger">
              {errors.errorFor('categoryIds')}
            </Text>
          ) : null}
        </View>
      </Card>
    </Screen>
  );
}
