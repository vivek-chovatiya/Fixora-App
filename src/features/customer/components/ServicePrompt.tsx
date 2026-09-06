/**
 * ServicePrompt
 *
 * The question the home screen exists to ask, and the button that answers it.
 *
 * PROJECT_BIBLE.md section 10 is specific: Home must immediately communicate
 * "What service do you need?" and its primary action is Request a Service. So
 * this is the largest type on the page and the only filled button on it —
 * everything below is discovery and history, which is to say ways of answering
 * the same question more slowly.
 *
 * Deliberately not a card. The prompt is the page, not a panel on it, and a
 * heading in a box reads as an advertisement for the screen rather than as the
 * screen. It also keeps this consistent with the authentication flow, where a
 * hero heading, a supporting line and a capsule button are already what a
 * screen's opening move looks like.
 */

import React, { memo } from 'react';
import { View } from 'react-native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { PrimaryButton, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.home;

export interface ServicePromptProps {
  onRequestService: () => void;
  testID?: string;
}

function ServicePromptComponent({ onRequestService, testID }: ServicePromptProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }} testID={testID}>
      <Text variant="hero" accessibilityRole="header">
        {COPY.prompt}
      </Text>

      <Text variant="subtitle" color="textSecondary">
        {COPY.promptSupport}
      </Text>

      <PrimaryButton
        fullWidth
        label={COPY.primaryAction}
        // An arrow after the words, not a chevron before them: this button moves
        // the user on rather than naming a thing.
        icon="arrowForward"
        iconPosition="trailing"
        accessibilityHint={COPY.primaryActionHint}
        onPress={onRequestService}
        // Its own breathing room. The gap above holds a heading to its
        // supporting line, which is closer than a control wants to sit.
        style={{ marginTop: theme.spacing.sm }}
      />
    </View>
  );
}

export const ServicePrompt = memo(ServicePromptComponent);
