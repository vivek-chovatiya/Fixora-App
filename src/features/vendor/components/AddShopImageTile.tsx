/**
 * AddShopImageTile
 *
 * The last square of the shop-images grid while there is room for another
 * photo (PROJECT_BIBLE.md section 38, "Upload Shop Images").
 *
 * ⚠️ Two ways in, both named — "Take a photo" and "Choose a photo" — rather
 * than one "add" that then asks which. It is the request photos' rule (section
 * 16, `PhotoAttachments`): camera and library are different intentions, and
 * the choice is made before any permission dialog, so nobody is asked for the
 * camera on their way to their library. Each half is a full-width target well
 * over the accessibility floor at the smallest grid.
 *
 * Spoken with how many more photos fit. Not drawn at all once none do — the
 * screen leaves it out — so it never offers what the service would refuse.
 *
 * Sized by the grid it sits in (`size`), like the photos beside it.
 */

import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { Icon, Text } from '@/shared/components';
import { useTheme, type AppTheme, type IconName } from '@/shared/theme';

const COPY = VENDOR_COPY.shopImages;

export interface AddShopImageTileProps {
  /** Edge length, worked out by the grid. */
  size: number;
  /** How many more photos fit, for what is spoken. */
  remaining: number;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  testID?: string;
}

interface HalfProps {
  label: string;
  spoken: string;
  icon: IconName;
  onPress: () => void;
  theme: AppTheme;
  testID?: string;
}

function Half({ label, spoken, icon, onPress, theme, testID }: HalfProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.half,
        {
          gap: theme.spacing.xs,
          padding: theme.spacing.xs,
          backgroundColor: pressed ? theme.colors.primarySubtle : theme.colors.surface,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      testID={testID}>
      {/*
        Under a finger the half is tinted, and what is on the tint takes the
        tint's own ink (3G-4): `primary` is 4.2:1 / 4.0:1 on `primarySubtle`.
      */}
      {({ pressed }) => (
        <>
          <Icon name={icon} size="lg" color={pressed ? 'onPrimarySubtle' : 'primary'} />
          {/*
            A definite width (`alignSelf: 'stretch'`), centred inside it — not a
            width measured by the words. Centred in the half and sized by its own
            content, "Take a photo" lost its last word at 360dp on the emulator
            (box 69dp wide, one line: "Take a"): the 3E-3 defect again.
          */}
          <Text
            variant="label"
            color={pressed ? 'onPrimarySubtle' : 'primary'}
            align="center"
            numberOfLines={2}
            style={styles.label}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function AddShopImageTileComponent({
  size,
  remaining,
  onTakePhoto,
  onChoosePhoto,
  testID,
}: AddShopImageTileProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: theme.radius.lg,
          borderWidth: theme.borderWidth.thick,
          borderColor: theme.colors.borderStrong,
          backgroundColor: theme.colors.surface,
        },
      ]}
      testID={testID}>
      <Half
        label={COPY.takePhoto}
        spoken={COPY.takePhotoSpoken(remaining)}
        icon="camera"
        onPress={onTakePhoto}
        theme={theme}
        testID={testID ? `${testID}-camera` : undefined}
      />
      <View
        style={{ height: theme.borderWidth.thin, backgroundColor: theme.colors.border }}
      />
      <Half
        label={COPY.choosePhoto}
        spoken={COPY.choosePhotoSpoken(remaining)}
        icon="gallery"
        onPress={onChoosePhoto}
        theme={theme}
        testID={testID ? `${testID}-gallery` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    // A dashed edge says "a place for a photo", not a photo; clipped so a
    // pressed half keeps the rounded corners.
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  half: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    alignSelf: 'stretch',
  },
});

export const AddShopImageTile = memo(AddShopImageTileComponent);
