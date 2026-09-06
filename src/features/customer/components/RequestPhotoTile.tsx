/**
 * RequestPhotoTile
 *
 * One attached photograph, and how its upload is going
 * (PROJECT_BIBLE.md section 16).
 *
 * ⚠️ The state is on the photograph it belongs to. Section 16 requires upload
 * progress and failure to be shown clearly, and a single line under the row
 * saying "1 of 3 failed" leaves the customer to work out which — so the tile
 * that failed is the tile that says so, with its retry on it.
 *
 * Every state is a glyph and a word, never a tint. A dimmed thumbnail with a red
 * cast is invisible to most of the people section 46 is written for, and it is
 * indistinguishable from a dark photograph to everyone else.
 */

import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import type { RequestPhoto } from '@/features/customer/hooks/useRequestPhotos';
import { Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.createRequest;

/** Big enough to recognise a photograph in, small enough for four on a row. */
export const PHOTO_TILE_SIZE = 96;

export interface RequestPhotoTileProps {
  photo: RequestPhoto;
  /** Position in the row, for an announcement that says which photo this is. */
  index: number;
  onRemove: (assetId: string) => void;
  onRetry: (assetId: string) => void;
  testID?: string;
}

/** The word beside the glyph, so the state never rests on colour. */
function statusLabel(photo: RequestPhoto): string | null {
  switch (photo.status) {
    case 'uploading':
      return COPY.photoUploading;
    case 'failed':
      return COPY.photoFailed;
    default:
      return null;
  }
}

function RequestPhotoTileComponent({
  photo,
  index,
  onRemove,
  onRetry,
  testID,
}: RequestPhotoTileProps) {
  const theme = useTheme();

  const label = statusLabel(photo);
  const hasFailed = photo.status === 'failed';
  /** Spoken as "Photo 2, upload failed" rather than as an unnamed image. */
  const name = `${COPY.photosTitle} ${index + 1}${label ? `, ${label}` : ''}`;

  return (
    <View
      style={[
        styles.tile,
        {
          width: PHOTO_TILE_SIZE,
          height: PHOTO_TILE_SIZE,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceAlt,
          borderWidth: theme.borderWidth.thin,
          borderColor: hasFailed ? theme.colors.danger : theme.colors.border,
        },
      ]}
      testID={testID}>
      <Image
        source={{ uri: photo.asset.uri }}
        style={styles.image}
        resizeMode="cover"
        // The tile below announces itself. An image with its own label would be
        // a second node saying the same thing about the same photograph.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      {label ? (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={name}
          style={[
            styles.overlay,
            { backgroundColor: theme.colors.overlay, gap: theme.spacing.xxs },
          ]}>
          <Icon
            name={hasFailed ? 'warning' : 'upload'}
            size="md"
            color={hasFailed ? 'danger' : 'textInverse'}
          />
          <Text variant="caption" color="textInverse" align="center">
            {label}
          </Text>
        </View>
      ) : null}

      {hasFailed ? (
        <Pressable
          onPress={() => onRetry(photo.asset.id)}
          // Covers the tile: after a failure the whole thumbnail is the retry,
          // which is a larger target than any corner button and is where
          // someone looking at the failure is already pointing.
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={`${COPY.photoRetry}, ${name}`}
          testID={testID ? `${testID}-retry` : undefined}
        />
      ) : null}

      <Pressable
        onPress={() => onRemove(photo.asset.id)}
        // Padding rather than a larger circle: the drawn mark stays small on a
        // 96dp tile while the target reaches the accessibility floor.
        hitSlop={theme.spacing.sm}
        style={[
          styles.remove,
          {
            top: theme.spacing.xs,
            right: theme.spacing.xs,
            padding: theme.spacing.xxs,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.overlay,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${COPY.photoRemove}, ${name}`}
        testID={testID ? `${testID}-remove` : undefined}>
        <Icon name="close" size="sm" color="textInverse" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    // Clips the photograph to the tile's corners; without it a square image
    // sits proud of the rounded border on every side.
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
  },
});

export const RequestPhotoTile = memo(RequestPhotoTileComponent);
