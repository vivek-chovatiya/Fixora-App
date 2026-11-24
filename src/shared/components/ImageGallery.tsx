/**
 * ImageGallery — thumbnails with a full-screen preview.
 */

import React, { memo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { useTheme } from '@/shared/theme';
import { resolveFileUrl } from '@/shared/utils/format';

function ImageGalleryComponent({ images, size = 84 }: { images: string[]; size?: number }) {
  const theme = useTheme();
  const [preview, setPreview] = useState<string | null>(null);

  if (!images.length) {
    return null;
  }

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
        {images.map(path => {
          const uri = resolveFileUrl(path);
          return (
            <Pressable key={path} accessibilityRole="imagebutton" accessibilityLabel="Open image" onPress={() => setPreview(uri)}>
              <Image source={{ uri: uri ?? undefined }} style={{ width: size, height: size, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt }} />
            </Pressable>
          );
        })}
      </ScrollView>
      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', padding: theme.spacing.lg }} onPress={() => setPreview(null)}>
          <Image source={{ uri: preview ?? undefined }} style={{ width: '100%', height: '70%', borderRadius: theme.radius.lg }} resizeMode="contain" />
          <View style={{ position: 'absolute', top: theme.spacing.huge, right: theme.spacing.xl }}>
            <Icon name="close" size="xl" color="textInverse" />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export const ImageGallery = memo(ImageGalleryComponent);
