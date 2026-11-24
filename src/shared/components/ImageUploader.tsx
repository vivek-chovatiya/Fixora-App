/**
 * ImageUploader — renders a useImageUploads controller.
 */

import React, { memo } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { useDialog, useToast } from '@/shared/components/Feedback';
import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import type { ImageUploadsController, UploadItem } from '@/shared/hooks/useImageUploads';
import { useTheme } from '@/shared/theme';
import { resolveFileUrl } from '@/shared/utils/format';

export type { UploadItem };

function ImageUploaderComponent({ controller, testID = 'image-uploader' }: { controller: ImageUploadsController; testID?: string }) {
  const theme = useTheme();
  const { choose } = useDialog();
  const toast = useToast();
  const size = 88;

  const onAdd = async () => {
    const source = await choose<'camera' | 'gallery'>('Add photo', [
      { value: 'camera', label: 'Take photo', icon: 'camera' },
      { value: 'gallery', label: 'Choose from gallery', icon: 'gallery' },
    ]);
    if (!source) {
      return;
    }
    const problems = await controller.pick(source);
    if (problems.length) {
      toast.show(problems[0], 'warning');
    }
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {controller.items.map(item => (
          <View key={item.key} testID={`${testID}-item-${item.status}`} style={{ width: size, height: size }}>
            <Image
              source={{ uri: resolveFileUrl(item.url ?? item.localUri) ?? undefined }}
              style={{ width: size, height: size, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt, opacity: item.status === 'uploaded' ? 1 : 0.5 }}
            />
            {item.status === 'uploading' ? (
              <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : null}
            {item.status === 'failed' ? (
              <Pressable
                testID={`${testID}-retry`}
                accessibilityRole="button"
                accessibilityLabel="Retry upload"
                onPress={() => controller.retry(item.key)}
                style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.colors.danger } as object}>
                <Icon name="retry" size="lg" color="danger" />
                <Text variant="caption" color="danger">
                  Retry
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove image"
              onPress={() => controller.remove(item.key)}
              hitSlop={8}
              style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.textPrimary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size="xs" color="background" />
            </Pressable>
          </View>
        ))}
        {controller.canAddMore ? (
          <Pressable
            testID={`${testID}-add`}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            onPress={onAdd}
            style={({ pressed }) => ({
              width: size,
              height: size,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.colors.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xs,
              opacity: pressed ? theme.opacity.pressed : 1,
            })}>
            <Icon name="camera" size="lg" color="primary" />
            <Text variant="caption" color="primary">
              Add photo
            </Text>
          </Pressable>
        ) : null}
      </View>
      {controller.hasFailures ? (
        <Text variant="caption" color="danger">
          Some photos failed to upload. Retry or remove them before continuing.
        </Text>
      ) : controller.isBusy ? (
        <Text variant="caption" color="textSecondary">
          Uploading photos…
        </Text>
      ) : null}
    </View>
  );
}

export const ImageUploader = memo(ImageUploaderComponent);
