/**
 * ConfirmDialog
 *
 * Asks once before something that cannot be taken back (PROJECT_BIBLE.md
 * section 44 lists a confirmation dialog among the shared frontend features).
 *
 * ⚠️ Two answers, and they never look alike. Cancel is the secondary button and
 * the confirming action carries the tone of what it does — `danger` for
 * something destructive — so the difference is in the words and the weight, not
 * in colour alone (section 46). Cancel is where a hurried thumb lands — first in
 * a row, last in a stack, the one nearest the thumb — and every way out that is
 * not the confirm button — Cancel, the Android back button, a tap on the dimmed
 * backdrop — is Cancel.
 *
 * ⚠️ While the confirmed action runs, the dialog stays and says so. The confirm
 * button shows its busy state and nothing can be pressed twice; dismissing is
 * refused too, because a dialog that closes half-way through an action leaves
 * the customer not knowing whether it happened.
 *
 * Built on the platform `Modal`, so a screen reader is confined to it while it
 * is open. The title is announced as a heading and the dialog as a whole takes
 * the title as its name.
 *
 * It asks; it does not act. The caller decides what confirming does and when
 * the dialog closes.
 *
 * ⚠️ Side by side when both labels fit, one above the other when either might
 * not — decided here, from the window's width and the labels' lengths, so no
 * caller has to know how wide its words are (`answersFitSideBySide`). A button's
 * label is a single line: in a half that is too narrow it is cut off, never
 * wrapped.
 *
 * ⚠️ Stacked, the order turns over: the confirming action on top, Cancel at the
 * bottom (the owner's decision, 21/10/2026). A stack runs down towards the
 * thumb, so the answer at its foot is the one a hurried tap finds — and that
 * must be the way out. The answers are rendered in that order, not flipped by
 * the layout, so a screen reader meets them in the order they are seen.
 *
 * ⚠️ Never under the status bar or the gesture bar: the backdrop's padding adds
 * the system bars' insets (`useDialogBackdropPadding`). This dialog is rarely
 * tall enough to reach them, but it shares the shell with one that is.
 */

import React, { memo } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { BUTTON_LABEL_INSET, Button, type ButtonVariant } from '@/shared/components/Button';
import { useDialogBackdropPadding } from '@/shared/components/dialogBackdrop';
import { Text } from '@/shared/components/Text';
import { breakpoints, useTheme, type AppTheme, type SpacingToken } from '@/shared/theme';

/*
  The dialog's own spacing, named once, because the layout below and the fit
  calculation must agree to the dp: a calculation that thought the dialog had
  more room than it draws would leave a label cut off.
*/
/**
 * Between the window's edge and the dialog — at the top and bottom, on top of
 * the system bars' insets. The sides take this alone, which is all the fit
 * calculation needs.
 */
const BACKDROP_PADDING: SpacingToken = 'xl';
/** Between the dialog's edge and its contents. */
const DIALOG_PADDING: SpacingToken = 'xl';
/** Between the two answers, side by side or stacked. */
const ANSWER_GAP: SpacingToken = 'md';

/**
 * How wide a label's characters are taken to be, on average, as a share of the
 * font size — deliberately more than they are.
 *
 * The button's words are 16sp semibold. The widths worked out for labels at
 * that size while building the dialogs that use them — "Keep editing" about
 * 88dp, "Keep request" 96, "Cancel request" 108, "Keep accepting" 116, "Stop
 * new requests" 133 — come to 0.46–0.52 of the font size per character. 0.6
 * is the margin over all of them: about 15% over the widest, 30% over the
 * narrowest. A short word can be as wide per character as this ("Remove": a
 * capital, an "m", no narrow letters), but a short word is far inside the room
 * it has; a label long enough to come near the limit has spaces and narrow
 * letters that pull its average down, so the margin is largest exactly where
 * it matters.
 *
 * ⚠️ Errs one way on purpose. Taking a label as wider than it is costs a stacked
 * dialog that would have fitted in a row; taking it as narrower costs a cut-off
 * word. Written for the Latin script the app ships in — a translation into a
 * script with wider glyphs needs its own figure.
 */
const LABEL_EM_PER_CHARACTER = 0.6;

/**
 * Whether both labels fit side by side at this window, each on one line.
 *
 * Computed, not measured: the dialog's width is the window's less the
 * backdrop's padding, capped at `breakpoints.sm`; inside its padding, the two
 * answers share what is left less the gap between them; and each label has its
 * button's width less the capsule's padding on both sides. A label's width is
 * its characters × the font size × the system font scale (Android's font size
 * setting enlarges the words, not the dialog) × `LABEL_EM_PER_CHARACTER`. At
 * 360dp that leaves each label 86dp; from 400dp up, where the dialog reaches
 * its cap, 106dp.
 */
export function answersFitSideBySide(
  labels: readonly string[],
  windowSize: { width: number; fontScale: number },
  theme: AppTheme,
): boolean {
  const dialogWidth = Math.min(
    breakpoints.sm,
    windowSize.width - 2 * theme.spacing[BACKDROP_PADDING],
  );
  const answerWidth =
    (dialogWidth - 2 * theme.spacing[DIALOG_PADDING] - theme.spacing[ANSWER_GAP]) / 2;
  const labelRoom = answerWidth - 2 * theme.spacing[BUTTON_LABEL_INSET];

  const fontSize = theme.typography.variants.button.fontSize ?? theme.typography.fontSize.lg;
  const characterWidth = fontSize * windowSize.fontScale * LABEL_EM_PER_CHARACTER;

  // Code points, not UTF-16 units: a character outside the basic plane is one, not two.
  return labels.every(label => Array.from(label).length * characterWidth <= labelRoom);
}

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Defaults to `danger`: a dialog is for what deserves a second thought. */
  confirmVariant?: Exclude<ButtonVariant, 'secondary'>;
  /** The confirmed action is running: confirm is busy and nothing dismisses. */
  isConfirming?: boolean;
  confirmHint?: string;
  cancelHint?: string;
  /**
   * Overrides the dialog's own choice: `true` puts the answers one above the
   * other, each the dialog's full width, the confirming action on top and the
   * way out at the bottom; `false` keeps them side by side, the way out first. Left out — which is right almost everywhere — the dialog
   * stacks whenever a label might not fit in its half of the row at the current
   * window width and font size (`answersFitSideBySide`).
   */
  stacked?: boolean;
  testID?: string;
}

function ConfirmDialogComponent({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'danger',
  isConfirming = false,
  confirmHint,
  cancelHint,
  stacked,
  testID,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const backdropPadding = useDialogBackdropPadding(BACKDROP_PADDING);
  // The window, not the screen: split screen and a rotated phone both change it.
  const windowSize = useWindowDimensions();

  const isStacked =
    stacked ?? !answersFitSideBySide([cancelLabel, confirmLabel], windowSize, theme);

  const dismiss = isConfirming ? undefined : onCancel;

  const answerStyle = isStacked ? styles.stackedAction : styles.action;
  // Keyed, so a window change that restacks them moves these two rather than
  // rebuilding them.
  const cancelAnswer = (
    <Button
      key="cancel"
      label={cancelLabel}
      variant="secondary"
      onPress={onCancel}
      disabled={isConfirming}
      accessibilityHint={cancelHint}
      style={answerStyle}
    />
  );
  const confirmAnswer = (
    <Button
      key="confirm"
      label={confirmLabel}
      variant={confirmVariant}
      onPress={onConfirm}
      isLoading={isConfirming}
      accessibilityHint={confirmHint}
      style={answerStyle}
    />
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // The Android back button is Cancel — and does nothing mid-action.
      onRequestClose={() => dismiss?.()}>
      <View
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }, backdropPadding]}>
        {/*
          The backdrop is Cancel too, but not a stop for a screen reader: the
          Cancel button already is one, and two would be the same thing twice.
        */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          importantForAccessibility="no"
          accessibilityElementsHidden
          testID={testID ? `${testID}-backdrop` : undefined}
        />

        <View
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={[
            styles.dialog,
            {
              maxWidth: breakpoints.sm,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              padding: theme.spacing[DIALOG_PADDING],
              gap: theme.spacing.lg,
            },
          ]}
          testID={testID}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h3" accessibilityRole="header">
              {title}
            </Text>
            {message ? (
              <Text variant="body" color="textSecondary">
                {message}
              </Text>
            ) : null}
          </View>

          {/*
            Side by side, each always a full-size target. ⚠️ The row does not
            wrap for a long label, whatever `flexWrap` suggests: each button's
            basis is its 40% minimum, so two always share the row and a label
            wider than its half is cut off (found measuring "Cancel request" at
            360dp, 21/10/2026). That is why the choice to stack is made before
            layout, from the labels, rather than left to the row.
          */}
          <View
            style={[
              isStacked ? styles.stackedActions : styles.actions,
              { gap: theme.spacing[ANSWER_GAP] },
            ]}>
            {isStacked ? [confirmAnswer, cancelAnswer] : [cancelAnswer, confirmAnswer]}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  action: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '40%',
  },
  stackedActions: {
    flexDirection: 'column',
  },
  stackedAction: {
    // A definite width, the dialog's, so a label is measured against all of it.
    alignSelf: 'stretch',
  },
});

export const ConfirmDialog = memo(ConfirmDialogComponent);
