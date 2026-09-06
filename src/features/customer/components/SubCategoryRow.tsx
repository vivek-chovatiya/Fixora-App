/**
 * SubCategoryRow
 *
 * One service inside a category, as something to tap.
 *
 * A row rather than a tile, which is the difference between this screen and the
 * one before it. A category is a word — "Plumber" — and reads well in a grid; a
 * service is a phrase, sometimes with a line of explanation under it, and a grid
 * of those is a grid of wrapped text. The full width also leaves room for the
 * chevron that says this leads somewhere, which the catalogue's tiles do not
 * need because everything on that screen leads somewhere.
 *
 * ⚠️ It knows no service. Name, description and glyph all come from the backend,
 * and the description is drawn only when there is one — PROJECT_BIBLE.md section
 * 12 says render whatever comes back, which includes rendering nothing where the
 * backend has nothing to say.
 *
 * The whole row is one target and one announcement. The description is folded
 * into the spoken name rather than left as a separate node, because a Pressable
 * with a label does not read its children — without that, anyone using a screen
 * reader would lose the line that explains what the service covers.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, DynamicIcon, Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface SubCategoryRowProps {
  name: string;
  /** Backend-supplied. Absent is normal and draws nothing. */
  description?: string;
  /** Backend-supplied glyph. Absent is normal; DynamicIcon draws the fallback. */
  iconGlyph?: string;
  accessibilityHint?: string;
  onPress: () => void;
  testID?: string;
}

function SubCategoryRowComponent({
  name,
  description,
  iconGlyph,
  accessibilityHint,
  onPress,
  testID,
}: SubCategoryRowProps) {
  const theme = useTheme();

  return (
    <Card
      onPress={onPress}
      // Bordered as well as raised: a soft shadow all but disappears on the dark
      // theme, and a row without an edge stops reading as a target.
      bordered
      padded={false}
      shadow="sm"
      style={[styles.row, { padding: theme.spacing.md, gap: theme.spacing.md }]}
      accessibilityLabel={description ? `${name}. ${description}` : name}
      accessibilityHint={accessibilityHint}
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
        <DynamicIcon glyph={iconGlyph} size="md" color="primary" />
      </View>

      <View style={[styles.body, { gap: theme.spacing.xxs }]}>
        <Text variant="bodyStrong">{name}</Text>

        {description ? (
          <Text variant="caption" color="textSecondary">
            {description}
          </Text>
        ) : null}
      </View>

      {/*
        Affordance only. The row is the button, and a chevron announced beside it
        would be a second thing to hear about the same one thing.
      */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="forward" size="md" color="textTertiary" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    // Takes the slack, so a long name wraps inside the row instead of pushing
    // the chevron off the end of it.
    flex: 1,
  },
});

export const SubCategoryRow = memo(SubCategoryRowComponent);
