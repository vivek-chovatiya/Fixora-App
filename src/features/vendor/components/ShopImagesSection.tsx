/**
 * ShopImagesSection
 *
 * Section 38's "Shop Images" on the Profile tab: the photos as small squares,
 * or a plain sentence when there are none, and "Manage shop images" — the way
 * to the screen that adds and removes them (PROJECT_BIBLE.md section 38's
 * "Upload Shop Images").
 *
 * ⚠️ Read-only here. Nothing on this card uploads, removes or reorders; the
 * photos are drawn from the profile the vendor tree already holds
 * (`VendorProfileContext`), which the Shop images screen updates with every
 * change it saves — so returning to Profile shows them with no read of its own.
 *
 * Rows are built explicitly, each square a `flex: 1` cell with spacers keeping
 * a short last row the same size — `CategoryGrid`'s layout, exact at any width
 * where percentage widths around a gap are not — and every square is
 * cover-cropped to its cell. Never a fixed pixel width.
 *
 * Each photo is spoken as "Shop photo 2 of 4"; there is no "No photo" image
 * pretending to be content when there are none.
 */

import React, { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { Card, SecondaryButton, Text } from '@/shared/components';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.profile;
const PHOTO = VENDOR_COPY.shopImages;

export interface ShopImagesSectionProps {
  imageUrls: readonly string[];
  onManage: () => void;
  disabled?: boolean;
  testID?: string;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}

function ShopImagesSectionComponent({
  imageUrls,
  onManage,
  disabled = false,
  testID,
}: ShopImagesSectionProps) {
  const theme = useTheme();
  /*
    One more to a row than the grid's columns: these are previews inside a
    card, smaller than the photos on their own screen, and still enough to
    recognise one by.
  */
  const columns = useResponsive().columns + 1;
  const rows = useMemo(() => chunk(imageUrls, columns), [columns, imageUrls]);

  return (
    <Card
      bordered
      shadow="sm"
      style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
      testID={testID}>
      <Text variant="overline" color="textTertiary" accessibilityRole="header">
        {COPY.shopImagesSection}
      </Text>

      {imageUrls.length === 0 ? (
        <Text variant="body" color="textSecondary" testID={testID ? `${testID}-empty` : undefined}>
          {COPY.shopImagesEmpty}
        </Text>
      ) : (
        <View style={{ gap: theme.spacing.sm }} testID={testID ? `${testID}-photos` : undefined}>
          {rows.map((row, rowIndex) => (
            <View key={row[0]} style={[styles.row, { gap: theme.spacing.sm }]}>
              {row.map((url, index) => (
                <View
                  key={url}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={PHOTO.photoSpoken(
                    rowIndex * columns + index + 1,
                    imageUrls.length,
                  )}
                  style={[
                    styles.cell,
                    {
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.surfaceAlt,
                      borderWidth: theme.borderWidth.thin,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  testID={testID ? `${testID}-photo-${rowIndex * columns + index}` : undefined}>
                  <Image
                    source={{ uri: url }}
                    style={styles.image}
                    resizeMode="cover"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                </View>
              ))}

              {/* Keeps a short last row's squares the size of every other row's. */}
              {Array.from({ length: columns - row.length }, (_, index) => (
                <View key={`spacer-${index}`} style={styles.spacer} />
              ))}
            </View>
          ))}
        </View>
      )}

      <SecondaryButton
        label={COPY.shopImages}
        icon="gallery"
        onPress={onManage}
        disabled={disabled}
        fullWidth
        accessibilityHint={COPY.shopImagesHint}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    // Clips the photograph to the rounded corners.
    overflow: 'hidden',
  },
  spacer: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export const ShopImagesSection = memo(ShopImagesSectionComponent);
