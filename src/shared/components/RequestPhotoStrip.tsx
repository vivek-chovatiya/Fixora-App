/**
 * RequestPhotoStrip
 *
 * A request's photographs, shown as photographs (PROJECT_BIBLE.md section 16).
 *
 * They used to be a number. "Photos: 3" tells a customer how many they attached
 * and nothing about *which* three, and on a screen whose point is that what is
 * shown is what was sent, a count is a claim rather than a showing.
 *
 * Four at most, then a count for the rest: the strip is a reminder, not a
 * gallery, and a row that scrolls sideways on a page that scrolls downwards is
 * two gestures fighting over one finger.
 *
 * ⚠️ A photograph that will not load says so in shape. A remote image can fail
 * for reasons that are nobody's fault — it was removed, the network dropped, the
 * link expired — and an empty grey square is indistinguishable from one still
 * arriving. A failed thumbnail becomes an image glyph instead, and the strip's
 * spoken label says how many could not be shown. Viewing only: nothing here
 * retries, removes, replaces or enlarges a photograph.
 *
 * Moved out of the confirmation screen when request details needed the same
 * strip, so that a photograph looks the same before a request is sent and
 * after; then out of the customer feature on 21/10/2026, when the vendor's
 * request details (section 32, "Images") became its second application — the
 * professional sees the customer's photographs as the customer did.
 *
 * ⚠️ The words are the caller's (`copy`), never this file's: each feature's
 * copy is the seam translation plugs into, and the customer's sentences stay
 * where they always were.
 */

import React, { memo, useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';

/** Thumbnail edge, in dp. Big enough to recognise a photograph, not to inspect it. */
const THUMBNAIL_SIZE = 56;

/** How many thumbnails are drawn before the rest become a count. */
const THUMBNAILS_SHOWN = 4;

/** What the strip says, in the caller's words. */
export interface RequestPhotoStripCopy {
  /** The strip's caption, and the start of what it says aloud: "Photos". */
  photosLabel: string;
  /** One photograph, counted in words: "1 photo attached". */
  photoCountOne: string;
  /** Follows the number: "3 photos attached". */
  photoCountMany: string;
  /** Follows a count: "2 photos attached, 1 could not be shown". */
  photoUnavailable: string;
}

export interface RequestPhotoStripProps {
  urls: string[];
  copy: RequestPhotoStripCopy;
  testID?: string;
}

interface PhotoThumbnailProps {
  url: string;
  hasFailed: boolean;
  onFailed: (url: string) => void;
}

function PhotoThumbnail({ url, hasFailed, onFailed }: PhotoThumbnailProps) {
  const theme = useTheme();

  const markFailed = useCallback(() => {
    onFailed(url);
  }, [onFailed, url]);

  if (hasFailed) {
    return (
      <View
        style={[
          styles.thumbnail,
          styles.centred,
          { borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt },
        ]}
        // Counted in the strip's own label; one unnamed node per failure would
        // be a list of blanks between the heading and the count.
        importantForAccessibility="no-hide-descendants"
        testID="request-photo-unavailable">
        <Icon name="image" size="md" color="textTertiary" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      onError={markFailed}
      // Already announced by the group; read individually it would be four
      // unnamed images between the label and the count.
      accessible={false}
      importantForAccessibility="no"
      style={[
        styles.thumbnail,
        { borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt },
      ]}
    />
  );
}

function RequestPhotoStripComponent({ urls, copy, testID }: RequestPhotoStripProps) {
  const theme = useTheme();

  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());

  const markFailed = useCallback((url: string) => {
    setFailed(current => (current.has(url) ? current : new Set(current).add(url)));
  }, []);

  const shown = urls.slice(0, THUMBNAILS_SHOWN);
  const remaining = urls.length - shown.length;
  const failedCount = shown.filter(url => failed.has(url)).length;

  const countLabel =
    urls.length === 1 ? copy.photoCountOne : `${urls.length} ${copy.photoCountMany}`;

  const spokenLabel =
    failedCount > 0
      ? `${copy.photosLabel}: ${countLabel}, ${failedCount} ${copy.photoUnavailable}`
      : `${copy.photosLabel}: ${countLabel}`;

  return (
    <View
      accessible
      accessibilityRole="text"
      // Said in words as well as shown, because a thumbnail communicates
      // nothing to a screen reader and the count is the part that matters.
      accessibilityLabel={spokenLabel}
      style={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.xs }}
      testID={testID}>
      <Text variant="caption" color="textSecondary">
        {copy.photosLabel}
      </Text>

      <View style={[styles.strip, { gap: theme.spacing.sm }]}>
        {shown.map(url => (
          <PhotoThumbnail
            key={url}
            url={url}
            hasFailed={failed.has(url)}
            onFailed={markFailed}
          />
        ))}

        {remaining > 0 ? (
          <View
            style={[
              styles.thumbnail,
              styles.centred,
              { borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt },
            ]}>
            <Text variant="label" color="textSecondary">
              {`+${remaining}`}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    /*
      Wraps rather than clips.

      Five tiles at 56dp with 8dp between them need 312dp, and a card's content
      is 296dp wide on a 360dp screen — seen on device, where the overflow tile
      sat flush against the card's border with its padding eaten. Wrapping costs
      a second row on a narrow screen and nothing on a wide one.
    */
    flexWrap: 'wrap',
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
  },
  centred: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const RequestPhotoStrip = memo(RequestPhotoStripComponent);
