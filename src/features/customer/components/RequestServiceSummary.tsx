/**
 * RequestServiceSummary
 *
 * What the customer is asking for, at the top of the form.
 *
 * ⚠️ It confirms, it does not decide. The screen arrived with two identifiers
 * and asked the catalogue what they mean; this draws the answer so the customer
 * can see they tapped the right thing before filling in a form about it.
 *
 * Both names are shown because either alone is ambiguous. "Fan repair" does not
 * say who is coming, and "Electrician" does not say what for.
 *
 * A name that has not arrived is drawn as a placeholder rather than as an empty
 * space, and a name that never arrives leaves the fallback standing. The screen
 * does not wait for either: PROJECT_BIBLE.md section 11 makes the catalogue the
 * backend's, so a caption is the one thing on this screen the app is entitled to
 * be unsure about.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/features/customer/components/Skeleton';
import { Card, DynamicIcon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface RequestServiceSummaryProps {
  /** The service. Undefined while the catalogue is still answering. */
  serviceName?: string;
  /** The category it came from. Undefined for the same reason. */
  categoryName?: string;
  /** Shown in place of the service name when it is not known. */
  fallbackName: string;
  isLoading: boolean;
  testID?: string;
}

/** Room for one line of text, so nothing moves when the name arrives. */
const LINE_HEIGHT = 20;

function RequestServiceSummaryComponent({
  serviceName,
  categoryName,
  fallbackName,
  isLoading,
  testID,
}: RequestServiceSummaryProps) {
  const theme = useTheme();

  return (
    <Card
      bordered
      shadow="sm"
      style={[styles.card, { padding: theme.spacing.lg, gap: theme.spacing.md }]}
      testID={testID}>
      <View
        style={[
          styles.glyph,
          {
            backgroundColor: theme.colors.primarySubtle,
            borderRadius: theme.radius.full,
            width: theme.spacing.huge,
            height: theme.spacing.huge,
          },
        ]}>
        {/*
          No glyph is passed even though the catalogue supplies one. This card
          says what was chosen, and the icon that helped someone find it in a
          grid is not part of that — the fallback tool is the same mark on every
          request, which is what makes this block read as a summary rather than
          as another tappable service.
        */}
        <DynamicIcon size="md" color="primary" />
      </View>

      {/*
        One node, one announcement. Read as two lines it is "Electrician" then
        "Fan repair", which sounds like two things rather than one thing in a
        category.
      */}
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          categoryName
            ? `${serviceName ?? fallbackName}, in ${categoryName}`
            : (serviceName ?? fallbackName)
        }
        style={[styles.body, { gap: theme.spacing.xxs }]}>
        {isLoading && !serviceName ? (
          <Skeleton height={LINE_HEIGHT} width="70%" radiusToken="sm" />
        ) : (
          <Text variant="bodyStrong">{serviceName ?? fallbackName}</Text>
        )}

        {isLoading && !categoryName ? (
          <Skeleton height={LINE_HEIGHT} width="45%" radiusToken="sm" />
        ) : categoryName ? (
          <Text variant="caption" color="textSecondary">
            {categoryName}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
});

export const RequestServiceSummary = memo(RequestServiceSummaryComponent);
