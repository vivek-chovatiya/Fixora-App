/**
 * CategoryTile
 *
 * One service category, as something to tap.
 *
 * ⚠️ It knows no category names. The glyph comes from the backend through
 * DynamicIcon, which falls back safely for a name it does not recognise, and the
 * label is rendered rather than matched — so a category added to the catalogue
 * tomorrow needs no release (PROJECT_BIBLE.md section 11).
 *
 * Laid out along the row rather than stacked, because the grid gives a tile
 * roughly half the page at every phone width. A centred icon above a centred
 * word in a box that wide leaves a lake of empty space in the middle of it.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { Card, DynamicIcon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface CategoryTileProps {
  name: string;
  /** Backend-supplied glyph. Absent is normal; DynamicIcon draws the fallback. */
  iconGlyph?: string;
  onPress: () => void;
  /**
   * What tapping this tile does, which is not the same in both places it is
   * used: on Home it opens the catalogue, on the catalogue it opens a category.
   */
  accessibilityHint?: string;
  testID?: string;
}

function CategoryTileComponent({
  name,
  iconGlyph,
  onPress,
  accessibilityHint = CUSTOMER_COPY.home.categoryHint,
  testID,
}: CategoryTileProps) {
  const theme = useTheme();

  return (
    <Card
      onPress={onPress}
      // Bordered as well as raised: a soft shadow all but disappears on the dark
      // theme, and a tile without an edge stops reading as a target.
      bordered
      padded={false}
      shadow="sm"
      style={[styles.card, { padding: theme.spacing.md, gap: theme.spacing.md }]}
      accessibilityLabel={name}
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

      <Text variant="label" numberOfLines={2} style={styles.label}>
        {name}
      </Text>
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
  label: {
    // Wraps within the tile instead of pushing the tile wider than its share of
    // the row, which would break the grid's alignment.
    flexShrink: 1,
  },
});

export const CategoryTile = memo(CategoryTileComponent);
