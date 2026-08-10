/**
 * VendorAuthCodeDisplay
 *
 * Shows the vendor their permanent authentication code, once.
 *
 * Presentational. It receives the code, renders it, and reports two intents —
 * copy and continue. It holds no service call and no navigation, so the one
 * place the credential can be acted upon stays the container above it.
 *
 * The code is treated as an opaque string: not split, not reformatted, not
 * validated. The backend owns its shape, and a display that assumed one would
 * break the day generation changes (PROJECT_BIBLE.md section 7A.2).
 *
 * Copying must never authenticate. That is a rule about this screen, not just a
 * detail of it: a vendor who copies their code has still not proved they saved
 * it, which is the entire point of the confirmation step that follows.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { Card, Icon, PrimaryButton, SecondaryButton, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = AUTH_COPY.vendorAuthCode;

export interface VendorAuthCodeDisplayProps {
  /** The code itself. Rendered verbatim. */
  code: string;
  /** Copies the code. Resolves false when the clipboard could not be written. */
  onCopy: () => Promise<boolean>;
  onContinue: () => void;
}

export function VendorAuthCodeDisplay({ code, onCopy, onContinue }: VendorAuthCodeDisplayProps) {
  const theme = useTheme();

  const [hasCopied, setHasCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = useCallback(() => {
    void (async () => {
      const copied = await onCopy();
      setHasCopied(copied);
      setCopyFailed(!copied);
    })();
  }, [onCopy]);

  return (
    <View style={{ gap: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">{COPY.displayTitle}</Text>
        <Text variant="body" color="textSecondary">
          {COPY.displayBody}
        </Text>
      </View>

      <Card bordered style={{ gap: theme.spacing.sm }}>
        <Text variant="overline" color="textTertiary">
          {COPY.codeLabel}
        </Text>
        <Text variant="h2" testID="vendor-auth-code-value">
          {code}
        </Text>
      </Card>

      <View style={[styles.warning, { gap: theme.spacing.sm }]}>
        <Icon name="warning" size="md" color="warning" />
        <Text variant="caption" color="textSecondary" style={styles.warningText}>
          {COPY.displayWarning}
        </Text>
      </View>

      {copyFailed ? (
        <Text variant="caption" color="danger">
          {COPY.copyFailed}
        </Text>
      ) : null}

      <View style={{ gap: theme.spacing.md }}>
        <SecondaryButton
          fullWidth
          label={hasCopied ? COPY.copied : COPY.copy}
          icon={hasCopied ? 'success' : 'document'}
          onPress={handleCopy}
          accessibilityHint={COPY.copyHint}
        />

        {/*
          Deliberately separate from copying. Continuing is the vendor saying
          they saved the code; copying is not a claim that they did.
        */}
        <PrimaryButton
          fullWidth
          label={COPY.continueAction}
          onPress={onContinue}
          accessibilityHint={COPY.continueHint}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
  },
});
