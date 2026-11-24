import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { AuthStackParamList } from '@/app/navigation/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { Banner, Card, Chip, ErrorState, GhostButton, Loader, PrimaryButton, Row, Screen, Text, TextField } from '@/shared/components';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { catalogApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { compact, hasErrors, mergeFieldErrors, normalizePhone, validators } from '@/shared/utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'VendorSignup'>;
const FIELDS = ['businessName', 'ownerName', 'email', 'phone', 'password', 'address', 'workingAreas', 'workingHours', 'description', 'categoryIds'] as const;
type Field = (typeof FIELDS)[number];
type TextKey = Exclude<Field, 'categoryIds'>;

export function VendorSignupScreen({ navigation }: Props) {
  const theme = useTheme();
  const { signUpVendor } = useAuth();
  const categories = useServiceQuery(() => catalogApi.categories(), []);
  const [form, setForm] = useState<Record<TextKey, string>>({
    businessName: '', ownerName: '', email: '', phone: '', password: '', address: '', workingAreas: '', workingHours: '', description: '',
  });
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const errors = useFormErrors<Field>();
  const signup = useServiceMutation(signUpVendor);

  const set = (key: TextKey) => (value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    errors.edited(key);
  };
  const toggleCategory = (id: string) => {
    setCategoryIds(ids => (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]));
    errors.edited('categoryIds');
  };

  const onSubmit = async () => {
    const next = compact<Field>({
      businessName: validators.minLength(form.businessName, 2, 'Business name'),
      ownerName: validators.minLength(form.ownerName, 2, 'Owner name'),
      email: validators.email(form.email),
      phone: validators.phone(form.phone),
      password: validators.password(form.password),
      address: validators.minLength(form.address, 3, 'Shop address'),
      categoryIds: categoryIds.length ? undefined : 'Select at least one service category.',
    });
    errors.setErrors(next);
    if (hasErrors(next)) {
      return;
    }
    await signup.mutate({
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      email: form.email.trim(),
      phone: normalizePhone(form.phone),
      password: form.password,
      address: form.address.trim(),
      description: form.description.trim(),
      workingHours: form.workingHours.trim(),
      workingAreas: form.workingAreas.split(',').map(s => s.trim()).filter(Boolean),
      categoryIds,
    });
  };

  const serverErrors = mergeFieldErrors(signup.error, FIELDS);
  const errorFor = (key: Field) => errors.errorFor(key, serverErrors[key]);

  return (
    <Screen contentStyle={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">Register your business</Text>
        <Text variant="body" color="textSecondary">
          Our team verifies every provider before they start receiving requests.
        </Text>
      </View>
      {signup.error && !signup.error.fieldErrors ? <Banner tone="danger" icon="error" message={signup.error.userMessage} /> : null}

      <Card>
        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="overline" color="textTertiary">
            Business
          </Text>
          <TextField testID="vendor-businessName" label="Business name" value={form.businessName} onChangeText={set('businessName')} error={errorFor('businessName')} />
          <TextField testID="vendor-ownerName" label="Owner name" value={form.ownerName} onChangeText={set('ownerName')} error={errorFor('ownerName')} />
          <TextField testID="vendor-address" label="Shop address" value={form.address} onChangeText={set('address')} error={errorFor('address')} />
          <TextField testID="vendor-workingAreas" label="Working areas" optional helper="Comma separated, e.g. Satellite, Vastrapur" value={form.workingAreas} onChangeText={set('workingAreas')} />
          <TextField testID="vendor-workingHours" label="Working hours" optional placeholder="Mon–Sat, 9 AM – 7 PM" value={form.workingHours} onChangeText={set('workingHours')} />
          <TextField testID="vendor-description" label="About your business" optional multiline value={form.description} onChangeText={set('description')} />
        </View>
      </Card>

      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="overline" color="textTertiary">
            Services you offer
          </Text>
          {categories.isLoading ? <Loader /> : null}
          {categories.error ? <ErrorState error={categories.error} onRetry={categories.retry} /> : null}
          <Row gap="sm" style={{ flexWrap: 'wrap' }}>
            {(categories.data ?? []).map(category => (
              <Chip key={category.id} testID={`vendor-category-${category.name}`} label={category.name} selected={categoryIds.includes(category.id)} onPress={() => toggleCategory(category.id)} />
            ))}
          </Row>
          {errorFor('categoryIds') ? (
            <Text variant="caption" color="danger">
              {errorFor('categoryIds')}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="overline" color="textTertiary">
            Login details
          </Text>
          <TextField testID="vendor-email" label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" error={errorFor('email')} />
          <TextField testID="vendor-phone" label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="98765 43210" error={errorFor('phone')} />
          <TextField testID="vendor-password" label="Password" value={form.password} onChangeText={set('password')} secure helper="At least 8 characters" error={errorFor('password')} />
        </View>
      </Card>

      <PrimaryButton testID="vendor-signup-submit" label="Submit for verification" onPress={onSubmit} loading={signup.isSubmitting} />
      <GhostButton label="Back to login" onPress={() => navigation.goBack()} />
    </Screen>
  );
}
