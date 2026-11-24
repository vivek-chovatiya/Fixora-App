import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { AuthStackParamList } from '@/app/navigation/types';
import { Banner, GhostButton, PrimaryButton, Screen, Text, TextField, useToast } from '@/shared/components';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { authApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { compact, hasErrors, mergeFieldErrors, validators } from '@/shared/utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
type Field = 'identifier' | 'code' | 'newPassword';

export function ForgotPasswordScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const theme = useTheme();
  const toast = useToast();
  const [identifier, setIdentifier] = useState(route.params.identifier ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [devCode, setDevCode] = useState<string | null>(null);
  const errors = useFormErrors<Field>();
  const requestCode = useServiceMutation(authApi.forgotPassword);
  const reset = useServiceMutation(authApi.resetPassword);

  const onRequest = async () => {
    const next = compact<Field>({ identifier: validators.required(identifier, 'Email or phone') });
    errors.setErrors(next);
    if (hasErrors(next)) return;
    const result = await requestCode.mutate(identifier.trim(), role);
    if (result) {
      setDevCode(result.devResetCode ?? null);
      setStep('reset');
    }
  };

  const onReset = async () => {
    const next = compact<Field>({
      code: /^\d{6}$/.test(code.trim()) ? undefined : 'Enter the 6-digit code.',
      newPassword: validators.password(newPassword),
    });
    errors.setErrors(next);
    if (hasErrors(next)) return;
    const ok = await reset.mutate({ identifier: identifier.trim(), role, code: code.trim(), newPassword });
    if (ok !== null) {
      toast.show('Password updated. Please log in.');
      navigation.navigate('Login', { role });
    }
  };

  const serverErrors = mergeFieldErrors(reset.error, ['code', 'newPassword'] as const);

  return (
    <Screen contentStyle={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">Reset password</Text>
        {step === 'request' ? (
          <Text variant="body" color="textSecondary">
            Enter the email or phone number of your {role === 'VENDOR' ? 'provider ' : ''}account and we'll send you a reset code.
          </Text>
        ) : null}
      </View>
      {step === 'request' ? (
        <>
          {requestCode.error ? <Banner tone="danger" icon="error" message={requestCode.error.userMessage} /> : null}
          <TextField
            testID="forgot-identifier"
            label="Email or phone"
            value={identifier}
            onChangeText={value => {
              setIdentifier(value);
              errors.edited('identifier');
            }}
            autoCapitalize="none"
            error={errors.errorFor('identifier')}
          />
          <PrimaryButton testID="forgot-submit" label="Send reset code" onPress={onRequest} loading={requestCode.isSubmitting} />
        </>
      ) : (
        <>
          <Banner tone="success" icon="success" message={requestCode.data?.message ?? 'If an account exists, a reset code has been sent.'} />
          {devCode ? <Banner testID="dev-reset-code" tone="warning" icon="info" title="Development build" message={`Your reset code is ${devCode}`} /> : null}
          {reset.error && !reset.error.fieldErrors ? <Banner tone="danger" icon="error" message={reset.error.userMessage} /> : null}
          <TextField
            testID="reset-code"
            label="Reset code"
            value={code}
            onChangeText={value => {
              setCode(value);
              errors.edited('code');
            }}
            keyboardType="number-pad"
            maxLength={6}
            error={errors.errorFor('code', serverErrors.code)}
          />
          <TextField
            testID="reset-password"
            label="New password"
            value={newPassword}
            onChangeText={value => {
              setNewPassword(value);
              errors.edited('newPassword');
            }}
            secure
            error={errors.errorFor('newPassword', serverErrors.newPassword)}
          />
          <PrimaryButton testID="reset-submit" label="Update password" onPress={onReset} loading={reset.isSubmitting} />
          <GhostButton label="Send a new code" onPress={() => setStep('request')} />
        </>
      )}
    </Screen>
  );
}
