/**
 * VendorAuthCodeDisplay
 *
 * Shows the vendor their permanent authentication code, once.
 *
 * Presentational. It receives the code, renders it, and reports two intents —
 * copy and continue. It holds no service call and no navigation, so the one
 * place the credential can be acted upon stays the container above it.
 *
 * The code is six digits (owner's decision, 21/10/2026), and it is drawn the way
 * a person reads six digits back: in two groups, "482 913". That is the eye's
 * version only. It is spoken digit by digit, so TalkBack says "4 8 2 9 1 3"
 * rather than a number in the hundreds of thousands, and the container copies
 * the code as issued — the bare digits, no space. A code that is not all digits
 * is shown untouched rather than mangled (`groupVendorAuthCode`).
 *
 * Copying must never authenticate. That is a rule about this screen, not just a
 * detail of it: a vendor who copies their code has still not proved they saved
 * it, which is the entire point of the confirmation step that follows.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import {
  groupVendorAuthCode,
  spellOut,
} from '@/features/auth/constants/vendorAuthPresentation';
import { Card, Icon, PrimaryButton, SecondaryButton, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = AUTH_COPY.vendorAuthCode;

export interface VendorAuthCodeDisplayProps {
  /** The code itself, as issued. Grouped for display; never altered. */
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
        <Text
          variant="h2"
          accessibilityLabel={spellOut(code)}
          testID="vendor-auth-code-value">
          {groupVendorAuthCode(code)}
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
