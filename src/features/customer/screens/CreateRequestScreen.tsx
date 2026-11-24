import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { CustomerStackParamList } from '@/app/navigation/types';
import {
  Banner,
  Card,
  ChipGroup,
  DynamicIcon,
  ErrorState,
  Icon,
  ImageUploader,
  Loader,
  PrimaryButton,
  Row,
  Screen,
  SectionHeader,
  Text,
  TextField,
} from '@/shared/components';
import { useAppMeta } from '@/shared/hooks/useAppMeta';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useImageUploads } from '@/shared/hooks/useImageUploads';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { addressApi } from '@/shared/services/api';
import { Analytics } from '@/shared/services/analytics';
import { useTheme } from '@/shared/theme';
import type { Priority } from '@/shared/types/models';
import { formatCurrency, formatDayLabel, toPreferredDateIso } from '@/shared/utils/format';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CreateRequest'>;

const DAY_OPTIONS = 7;
const TIME_SLOTS = ['Morning (9–12)', 'Afternoon (12–4)', 'Evening (4–8)'];
const ANY_DAY = 'ANY';

export function CreateRequestScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { category, subCategory } = route.params;
  const meta = useAppMeta();
  const addresses = useServiceQuery(() => addressApi.list(), []);
  useRefreshOnFocus(addresses.refresh);
  const uploads = useImageUploads('REQUEST');

  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [addressId, setAddressId] = useState<string | null>(null);
  const [day, setDay] = useState<string>(ANY_DAY);
  const [time, setTime] = useState<string>('');
  const errors = useFormErrors<'description' | 'address'>();

  useEffect(() => {
    Analytics.track('request_started', { subCategoryId: subCategory.id });
  }, [subCategory.id]);

  // Preselect the default address; keep a valid selection when the list changes.
  useEffect(() => {
    const list = addresses.data ?? [];
    if (!list.length) return;
    if (!addressId || !list.some(a => a.id === addressId)) {
      setAddressId((list.find(a => a.isDefault) ?? list[0]).id);
    }
  }, [addresses.data, addressId]);

  const days = useMemo(() => {
    const result = [{ value: ANY_DAY, label: 'Any day' }];
    for (let i = 0; i < DAY_OPTIONS; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      result.push({ value: toPreferredDateIso(d), label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDayLabel(d) });
    }
    return result;
  }, []);

  const priorities = meta.data?.priorities ?? [];

  const onContinue = () => {
    const next = {
      description: description.trim().length >= 10 ? undefined : 'Please describe the problem in at least 10 characters.',
      address: addressId ? undefined : 'Please add a service address.',
    };
    errors.setErrors(next);
    if (next.description || next.address || uploads.isBusy || uploads.hasFailures) {
      return;
    }
    const address = (addresses.data ?? []).find(a => a.id === addressId)!;
    navigation.navigate('SelectVendor', {
      draft: {
        category,
        subCategory,
        description: description.trim(),
        notes: notes.trim(),
        priority,
        priorityLabel: priorities.find(p => p.value === priority)?.label ?? priority,
        images: uploads.urls,
        address: { id: address.id, title: address.title, fullAddress: address.fullAddress },
        preferredDate: day === ANY_DAY ? null : day,
        preferredDateLabel: day === ANY_DAY ? null : days.find(d => d.value === day)?.label ?? null,
        preferredTime: time,
      },
    });
  };

  const blockedByUploads = uploads.isBusy || uploads.hasFailures;

  return (
    <Screen
      testID="create-request-screen"
      footer={
        <PrimaryButton
          testID="create-request-continue"
          label={uploads.isBusy ? 'Uploading photos…' : 'Continue'}
          onPress={onContinue}
          disabled={blockedByUploads}
        />
      }>
      <Card>
        <Row gap="md">
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
            <DynamicIcon glyph={category.icon} size="md" color="primary" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{subCategory.name}</Text>
            <Text variant="caption" color="textSecondary">
              {category.name}
              {subCategory.estimatedPrice ? ` · from ${formatCurrency(subCategory.estimatedPrice)}` : ''}
            </Text>
          </View>
        </Row>
      </Card>

      <TextField
        testID="request-description"
        label="Describe the problem"
        multiline
        value={description}
        onChangeText={value => {
          setDescription(value);
          errors.edited('description');
        }}
        placeholder="e.g. The fan is making noise and stops after 10 minutes."
        error={errors.errorFor('description')}
        maxLength={2000}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textSecondary">
          Priority
        </Text>
        {meta.isLoading ? <Loader /> : null}
        {meta.error ? <ErrorState error={meta.error} onRetry={meta.retry} /> : null}
        <ChipGroup options={priorities} value={priority} onChange={setPriority} testIDPrefix="priority" toneFor={v => (v === 'EMERGENCY' ? 'danger' : 'primary')} />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textSecondary">
          Photos <Text variant="caption" color="textTertiary">(optional, helps the vendor understand the problem)</Text>
        </Text>
        <ImageUploader controller={uploads} />
      </View>

      <TextField testID="request-notes" label="Notes" optional multiline value={notes} onChangeText={setNotes} placeholder="Anything else the vendor should know" maxLength={1000} />

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textSecondary">
          Preferred date & time <Text variant="caption" color="textTertiary">(optional)</Text>
        </Text>
        <ChipGroup options={days} value={day} onChange={setDay} testIDPrefix="day" scroll inset={0} />
        <ChipGroup options={TIME_SLOTS.map(t => ({ value: t, label: t }))} value={time} onChange={v => setTime(v === time ? '' : v)} testIDPrefix="time" scroll inset={0} />
      </View>

      <SectionHeader title="Service address" actionLabel="Add new" onAction={() => navigation.navigate('AddressForm')} />
      {addresses.isLoading ? <Loader /> : null}
      {addresses.error ? <ErrorState error={addresses.error} onRetry={addresses.retry} /> : null}
      {addresses.data && addresses.data.length === 0 ? (
        <Banner tone="warning" icon="location" title="No saved address" message="Add the address where the service is needed.">
          <Pressable testID="create-request-add-address" onPress={() => navigation.navigate('AddressForm')} accessibilityRole="button">
            <Text variant="label" color="primary">
              Add address
            </Text>
          </Pressable>
        </Banner>
      ) : null}
      {(addresses.data ?? []).map(address => {
        const selected = address.id === addressId;
        return (
          <Card
            key={address.id}
            testID={`address-option-${address.title}`}
            accent={selected ? 'primary' : null}
            onPress={() => {
              setAddressId(address.id);
              errors.edited('address');
            }}
            accessibilityLabel={address.title}>
            <Row gap="md">
              <Icon name={selected ? 'success' : 'location'} size="md" color={selected ? 'primary' : 'textTertiary'} />
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <Text variant="bodyStrong">{address.title}</Text>
                <Text variant="caption" color="textSecondary">
                  {address.fullAddress}
                </Text>
              </View>
            </Row>
          </Card>
        );
      })}
      {errors.errorFor('address') && !addressId ? (
        <Text variant="caption" color="danger">
          {errors.errorFor('address')}
        </Text>
      ) : null}
    </Screen>
  );
}
