import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';

import type { CustomerStackParamList } from '@/app/navigation/types';
import { Banner, ChipGroup, PrimaryButton, Row, Screen, Text, TextField, Toggle, useToast } from '@/shared/components';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { addressApi, type AddressPayload } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { compact, hasErrors, mergeFieldErrors, validators } from '@/shared/utils/validation';

type Props = NativeStackScreenProps<CustomerStackParamList, 'AddressForm'>;
type Field = 'title' | 'addressLine1' | 'addressLine2' | 'city' | 'state' | 'pincode';
const TITLES = ['Home', 'Office', 'Other'].map(t => ({ value: t, label: t }));

export function AddressFormScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const existing = route.params?.address;
  const [form, setForm] = useState<Record<Field, string>>({
    title: existing?.title ?? 'Home',
    addressLine1: existing?.addressLine1 ?? '',
    addressLine2: existing?.addressLine2 ?? '',
    city: existing?.city ?? '',
    state: existing?.state ?? '',
    pincode: existing?.pincode ?? '',
  });
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const errors = useFormErrors<Field>();
  const save = useServiceMutation((payload: AddressPayload) => (existing ? addressApi.update(existing.id, payload) : addressApi.create(payload)));

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit address' : 'Add address' });
  }, [navigation, existing]);

  const set = (key: Field) => (value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    errors.edited(key);
  };

  const onSave = async () => {
    const next = compact<Field>({
      title: validators.required(form.title, 'Label'),
      addressLine1: validators.minLength(form.addressLine1, 3, 'Address'),
      city: validators.required(form.city, 'City'),
      state: validators.required(form.state, 'State'),
      pincode: /^[0-9A-Za-z -]{4,10}$/.test(form.pincode.trim()) ? undefined : 'Enter a valid postal code.',
    });
    errors.setErrors(next);
    if (hasErrors(next)) return;
    const payload: AddressPayload = {
      title: form.title.trim(),
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      ...(isDefault ? { isDefault: true } : {}),
    };
    if (await save.mutate(payload)) {
      toast.show(existing ? 'Address updated.' : 'Address added.');
      navigation.goBack();
    }
  };

  const server = mergeFieldErrors(save.error, ['title', 'addressLine1', 'addressLine2', 'city', 'state', 'pincode'] as const);
  const err = (k: Field) => errors.errorFor(k, server[k]);

  return (
    <Screen footer={<PrimaryButton testID="address-save" label="Save address" onPress={onSave} loading={save.isSubmitting} />}>
      {save.error && !save.error.fieldErrors ? <Banner tone="danger" icon="error" message={save.error.userMessage} /> : null}
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textSecondary">
          Label
        </Text>
        <ChipGroup options={TITLES} value={TITLES.some(t => t.value === form.title) ? form.title : 'Other'} onChange={set('title')} testIDPrefix="address-title" />
      </View>
      <TextField testID="address-line1" label="House / flat, building" value={form.addressLine1} onChangeText={set('addressLine1')} error={err('addressLine1')} />
      <TextField testID="address-line2" label="Area, landmark" optional value={form.addressLine2} onChangeText={set('addressLine2')} />
      <TextField testID="address-city" label="City" value={form.city} onChangeText={set('city')} error={err('city')} />
      <TextField testID="address-state" label="State" value={form.state} onChangeText={set('state')} error={err('state')} />
      <TextField testID="address-pincode" label="PIN code" value={form.pincode} onChangeText={set('pincode')} keyboardType="number-pad" maxLength={10} error={err('pincode')} />
      {!existing?.isDefault ? (
        <Row justify="space-between">
          <Text variant="body">Set as default address</Text>
          <Toggle value={isDefault} onValueChange={setIsDefault} accessibilityLabel="Set as default address" />
        </Row>
      ) : null}
    </Screen>
  );
}
