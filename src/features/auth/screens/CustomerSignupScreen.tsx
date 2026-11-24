import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { AuthStackParamList } from '@/app/navigation/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { Banner, GhostButton, PrimaryButton, Screen, Text, TextField } from '@/shared/components';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { useTheme } from '@/shared/theme';
import { compact, hasErrors, mergeFieldErrors, normalizePhone, validators } from '@/shared/utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'CustomerSignup'>;
const FIELDS = ['firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword'] as const;
type Field = (typeof FIELDS)[number];

export function CustomerSignupScreen({ navigation }: Props) {
  const theme = useTheme();
  const { signUpCustomer } = useAuth();
  const [form, setForm] = useState<Record<Field, string>>({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const errors = useFormErrors<Field>();
  const signup = useServiceMutation(signUpCustomer);

  const set = (key: Field) => (value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    errors.edited(key);
  };

  const onSubmit = async () => {
    const next = compact<Field>({
      firstName: validators.required(form.firstName, 'First name'),
      email: validators.email(form.email),
      phone: validators.phone(form.phone),
      password: validators.password(form.password),
      confirmPassword: form.confirmPassword === form.password ? undefined : 'Passwords do not match.',
    });
    errors.setErrors(next);
    if (hasErrors(next)) {
      return;
    }
    await signup.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: normalizePhone(form.phone),
      password: form.password,
    });
  };

  const serverErrors = mergeFieldErrors(signup.error, FIELDS);
  const errorFor = (key: Field) => errors.errorFor(key, serverErrors[key]);

  return (
    <Screen contentStyle={{ width: '100%', maxWidth: 520, alignSelf: 'center' }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">Create your account</Text>
        <Text variant="body" color="textSecondary">
          Book trusted professionals for any home service.
        </Text>
      </View>
      {signup.error && !signup.error.fieldErrors ? <Banner tone="danger" icon="error" message={signup.error.userMessage} /> : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField testID="signup-firstName" label="First name" value={form.firstName} onChangeText={set('firstName')} error={errorFor('firstName')} autoComplete="given-name" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField testID="signup-lastName" label="Last name" optional value={form.lastName} onChangeText={set('lastName')} error={errorFor('lastName')} autoComplete="family-name" />
        </View>
      </View>
      <TextField testID="signup-email" label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" error={errorFor('email')} />
      <TextField testID="signup-phone" label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="98765 43210" error={errorFor('phone')} />
      <TextField testID="signup-password" label="Password" value={form.password} onChangeText={set('password')} secure helper="At least 8 characters" error={errorFor('password')} />
      <TextField testID="signup-confirmPassword" label="Confirm password" value={form.confirmPassword} onChangeText={set('confirmPassword')} secure error={errorFor('confirmPassword')} />
      <PrimaryButton testID="signup-submit" label="Create account" onPress={onSubmit} loading={signup.isSubmitting} />
      <GhostButton label="Back to login" onPress={() => navigation.goBack()} />
    </Screen>
  );
}
