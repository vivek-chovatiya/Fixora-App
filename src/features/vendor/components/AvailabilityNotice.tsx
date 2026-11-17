/**
 * AvailabilityNotice
 *
 * Said on the dashboard while the vendor is not accepting new requests
 * (PROJECT_BIBLE.md section 38, "Availability"), with "Turn on" — so a vendor
 * who switched new requests off and forgot is told where they look first, not
 * only on Profile.
 *
 * ⚠️ A sibling of `StaleNotice`, not a use of it. They share a look — the
 * warning tone, its glyph, a line and a button under it — on purpose: one
 * notice style in the app. But that one says a list could not be refreshed,
 * is announced as an alert the moment it appears and offers a retry; this one
 * is a standing state the vendor chose, and its button changes that state.
 * Bending the stale notice to say this would make its words and its glyph
 * wrong for one of the two.
 *
 * Not an error (section 49.1): nothing has failed, so no danger tone and no
 * alert role — the warning tone is for a state with a cost, here work not
 * offered. It acts only through the callback it is given; turning new requests
 * on never asks (it loses nothing), so the button does exactly what it says.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { Card, Icon, SecondaryButton, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.availability;

export interface AvailabilityNoticeProps {
  onTurnOn: () => void;
  /** The change is in the air: the button is busy. */
  isTurningOn: boolean;
  testID?: string;
}

function AvailabilityNoticeComponent({ onTurnOn, isTurningOn, testID }: AvailabilityNoticeProps) {
  const theme = useTheme();

  return (
    <Card
      bordered
      background="warningSubtle"
      shadow="none"
      style={{ gap: theme.spacing.md }}
      testID={testID}>
      <View
        style={[styles.row, { gap: theme.spacing.sm }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={COPY.noticeTitle}>
        {/* The tint's own ink, words and glyph (3G-4): `warning` is 2.9:1 here in light. */}
        <Icon name="warning" size="md" color="onWarningSubtle" />
        {/* A definite width, so the sentence wraps rather than clips (3E-3). */}
        <Text variant="bodyStrong" color="onWarningSubtle" style={styles.copy}>
          {COPY.noticeTitle}
        </Text>
      </View>

      <SecondaryButton
        label={COPY.noticeTurnOn}
        onPress={onTurnOn}
        isLoading={isTurningOn}
        fullWidth
        accessibilityLabel={COPY.noticeTurnOnSpoken}
        accessibilityHint={COPY.noticeTurnOnHint}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
  },
});

export const AvailabilityNotice = memo(AvailabilityNoticeComponent);
