import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';

import type { VendorStackParamList } from '@/app/navigation/types';
import { Banner, ChipGroup, DangerButton, PrimaryButton, Screen, Text, TextField, useDialog, useToast } from '@/shared/components';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { teamApi, type TeamMemberPayload } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
import type { TeamMemberStatus } from '@/shared/types/models';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { compact, hasErrors, mergeFieldErrors, normalizePhone, validators } from '@/shared/utils/validation';

type Props = NativeStackScreenProps<VendorStackParamList, 'TeamMemberForm'>;
const STATUSES: { value: TeamMemberStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'INACTIVE', label: 'Disabled' },
];

export function TeamMemberFormScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { confirm } = useDialog();
  const member = route.params?.member;
  const [name, setName] = useState(member?.name ?? '');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [designation, setDesignation] = useState(member?.designation ?? 'Technician');
  const [status, setStatus] = useState<TeamMemberStatus>(member?.status ?? 'ACTIVE');
  const errors = useFormErrors<'name' | 'phone'>();
  const save = useServiceMutation((payload: TeamMemberPayload) => (member ? teamApi.update(member.id, payload) : teamApi.create(payload)));

  useLayoutEffect(() => {
    navigation.setOptions({ title: member ? 'Edit team member' : 'Add team member' });
  }, [navigation, member]);

  const onSave = async () => {
    const next = compact({ name: validators.minLength(name, 2, 'Name'), phone: validators.phone(phone) });
    errors.setErrors(next);
    if (hasErrors(next)) return;
    const payload: TeamMemberPayload = { name: name.trim(), phone: normalizePhone(phone), designation: designation.trim() || 'Technician', ...(member ? { status } : {}) };
    if (await save.mutate(payload)) {
      toast.show(member ? 'Team member updated.' : 'Team member added.');
      navigation.goBack();
    }
  };

  const onRemove = async () => {
    if (!member || !(await confirm({ title: `Remove ${member.name}?`, confirmLabel: 'Remove', destructive: true }))) return;
    try {
      await teamApi.remove(member.id);
      toast.show('Team member removed.');
      navigation.goBack();
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    }
  };

  const server = mergeFieldErrors(save.error, ['name', 'phone'] as const);

  return (
    <Screen footer={<PrimaryButton testID="team-save" label="Save" onPress={onSave} loading={save.isSubmitting} />}>
      {save.error && !save.error.fieldErrors ? <Banner tone="danger" icon="error" message={save.error.userMessage} /> : null}
      <TextField
        testID="team-name"
        label="Name"
        value={name}
        onChangeText={value => {
          setName(value);
          errors.edited('name');
        }}
        error={errors.errorFor('name', server.name)}
      />
      <TextField
        testID="team-phone"
        label="Phone"
        value={phone}
        onChangeText={value => {
          setPhone(value);
          errors.edited('phone');
        }}
        keyboardType="phone-pad"
        placeholder="98765 43210"
        error={errors.errorFor('phone', server.phone)}
      />
      <TextField testID="team-designation" label="Designation" value={designation} onChangeText={setDesignation} placeholder="Technician" />
      {member ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color="textSecondary">
            Status
          </Text>
          <ChipGroup options={STATUSES} value={status} onChange={setStatus} />
        </View>
      ) : null}
      {member ? <DangerButton label="Remove team member" onPress={onRemove} /> : null}
    </Screen>
  );
}
