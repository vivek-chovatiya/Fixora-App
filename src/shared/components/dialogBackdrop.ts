/**
 * dialogBackdrop
 *
 * The padding between the window's edges and a dialog drawn on the platform
 * `Modal`, shared by `ConfirmDialog` and the vendor's `TimeChoiceDialog`, the
 * two dialogs built on that shell — and by `OptionsSheet` (28/11/2026), which
 * takes the top edge for its backdrop and the bottom one inside its own
 * surface, so the sheet's fill still reaches the bottom of the window.
 *
 * It exists because a `statusBarTranslucent` modal is the whole window: its
 * backdrop runs up behind the status bar and down behind the gesture bar, and a
 * dialog that may grow to the backdrop's height went with it. The time list on
 * Working hours is that tall — on a Pixel 7 its title was drawn under the
 * status bar (title bounds y 105–174px against a 136px bar, 21/10/2026). So the
 * system bars' insets are added to the spacing token on the top and bottom
 * edges, and the dialog keeps to the part of the window nothing covers.
 *
 * ⚠️ The insets are the navigators' provider's, not the window's, because that
 * is the provider every screen — and so every dialog — sits under (AppRoot).
 * While the offline banner shows, that provider starts below it and reports no
 * top inset at all: the banner has already paid it. The window offset (the
 * banner's height) is added back for exactly that case. Online it is zero and
 * the sum is the status bar; offline it is the banner, which is taller than the
 * bar, so the dialog stays clear of both. Never the inset alone.
 *
 * The sides take the token only. A dialog never reaches them where a system bar
 * or a cutout is: it is capped at `breakpoints.sm` and centred, and the only
 * windows with side insets are landscape ones, far wider than that cap.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWindowOffset } from '@/shared/components/windowOffset';
import { useTheme, type SpacingToken } from '@/shared/theme';

export interface DialogBackdropPadding {
  paddingTop: number;
  paddingBottom: number;
  paddingHorizontal: number;
}

/** The backdrop's padding: `padding` on every edge, plus what covers the top and bottom. */
export function useDialogBackdropPadding(padding: SpacingToken): DialogBackdropPadding {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const windowOffset = useWindowOffset();
  const edge = theme.spacing[padding];

  return {
    paddingTop: edge + insets.top + windowOffset,
    paddingBottom: edge + insets.bottom,
    paddingHorizontal: edge,
  };
}
