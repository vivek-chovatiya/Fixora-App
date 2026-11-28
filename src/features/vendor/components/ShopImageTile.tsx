/**
 * ShopImageTile
 *
 * One of the vendor's shop images, and how its upload and save are going
 * (PROJECT_BIBLE.md section 38, with section 16's upload rules).
 *
 * ⚠️ A sibling of the customer's `RequestPhotoTile`, deliberately not merged
 * with it. That tile belongs to the request form and is locked to it: its copy
 * is the request's, it is a fixed 96dp, and it knows two states because a
 * request's photos are saved with the request at Submit. A shop image is saved
 * on its own the moment it is uploaded, so it has a state the request never
 * has — uploaded but not saved — and a saved one is removed only after asking.
 * Bending the request tile to cover both would change a screen this work does
 * not own; the shared parts (`ImageService`, `Icon`, the theme) are what is
 * shared.
 *
 * ⚠️ The state is on the photograph it belongs to, as a glyph and a word, never
 * a tint alone (section 46): "Uploading", "Waiting to save", "Saving", "Upload
 * failed", "Not saved" or "Removing", and a failed tile is itself the Try
 * again — the largest target, and where someone looking at the failure is
 * already pointing. The words sit on a `surface` label above the dimmed photo,
 * so they read in both themes whatever the photograph behind them.
 *
 * ⚠️ Sized by the grid it sits in (`size`), never a fixed width, and the photo
 * is cover-cropped to the square.
 *
 * Spoken as "Shop photo 2 of 4", with its state when it has one; Remove and Try
 * again name the photo they act on and start with their own word, so voice
 * control finds them.
 */

import React, { memo, useCallback } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { ShopImage, ShopImageState } from '@/features/vendor/hooks/useShopImages';
import { Icon, ProgressBar, Text } from '@/shared/components';
import { useTheme, type IconName } from '@/shared/theme';

const COPY = VENDOR_COPY.shopImages;

export interface ShopImageTileProps {
  image: ShopImage;
  /** Where it is among every photo on screen, from 1, for what is spoken. */
  position: number;
  total: number;
  /** Edge length, worked out by the grid. */
  size: number;
  onRetry: (key: string) => void;
  /** A saved photo asks first; one never saved is simply taken off. The screen decides. */
  onRemove: (image: ShopImage) => void;
  testID?: string;
}

interface StatePresentation {
  /**
   * The copy key of the state's word, read when the tile is drawn. It was the
   * word itself, read when this module loaded — so a photo's "Uploading…"
   * stayed in that moment's language after the app switched (Phase 5,
   * 28/11/2026).
   */
  word: 'uploading' | 'waiting' | 'saving' | 'removing' | 'uploadFailed' | 'notSaved';
  icon: IconName;
  isFailure: boolean;
}

/** The word and glyph for every state but `saved`, which needs neither. */
const PRESENTATION: Readonly<Record<Exclude<ShopImageState, 'saved'>, StatePresentation>> = {
  uploading: { word: 'uploading', icon: 'upload', isFailure: false },
  // In line behind another save, and not sent: a different fact from "Saving", said differently.
  waiting: { word: 'waiting', icon: 'pending', isFailure: false },
  saving: { word: 'saving', icon: 'upload', isFailure: false },
  // Confirmed and on its way off: still stored, so still drawn, until the service answers.
  removing: { word: 'removing', icon: 'remove', isFailure: false },
  uploadFailed: { word: 'uploadFailed', icon: 'warning', isFailure: true },
  saveFailed: { word: 'notSaved', icon: 'warning', isFailure: true },
};

function ShopImageTileComponent({
  image,
  position,
  total,
  size,
  onRetry,
  onRemove,
  testID,
}: ShopImageTileProps) {
  const theme = useTheme();

  const retry = useCallback(() => onRetry(image.key), [image.key, onRetry]);
  const remove = useCallback(() => onRemove(image), [image, onRemove]);

  const name = COPY.photoSpoken(position, total);
  const status = image.state === 'saved' ? null : PRESENTATION[image.state];
  const isFailure = status?.isFailure ?? false;
  const statusWord = status ? COPY[status.word] : '';
  // Its save is already in line or sent, or its removal is: a second would undo or repeat it.
  const canRemove =
    image.state !== 'waiting' && image.state !== 'saving' && image.state !== 'removing';

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceAlt,
          borderWidth: isFailure ? theme.borderWidth.thick : theme.borderWidth.thin,
          borderColor: isFailure ? theme.colors.danger : theme.colors.border,
        },
      ]}
      testID={testID}>
      <Image
        source={{ uri: image.previewUri }}
        style={styles.fill}
        resizeMode="cover"
        // The tile says what this is; the image itself would be a second, nameless node.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      {status ? (
        <View
          style={[
            styles.overlay,
            { backgroundColor: theme.colors.overlay, padding: theme.spacing.sm },
          ]}>
          <View
            // A failed tile is spoken by its Try again, which covers it; this would say it twice.
            accessible={!isFailure}
            accessibilityRole="text"
            accessibilityLabel={`${name}, ${statusWord}`}
            accessibilityElementsHidden={isFailure}
            importantForAccessibility={isFailure ? 'no-hide-descendants' : 'yes'}
            style={[
              styles.status,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xs,
                gap: theme.spacing.xxs,
              },
            ]}
            testID={testID ? `${testID}-status` : undefined}>
            <Icon name={status.icon} size="md" color={isFailure ? 'danger' : 'primary'} />
            <Text variant="caption" align="center">
              {statusWord}
            </Text>
            {isFailure ? (
              <View style={[styles.row, { gap: theme.spacing.xxs }]}>
                <Icon name="retry" size="sm" color="primary" />
                <Text variant="caption" color="primary">
                  {COPY.tryAgain}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={name}
          style={StyleSheet.absoluteFill}
        />
      )}

      {image.state === 'uploading' ? (
        // Along the bottom edge, square-ended; silent, as the tile says "Uploading".
        <ProgressBar
          value={image.progress}
          trackColor="border"
          rounded={false}
          style={styles.track}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          fillTestID={testID ? `${testID}-progress` : undefined}
        />
      ) : null}

      {isFailure && status ? (
        <Pressable
          onPress={retry}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={COPY.tryAgainSpoken(position, total, statusWord)}
          accessibilityHint={COPY.tryAgainHint}
          testID={testID ? `${testID}-retry` : undefined}
        />
      ) : null}

      {canRemove ? (
        <Pressable
          onPress={remove}
          // Padding and slop rather than a larger circle: the mark stays small on
          // the photo while the target reaches the accessibility floor.
          hitSlop={theme.spacing.sm}
          style={({ pressed }) => [
            styles.remove,
            {
              top: theme.spacing.xs,
              right: theme.spacing.xs,
              padding: theme.spacing.xs,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.surface,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border,
              opacity: pressed ? theme.opacity.pressed : theme.opacity.opaque,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={COPY.removeSpoken(position, total)}
          accessibilityHint={image.state === 'saved' ? COPY.removeHint : COPY.discardHint}
          testID={testID ? `${testID}-remove` : undefined}>
          <Icon name="close" size="md" color="textPrimary" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    // Clips the photograph to the rounded corners.
    overflow: 'hidden',
  },
  fill: {
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
  status: {
    alignItems: 'center',
    // Never wider than the tile, however long the words become.
    maxWidth: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  remove: {
    position: 'absolute',
  },
});

export const ShopImageTile = memo(ShopImageTileComponent);
