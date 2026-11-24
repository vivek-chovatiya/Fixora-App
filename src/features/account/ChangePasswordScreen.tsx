import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';

import { Banner, PrimaryButton, Screen, TextField, useToast } from '@/shared/components';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { authApi } from '@/shared/services/api';
import { compact, hasErrors, mergeFieldErrors, validators } from '@/shared/utils/validation';

type Field = 'currentPassword' | 'newPassword' | 'confirm';

export function ChangePasswordScreen() {
  const navigation = useNavigation();
  const toast = useToast();
  const [form, setForm] = useState<Record<Field, string>>({ currentPassword: '', newPassword: '', confirm: '' });
  const errors = useFormErrors<Field>();
  const save = useServiceMutation(authApi.changePassword);
  const set = (k: Field) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    errors.edited(k);
  };

  const onSave = async () => {
    const next = compact<Field>({
      currentPassword: validators.required(form.currentPassword, 'Current password'),
      newPassword: validators.password(form.newPassword),
      confirm: form.confirm === form.newPassword ? undefined : 'Passwords do not match.',
    });
    errors.setErrors(next);
    if (hasErrors(next)) return;
    if ((await save.mutate(form.currentPassword, form.newPassword)) !== null) {
      toast.show('Password changed.');
      navigation.goBack();
    }
  };

  const server = mergeFieldErrors(save.error, ['currentPassword', 'newPassword'] as const);
  return (
    <Screen footer={<PrimaryButton label="Update password" onPress={onSave} loading={save.isSubmitting} />}>
      {save.error && !save.error.fieldErrors ? <Banner tone="danger" icon="error" message={save.error.userMessage} /> : null}
      <TextField label="Current password" secure value={form.currentPassword} onChangeText={set('currentPassword')} error={errors.errorFor('currentPassword', server.currentPassword)} />
      <TextField label="New password" secure value={form.newPassword} onChangeText={set('newPassword')} helper="At least 8 characters" error={errors.errorFor('newPassword', server.newPassword)} />
      <TextField label="Confirm new password" secure value={form.confirm} onChangeText={set('confirm')} error={errors.errorFor('confirm')} />
    </Screen>
  );
}
