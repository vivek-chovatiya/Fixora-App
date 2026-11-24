import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { AuthStackParamList } from '@/app/navigation/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { Banner, Icon, PrimaryButton, Screen, SegmentedControl, Text, TextField } from '@/shared/components';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { useTheme } from '@/shared/theme';
import type { UserRole } from '@/shared/types/models';
import { compact, hasErrors, validators } from '@/shared/utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
type Field = 'identifier' | 'password';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'CUSTOMER', label: 'I need a service' },
  { value: 'VENDOR', label: "I'm a service provider" },
];

const HEADING: Record<UserRole, { title: string; subtitle: string }> = {
  CUSTOMER: { title: 'Welcome back', subtitle: 'Log in to book and track your services.' },
  VENDOR: { title: 'Provider login', subtitle: 'Manage your requests, team and reviews.' },
  ADMIN: { title: 'Admin login', subtitle: 'Platform administration.' },
};

export function LoginScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { signIn } = useAuth();
  const [role, setRole] = useState<UserRole>(route.params?.role ?? 'CUSTOMER');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const form = useFormErrors<Field>();
  const login = useServiceMutation(signIn);

  const onSubmit = async () => {
    const next = compact<Field>({
      identifier: validators.required(identifier, 'Email or phone'),
      password: validators.required(password, 'Password'),
    });
    form.setErrors(next);
    if (hasErrors(next)) {
      return;
    }
    await login.mutate(identifier, password, role);
  };

  const heading = HEADING[role];

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ paddingTop: theme.spacing.giant, width: '100%', maxWidth: 440, alignSelf: 'center' }}>
      <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View style={{ width: 40, height: 40, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="fallback" size="md" color="onPrimary" />
          </View>
          <Text variant="h2">Fixora</Text>
        </View>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h1">{heading.title}</Text>
          <Text variant="body" color="textSecondary">
            {heading.subtitle}
          </Text>
        </View>
      </View>

      {role !== 'ADMIN' ? <SegmentedControl options={ROLE_OPTIONS} value={role} onChange={setRole} testIDPrefix="login-role" /> : null}

      {login.error && !login.error.fieldErrors ? (
        <Banner
          testID="login-error"
          tone={login.error.kind === 'network' ? 'warning' : 'danger'}
          icon={login.error.kind === 'network' ? 'offline' : 'error'}
          message={login.error.userMessage}
        />
      ) : null}

      <TextField
        testID="login-identifier"
        label="Email or phone"
        value={identifier}
        onChangeText={value => {
          setIdentifier(value);
          form.edited('identifier');
        }}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com or 98765 43210"
        error={form.errorFor('identifier')}
      />
      <View style={{ gap: theme.spacing.sm }}>
        <TextField
          testID="login-password"
          label="Password"
          value={password}
          onChangeText={value => {
            setPassword(value);
            form.edited('password');
          }}
          secure
          autoComplete="password"
          placeholder="Your password"
          error={form.errorFor('password')}
          onSubmitEditing={onSubmit}
        />
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('ForgotPassword', { role, identifier })} style={{ alignSelf: 'flex-end' }} hitSlop={8}>
          <Text variant="label" color="primary">
            Forgot password?
          </Text>
        </Pressable>
      </View>

      <PrimaryButton testID="login-submit" label="Log in" onPress={onSubmit} loading={login.isSubmitting} />

      {role !== 'ADMIN' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs }}>
          <Text variant="body" color="textSecondary">
            {role === 'VENDOR' ? 'New service provider?' : "Don't have an account?"}
          </Text>
          <Pressable
            testID="login-signup"
            accessibilityRole="button"
            onPress={() => navigation.navigate(role === 'VENDOR' ? 'VendorSignup' : 'CustomerSignup')}
            hitSlop={8}>
            <Text variant="bodyStrong" color="primary">
              {role === 'VENDOR' ? 'Register your business' : 'Sign up'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        testID="login-admin-toggle"
        accessibilityRole="button"
        onPress={() => setRole(role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN')}
        style={{ alignSelf: 'center', marginTop: theme.spacing.xl }}
        hitSlop={8}>
        <Text variant="caption" color="textTertiary">
          {role === 'ADMIN' ? 'Back to customer & provider login' : 'Platform admin? Log in here'}
        </Text>
      </Pressable>
    </Screen>
  );
}
