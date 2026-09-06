/**
 * PhotoAttachments
 *
 * Adding photographs to a request (PROJECT_BIBLE.md section 16).
 *
 * ⚠️ Two ways in, both named. Camera and gallery are different intentions, not
 * one "add" that then asks which — and the choice is made before any permission
 * dialog appears, so nobody is prompted for the camera on their way to their
 * photo library.
 *
 * The row scrolls and the actions do not. Actions that slide away as the
 * thumbnails fill up would put "add another" out of reach exactly when someone
 * is adding several.
 */

import React, { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { RequestPhotoTile } from '@/features/customer/components/RequestPhotoTile';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import type { RequestPhotos } from '@/features/customer/hooks/useRequestPhotos';
import { SecondaryButton, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.createRequest;

export interface PhotoAttachmentsProps {
  photos: RequestPhotos;
  testID?: string;
}

function PhotoAttachmentsComponent({ photos, testID }: PhotoAttachmentsProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }} testID={testID}>
      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        <SecondaryButton
          label={COPY.photosCamera}
          icon="camera"
          onPress={() => photos.add('camera')}
          disabled={!photos.canAddMore}
          accessibilityHint={COPY.photosCameraHint}
          style={styles.action}
        />
        <SecondaryButton
          label={COPY.photosGallery}
          icon="gallery"
          onPress={() => photos.add('gallery')}
          disabled={!photos.canAddMore}
          accessibilityHint={COPY.photosGalleryHint}
          style={styles.action}
        />
      </View>

      {photos.photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.row, { marginHorizontal: -theme.screenPadding }]}
          contentContainerStyle={{
            paddingHorizontal: theme.screenPadding,
            gap: theme.spacing.sm,
          }}
          testID={testID ? `${testID}-row` : undefined}>
          {photos.photos.map((photo, index) => (
            <RequestPhotoTile
              key={photo.asset.id}
              photo={photo}
              index={index}
              onRemove={photos.remove}
              onRetry={photos.retry}
              testID={`request-photo-${photo.asset.id}`}
            />
          ))}
        </ScrollView>
      ) : null}

      {/*
        Announced when it appears, not merely drawn.

        A refused camera or a rejected file is the app's answer to something the
        customer just did; without a live region it is silent text somewhere
        below the button they pressed.
      */}
      {photos.notice ? (
        <Text
          variant="caption"
          color="danger"
          accessibilityLiveRegion="polite"
          testID={testID ? `${testID}-notice` : undefined}>
          {photos.notice}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
  },
  action: {
    // Two equal halves. Left to their intrinsic widths, "Camera" and "Gallery"
    // are different sizes and the pair reads as one button and a spare.
    flex: 1,
  },
  row: {
    flexGrow: 0,
  },
});

export const PhotoAttachments = memo(PhotoAttachmentsComponent);
