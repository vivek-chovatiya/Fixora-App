/**
 * PhotoField
 *
 * One picture on a vendor form, chosen and uploaded there and saved with the
 * form: the business picture on `VendorProfileFormScreen` (PROJECT_BIBLE.md
 * section 38, Phase 3E-1) and a team member's photo on `TeamMemberFormScreen`
 * (section 39, Phase 3E-13). An avatar, a heading and a line under it, Take a
 * photo / Choose a photo side by side where they fit, Remove photo when there
 * is one, the upload's progress, and a failure with Try again and Discard.
 *
 * ⚠️ One card, merged from two (Phase 3G-4, 21/10/2026). The team form's had
 * been written as a copy of the business picture's, because that screen was
 * locked when the team photo arrived; two copies of one card are two answers
 * to the next change. The words are the caller's (`copy`, each form's own
 * frozen copy), and so are the four actions — the team form refuses a photo
 * action while its save or status change runs, which only the form can know.
 *
 * ⚠️ The customer's picture on the Profile tab is not this card and is not
 * merged into it: it is the identity card itself — the name as its heading,
 * no "Photo" heading or line, the stored picture saved the moment it uploads
 * rather than with a form, its own row sizing — so sharing this would mean a
 * switch for every one of those differences.
 *
 * ⚠️ The progress is said once, and then left to be looked at. While the
 * upload has not reported how far it has got, the line is "Uploading the
 * photo…" in a polite live region, as it always was, and its words do not
 * change while it stands, so it is announced once. From the first report the
 * line is replaced by a bar and "Uploading… 42%", one `progressbar` stop
 * whose value is the figure — and which is **not** a live region, so the
 * figure changing never speaks. A live region round the figure would read out
 * every step of every upload. Drawn by the shared `PhotoUploadProgress` since
 * 3D-12, when the customer's picture on Profile was given the same progress:
 * the cards stay apart (above), this one part of them is the same.
 *
 * The picture is decorative unless the caller names it (`pictureSpoken`): on
 * the team form the actions already say whether there is a photo ("Add their
 * photo…" or "Replace their photo…"), so a stop saying only "photo" adds
 * nothing; the business picture names itself, as it always has.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  ErrorState,
  PhotoUploadProgress,
  SecondaryButton,
  Text,
} from '@/shared/components';
import type { ImageUpload } from '@/shared/hooks/useImageUpload';
import { useTheme, type IconName } from '@/shared/theme';

/** The words a photo field needs; each form passes its own frozen copy. */
export interface PhotoFieldCopy {
  photoSection: string;
  photoSupport: string;
  photoCamera: string;
  photoGallery: string;
  photoAddCameraSpoken: string;
  photoAddGallerySpoken: string;
  photoReplaceCameraSpoken: string;
  photoReplaceGallerySpoken: string;
  photoRemove: string;
  photoRemoveSpoken: string;
  /** Before the upload has reported a figure; spoken once. */
  photoUploading: string;
  /** Beside the bar, once it has. */
  photoProgress: (percent: number) => string;
  photoFailedTitle: string;
  photoRetry: string;
  photoDiscard: string;
  photoDiscardHint: string;
}

export interface PhotoFieldProps {
  photo: ImageUpload;
  /** The uploaded picture the form holds; undefined for none. */
  photoUrl: string | undefined;
  /** What is typed as the name, for the initials drawn when there is no picture. */
  name: string;
  /** The glyph drawn when there is neither a picture nor a name. */
  fallbackIcon?: IconName;
  /** The picture's spoken name; absent, the picture is hidden from a screen reader. */
  pictureSpoken?: string;
  copy: PhotoFieldCopy;
  /** The form is saving (or doing something else of its own): nothing here can be pressed. */
  locked: boolean;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onRemovePhoto: () => void;
  /** Uploads the picture that failed again, without opening the picker. */
  onRetryPhoto: () => void;
  /** The card's; its parts are `-avatar`, `-busy`, `-progress` and `-error` after it. */
  testID: string;
}

/** Not memoised: `photo` is a new object on every render of its form. */
export function PhotoField({
  photo,
  photoUrl,
  name,
  fallbackIcon,
  pictureSpoken,
  copy,
  locked,
  onTakePhoto,
  onChoosePhoto,
  onRemovePhoto,
  onRetryPhoto,
  testID,
}: PhotoFieldProps) {
  const theme = useTheme();
  const hasPhoto = photoUrl !== undefined;
  // One thing at a time: never while the form saves, never during another picture action.
  const busy = locked || photo.isBusy;

  const avatar = (
    <Avatar
      uri={photoUrl}
      name={name}
      size="xl"
      fallbackIcon={fallbackIcon}
      testID={`${testID}-avatar`}
    />
  );

  return (
    <Card
      bordered
      shadow="sm"
      style={[styles.card, { padding: theme.spacing.xl, gap: theme.spacing.md }]}
      testID={testID}>
      {pictureSpoken ? (
        <View accessible accessibilityRole="image" accessibilityLabel={pictureSpoken}>
          {avatar}
        </View>
      ) : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {avatar}
        </View>
      )}

      <View style={[styles.center, styles.stretch, { gap: theme.spacing.xxs }]}>
        <Text variant="h3" accessibilityRole="header">
          {copy.photoSection}
        </Text>
        {/*
          The card's full width, centred inside it — not a centred box sized by
          its own words, which at 360dp can break a line a fraction narrower
          than it was measured and cut the second one (3E-3, 3E-10).
        */}
        <Text variant="caption" color="textSecondary" align="center" style={styles.stretch}>
          {copy.photoSupport}
        </Text>
      </View>

      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <SecondaryButton
          label={copy.photoCamera}
          icon="camera"
          onPress={onTakePhoto}
          disabled={busy}
          accessibilityLabel={hasPhoto ? copy.photoReplaceCameraSpoken : copy.photoAddCameraSpoken}
          style={styles.rowItem}
        />
        <SecondaryButton
          label={copy.photoGallery}
          icon="gallery"
          onPress={onChoosePhoto}
          disabled={busy}
          accessibilityLabel={hasPhoto ? copy.photoReplaceGallerySpoken : copy.photoAddGallerySpoken}
          style={styles.rowItem}
        />
      </View>

      {hasPhoto && !photo.pending ? (
        <SecondaryButton
          label={copy.photoRemove}
          icon="remove"
          onPress={onRemovePhoto}
          disabled={busy}
          accessibilityLabel={copy.photoRemoveSpoken}
        />
      ) : null}

      {/* Shared with the customer's picture on Profile (3D-12); see its docblock. */}
      <PhotoUploadProgress
        isBusy={photo.isBusy}
        progress={photo.progress}
        waitingLabel={copy.photoUploading}
        progressLabel={copy.photoProgress}
        testID={testID}
      />

      {photo.error ? (
        <View style={[styles.stretch, { gap: theme.spacing.sm }]}>
          <ErrorState
            error={photo.error}
            title={copy.photoFailedTitle}
            fullScreen={false}
            testID={`${testID}-error`}
          />
          {photo.pending ? (
            <View style={[styles.row, { gap: theme.spacing.sm }]}>
              <Button
                label={copy.photoRetry}
                onPress={onRetryPhoto}
                disabled={busy}
                style={styles.rowItem}
              />
              <SecondaryButton
                label={copy.photoDiscard}
                onPress={photo.discard}
                disabled={busy}
                accessibilityHint={copy.photoDiscardHint}
                style={styles.rowItem}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
  },
  stretch: {
    alignSelf: 'stretch',
  },
  /* Side by side where they fit, stacked where they do not. */
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },
  /*
    Sized by its label, then grown to fill. An equal-share basis squeezed
    "Choose a photo" to the edge of its pill at 360dp instead of wrapping;
    an `auto` basis wraps it onto its own row the moment the labels do not fit.
  */
  rowItem: {
    flexGrow: 1,
    flexBasis: 'auto',
  },
});

