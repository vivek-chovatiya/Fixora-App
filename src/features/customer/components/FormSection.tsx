/**
 * FormSection
 *
 * A labelled part of the request form: a heading, an optional line explaining
 * it, and whatever the section is made of.
 *
 * ⚠️ Not a card. Six of these on one screen, each on its own raised surface,
 * would be six boxes competing with the one control that matters — hierarchy by
 * heading and spacing, with surfaces kept for the things that are genuinely
 * objects, such as the service being requested and each attached photo.
 *
 * `HomeSection` is the same idea for a different job and is deliberately left
 * alone: it carries a trailing action and clips its title to one line, which is
 * right for "Recent requests — See all" and wrong for a question. Adding a
 * supporting line to it would mean editing a locked screen's component to serve
 * a screen it has never heard of.
 *
 * The heading is a real header, so a screen reader user can move between the
 * parts of a long form instead of walking every control in it.
 */

import React, { memo, type ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface FormSectionProps {
  title: string;
  children: ReactNode;
  /** One line under the heading. For what the section is for, or that it is optional. */
  support?: string;
  testID?: string;
}

function FormSectionComponent({ title, children, support, testID }: FormSectionProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }} testID={testID}>
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>

        {support ? (
          <Text variant="caption" color="textSecondary">
            {support}
          </Text>
        ) : null}
      </View>

      {children}
    </View>
  );
}

export const FormSection = memo(FormSectionComponent);
