import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';

import type { CustomerStackParamList } from '@/app/navigation/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { Banner, PrimaryButton, Screen, TextField, useToast } from '@/shared/components';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { customerApi } from '@/shared/services/api';
import type { CustomerProfile } from '@/shared/types/models';
import { compact, hasErrors, mergeFieldErrors, normalizePhone, validators } from '@/shared/utils/validation';

type Props = NativeStackScreenProps<CustomerStackParamList, 'EditProfile'>;
type Field = 'firstName' | 'phone';

export function EditProfileScreen({ navigation }: Props) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const profile = user as CustomerProfile;
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  const [phone, setPhone] = useState(profile.phone);
  const errors = useFormErrors<Field>();
  const save = useServiceMutation(customerApi.update);

  const onSave = async () => {
    const next = compact<Field>({ firstName: validators.required(firstName, 'First name'), phone: validators.phone(phone) });
    errors.setErrors(next);
    if (hasErrors(next)) return;
    const updated = await save.mutate({ firstName: firstName.trim(), lastName: lastName.trim(), phone: normalizePhone(phone) });
    if (updated) {
      setUser(updated);
      toast.show('Profile updated.');
      navigation.goBack();
    }
  };

  const server = mergeFieldErrors(save.error, ['firstName', 'phone'] as const);

  return (
    <Screen footer={<PrimaryButton testID="edit-profile-save" label="Save changes" onPress={onSave} loading={save.isSubmitting} />}>
      {save.error && !save.error.fieldErrors ? <Banner tone="danger" icon="error" message={save.error.userMessage} /> : null}
      <TextField
        testID="edit-firstName"
        label="First name"
        value={firstName}
        onChangeText={value => {
          setFirstName(value);
          errors.edited('firstName');
        }}
        error={errors.errorFor('firstName', server.firstName)}
      />
      <TextField testID="edit-lastName" label="Last name" optional value={lastName} onChangeText={setLastName} />
      <TextField
        testID="edit-phone"
        label="Phone"
        value={phone}
        onChangeText={value => {
          setPhone(value);
          errors.edited('phone');
        }}
        keyboardType="phone-pad"
        error={errors.errorFor('phone', server.phone)}
      />
      <TextField label="Email" value={profile.email} editable={false} helper="Contact support to change your email." />
    </Screen>
  );
}
