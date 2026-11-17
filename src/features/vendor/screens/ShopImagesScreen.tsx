/**
 * ShopImagesScreen
 *
 * The vendor's shop images (PROJECT_BIBLE.md section 38's "Shop Images" and
 * "Upload Shop Images"; section 57 lists it): every photo, a place to add
 * another while there is room, and Try again or Remove on each. Pushed from
 * Profile's "Manage shop images".
 *
 * ⚠️ Every change is saved as it is made — there is no Save button. A photo
 * uploads as soon as it is picked and is saved as soon as it is uploaded; the
 * tile says which of those it is on, and a failure stays on the tile with its
 * own Try again (`useShopImages`). The counter counts what is on screen, so it
 * always matches the squares the vendor can see.
 *
 * ⚠️ Removing a saved photo asks first (section 46: confirm destructive
 * actions). Confirming closes the dialog at once and the photo says
 * "Removing" — still drawn and counted, with no Remove of its own — until the
 * service answers: gone, or back as it was with a toast saying why. (A dialog
 * held busy instead could sit un-cancellable behind slower work in the line.)
 * A confirmed removal finishes even if the screen is left, so it is no reason
 * to ask on the way out. A photo that was never saved is simply taken off —
 * nothing stored is lost, so there is nothing to confirm.
 *
 * ⚠️ Leaving while a photo is still uploading, waiting to save or failed asks
 * first, through `beforeRemove` (the Back control, Android back and the
 * gesture), because leaving abandons it — the profile form's guard, for the
 * same reason. A save already sent is not a reason to ask: leaving cannot stop
 * it — it finishes either way, and if it fails a toast says so over Profile —
 * and the dialog says exactly that when one is in the air, never that it will
 * be added. A photo whose last save got no answer may be stored already, and
 * the dialog says "may not" for it rather than "will not". If everything that
 * would have been lost is saved or sent while the dialog is open, the screen
 * leaves as it was asked to — there is nothing left to ask about.
 *
 * Placeholders fill the grid while the first read runs; a failed first read
 * shows the failure and its retry where the photos would be, with no pull over
 * it; a failed pull keeps the photos under the request list's notice (3E-3).
 * Reads wait their turn behind any save or removal already in the vendor's
 * line (`useShopImages`), so a pull — or the first read of this screen opened
 * again — keeps its spinner or placeholders until that work has answered:
 * slower by one save, never out of order.
 * No photos yet says so in the counter, with the add tile right below it.
 *
 * ⚠️ Not a FlatList. The grid is bounded by the ceiling (six photos and the add
 * tile), so there is nothing to virtualise, and a list's column count cannot
 * change with the width without remounting it. The squares are sized from the
 * window by the theme's breakpoint columns and spacing — never a fixed width.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AddShopImageTile } from '@/features/vendor/components/AddShopImageTile';
import { ShopImageTile } from '@/features/vendor/components/ShopImageTile';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useShopImages, type ShopImage } from '@/features/vendor/hooks/useShopImages';
import type { VendorStackParamList } from '@/navigation/types';
import {
  BackButton,
  ConfirmDialog,
  ErrorState,
  Screen,
  Skeleton,
  StaleNotice,
  Text,
} from '@/shared/components';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.shopImages;

/** Rows of placeholders while the first read runs; not a promise of how many will come. */
const PLACEHOLDER_ROWS = 2;

type Props = NativeStackScreenProps<VendorStackParamList, 'ShopImages'>;

/** One square of the grid: a photo, or the place to add one. */
type Cell =
  | { kind: 'image'; key: string; image: ShopImage; position: number }
  | { kind: 'add'; key: string };

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}

export function ShopImagesScreen({ navigation }: Props) {
  const theme = useTheme();
  const { width, columns } = useResponsive();
  const {
    images,
    isLoading,
    error,
    retry,
    refresh,
    isRefreshing,
    isStale,
    staleError,
    max,
    remaining,
    notice,
    hasUnsaved,
    isSending,
    mayBeSaved,
    isRemoving,
    add,
    retryImage,
    discardImage,
    removeImage,
  } = useShopImages();

  /*
    The square's edge: the page's width, less its padding and the gaps, shared
    by the columns the theme gives this width. Rounded down so a row never runs
    a fraction past the edge.
  */
  const gap = theme.spacing.md;
  const size = Math.floor((width - 2 * theme.screenPadding - gap * (columns - 1)) / columns);

  /* Removing ------------------------------------------------------------- */

  /** The saved photo whose removal is being confirmed. */
  const [confirming, setConfirming] = useState<string | null>(null);

  const askRemove = useCallback(
    (image: ShopImage) => {
      if (image.state === 'saved') {
        setConfirming(image.key);
        return;
      }
      discardImage(image.key);
    },
    [discardImage],
  );
  const cancelRemove = useCallback(() => setConfirming(null), []);
  /*
    Closes at once. The removal may wait behind slower work in the vendor's
    line, and a dialog held open and un-cancellable for that long says
    nothing useful; the photo itself says "Removing" until it is gone, or is
    back as it was with a toast if the removal fails.
  */
  const confirmRemove = useCallback(() => {
    if (confirming === null) {
      return;
    }
    removeImage(confirming);
    setConfirming(null);
  }, [confirming, removeImage]);

  /* Leaving -------------------------------------------------------------- */

  const allowLeave = useRef(false);
  const interrupted = useRef<NavigationAction | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (allowLeave.current || !hasUnsaved) {
          return;
        }
        event.preventDefault();
        interrupted.current = event.data.action;
        setIsLeaving(true);
      }),
    [hasUnsaved, navigation],
  );

  const confirmLeave = useCallback(() => {
    setIsLeaving(false);
    allowLeave.current = true;

    const action = interrupted.current;
    interrupted.current = null;
    if (action) {
      navigation.dispatch(action);
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const stay = useCallback(() => {
    interrupted.current = null;
    setIsLeaving(false);
  }, []);

  // Asked because something would be lost; once nothing would, the answer is the one already given.
  useEffect(() => {
    if (isLeaving && !hasUnsaved) {
      confirmLeave();
    }
  }, [confirmLeave, hasUnsaved, isLeaving]);

  /* The grid ------------------------------------------------------------- */

  const takePhoto = useCallback(() => add('camera'), [add]);
  const choosePhoto = useCallback(() => add('gallery'), [add]);

  const rows = useMemo<Cell[][]>(() => {
    if (!images) {
      return [];
    }
    const cells: Cell[] = images.map((image, index) => ({
      kind: 'image' as const,
      key: image.key,
      image,
      position: index + 1,
    }));
    if (remaining > 0) {
      cells.push({ kind: 'add', key: 'add' });
    }
    return chunk(cells, columns);
  }, [columns, images, remaining]);

  const total = images?.length ?? 0;

  const bar = (
    <View
      style={[styles.bar, { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget }]}>
      <BackButton
        onPress={navigation.goBack}
        accessibilityLabel={COPY.back}
        testID="shop-images-back"
      />
    </View>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <View style={{ gap: theme.spacing.lg }}>
        <Skeleton height={theme.spacing.lg} width="40%" radiusToken="sm" />
        <View style={{ gap }}>
          {Array.from({ length: PLACEHOLDER_ROWS }, (_, row) => (
            <View key={row} style={[styles.row, { gap }]}>
              {Array.from({ length: columns }, (__, column) => (
                <Skeleton key={column} width={size} height={size} radiusToken="lg" />
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  } else if (error) {
    body = (
      <ErrorState
        error={error}
        title={COPY.failedTitle}
        onRetry={retry}
        fullScreen={false}
        testID="shop-images-error"
      />
    );
  } else if (images) {
    body = (
      <View style={{ gap: theme.spacing.lg }}>
        <Text
          variant="bodyStrong"
          color={total === 0 ? 'textSecondary' : 'textPrimary'}
          testID="shop-images-count">
          {total === 0 ? COPY.emptyCount(max) : COPY.count(total, max)}
        </Text>

        <View style={{ gap }}>
          {rows.map(row => (
            <View key={row[0].key} style={[styles.row, { gap }]}>
              {row.map(cell =>
                cell.kind === 'image' ? (
                  <ShopImageTile
                    key={cell.key}
                    image={cell.image}
                    position={cell.position}
                    total={total}
                    size={size}
                    onRetry={retryImage}
                    onRemove={askRemove}
                    testID={`shop-image-${cell.position}`}
                  />
                ) : (
                  <AddShopImageTile
                    key={cell.key}
                    size={size}
                    remaining={remaining}
                    onTakePhoto={takePhoto}
                    onChoosePhoto={choosePhoto}
                    testID="shop-images-add"
                  />
                ),
              )}
            </View>
          ))}
        </View>

        {/*
          Announced when it appears: a refused camera or file is the app's
          answer to something the vendor just did, and without a live region it
          is silent text under the button they pressed.
        */}
        {notice ? (
          <Text
            variant="caption"
            color="danger"
            accessibilityLiveRegion="polite"
            testID="shop-images-notice">
            {notice}
          </Text>
        ) : null}
      </View>
    );
  } else {
    body = null;
  }

  // Not offered over a failure with nothing behind it: the retry is right there.
  const canRefresh = !isLoading && !error;

  return (
    <Screen
      scrollable
      header={bar}
      onRefresh={canRefresh ? refresh : undefined}
      isRefreshing={canRefresh ? isRefreshing : false}
      contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
      testID="shop-images">
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="shop-images-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {isStale ? (
        <StaleNotice
          title={COPY.staleTitle}
          message={COPY.staleMessage}
          error={staleError}
          retryLabel={COPY.staleRetry}
          retryHint={COPY.staleRetryHint}
          // A refresh, not a retry: the photos stay where they are while it reloads.
          onRetry={refresh}
          isRetrying={isRefreshing}
          testID="shop-images-stale"
        />
      ) : null}

      {/*
        ⚠️ Two regions, never one updated into the other. While loading, a
        region named for the wait and marked busy, so a screen reader hears one
        "Loading your shop images, busy" rather than a word per placeholder.
        Loaded, failed or empty, a plain container with no name, role or state:
        the heading above already names it, and a labelled view that cannot be
        pressed is a TalkBack stop of its own that says it again.

        They carry different `key`s, and that is the fix, not a detail. One
        view updated from the one state into the other keeps `busy` on the
        native side — a prop that becomes undefined is not an instruction to
        unset (Home and Sub Categories, found on device). This region used to
        state its label and its busy state on every render instead, which
        cleared `busy` but left the extra stop ("Your shop images"). A
        different key makes React replace the native view, so the settled one
        starts with nothing to forget.
      */}
      {isLoading ? (
        <View
          key="loading"
          accessibilityLabel={COPY.loading}
          accessibilityState={{ busy: true }}
          testID="shop-images-grid">
          {body}
        </View>
      ) : (
        <View key="settled" testID="shop-images-grid">
          {body}
        </View>
      )}

      <ConfirmDialog
        visible={confirming !== null}
        title={COPY.removeTitle}
        message={COPY.removeMessage}
        cancelLabel={COPY.removeCancel}
        cancelHint={COPY.removeCancelHint}
        confirmLabel={COPY.removeConfirm}
        confirmHint={COPY.removeConfirmHint}
        onCancel={cancelRemove}
        onConfirm={confirmRemove}
        testID="shop-images-remove-dialog"
      />

      <ConfirmDialog
        visible={isLeaving}
        title={COPY.leaveTitle}
        message={COPY.leaveMessage({
          alsoSending: isSending,
          mayBeSaved,
          alsoRemoving: isRemoving,
        })}
        cancelLabel={COPY.leaveStay}
        cancelHint={COPY.leaveStayHint}
        confirmLabel={COPY.leaveConfirm}
        confirmHint={COPY.leaveConfirmHint}
        onCancel={stay}
        onConfirm={confirmLeave}
        testID="shop-images-leave-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
  },
});
