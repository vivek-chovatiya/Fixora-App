/**
 * Colors
 *
 * Semantic color tokens. Components consume meaning ("danger", "textSecondary"),
 * never raw hex values, so dark mode and future rebrands require no component
 * changes.
 *
 * Business values never appear here. A request status is domain data, so the
 * request module maps status -> tone, and this file only supplies the tones.
 */

/** Raw scale. Private to this file — never import this directly. */
const palette = {
  blue600: '#1D4ED8',
  blue500: '#2563EB',
  blue400: '#3B82F6',
  /** Ink on blue950 in dark: `onInfoSubtle` (3G-4). */
  blue300: '#93C5FD',
  blue100: '#DBEAFE',
  blue950: '#172554',

  /** Ink on green100 in light: `onSuccessSubtle` (3G-4). */
  green700: '#166534',
  green500: '#16A34A',
  /** Ink on green950 in dark: `onSuccessSubtle` (3G-4). */
  green400: '#4ADE80',
  green100: '#DCFCE7',
  green950: '#052E16',

  /** Ink on amber100 in light: `onWarningSubtle` (3G-4). */
  amber700: '#92400E',
  amber500: '#D97706',
  /** Ink on amber950 in dark: `onWarningSubtle` (3G-4). */
  amber400: '#FBBF24',
  amber100: '#FEF3C7',
  amber950: '#451A03',

  /*
    The steps around red500 exist for two buttons (Phase 3G-4, 21/10/2026): a
    press on the filled danger button, and the quieter tonal one — its ink in
    each theme and its pressed fill. Ratios are recorded on the tokens.
  */
  red700: '#991B1B',
  red600: '#B91C1C',
  red500: '#DC2626',
  red300: '#FCA5A5',
  red200: '#FECACA',
  red100: '#FEE2E2',
  red800: '#7F1D1D',
  red950: '#450A0A',

  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  /**
   * A step between 400 and 500, for tertiary text on a dark background.
   * gray500 is legible enough on white but falls to 3.0:1 against the dark
   * surfaces, and gray400 is already spoken for by secondary text.
   */
  gray450: '#8A94A3',
  gray500: '#6B7280',
  /**
   * A step between 500 and 600, for tertiary text on a light background.
   * gray500 clears the contrast floor on white but not on the tinted fill of a
   * disabled input, and gray600 is already spoken for by secondary text.
   */
  gray550: '#5B6472',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  gray950: '#030712',
  black: '#000000',
} as const;

export interface ColorTokens {
  /** Screen background. */
  background: string;
  /** Cards, sheets, inputs — raised above background. */
  surface: string;
  /** Subtle fills: disabled inputs, skeletons, pressed rows. */
  surfaceAlt: string;

  border: string;
  borderStrong: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  /** Text placed on a filled brand or status surface. */
  textInverse: string;

  primary: string;
  primaryPressed: string;
  primarySubtle: string;
  /**
   * Text and icons on `primarySubtle` — a selected chip's glyph, an avatar's
   * initials, the glyph in a tinted disc, the words on a tinted card (3G-4).
   * 5.5:1 in light, 8.2:1 in dark — the same values as `onInfoSubtle`,
   * because the two tints are the same values; named apart so either can
   * move alone.
   *
   * ⚠️ Only on its own tint. `primary` itself is 4.2:1 there in light and
   * 4.0:1 in dark — short of 4.5:1 for words.
   */
  onPrimarySubtle: string;
  onPrimary: string;

  success: string;
  successSubtle: string;
  /**
   * Text and icons on `successSubtle` — a success badge's words (3G-4).
   * 6.5:1 in light (a darker green), 8.6:1 in dark (a lighter one).
   *
   * ⚠️ Only on its own tint. `success` itself is 3.0:1 there in light — the
   * reason this exists — and this token on any other ground is unmeasured.
   */
  onSuccessSubtle: string;
  warning: string;
  warningSubtle: string;
  /**
   * Text and icons on `warningSubtle` — a warning badge's words (3G-4).
   * 6.4:1 in light (a dark amber), 9.0:1 in dark (a light one).
   *
   * ⚠️ Only on its own tint. `warning` itself is 2.9:1 there in light; and
   * this token is not for the `warning` notices drawn on `surface` or the page.
   */
  onWarningSubtle: string;
  danger: string;
  /**
   * A `danger` fill under a finger — the filled danger button's press. One
   * step darker in both themes, as `primaryPressed` is; `onDanger` on it is
   * 6.5:1, and it is 1.3:1 against `danger` itself, the same step the primary
   * button takes. Before it, a pressed danger button showed no change at all.
   */
  dangerPressed: string;
  /**
   * The quiet danger tint: a danger badge's ground, and the tonal danger
   * button's fill (`dangerSecondary`, Phase 3G-4).
   */
  dangerSubtle: string;
  /**
   * `dangerSubtle` under a finger — the tonal danger button's press. One step
   * stronger: 1.38:1 against the page (`background`) in light and 2.01:1 in
   * dark, where the resting tint is 1.17:1 and 1.25:1 (the secondary button's
   * grey is 1.05:1 and 1.37:1; the tint is told apart by its hue and its red
   * words as much as by its lightness).
   */
  dangerSubtlePressed: string;
  /**
   * Text on a `danger` fill — the unread badge, and the danger button's label
   * and icon. White in both themes (4.8:1 on red500); `textInverse` is
   * near-black in dark mode and only 4.2:1.
   */
  onDanger: string;
  /**
   * Text on `dangerSubtle` and `dangerSubtlePressed` — the tonal danger
   * button's label, icon and spinner, and a danger badge's words.
   *
   * ⚠️ Not `danger`: red500 on its own tint is 3.9:1 in light and 3.3:1 in
   * dark, under the 4.5:1 a 16sp label needs. A darker red in light (6.8:1 at
   * rest, 5.7:1 pressed) and a lighter one in dark (8.5:1 and 5.3:1) — the
   * pair moves the opposite way to the fill, as `onPrimary` cannot.
   */
  onDangerSubtle: string;
  info: string;
  infoSubtle: string;
  /**
   * Text and icons on `infoSubtle` — an info badge's words (3G-4). 5.5:1 in
   * light (blue600, `primaryPressed`'s own value there), 8.2:1 in dark.
   *
   * ⚠️ Only on its own tint. `info` itself is 4.2:1 there in light and 4.0:1
   * in dark. Not `primaryPressed` either, although it matches in light: in
   * dark that is blue500, 2.8:1 on the tint.
   */
  onInfoSubtle: string;
  /** Neutral tone for inert states. */
  neutral: string;
  neutralSubtle: string;

  /** Scrim behind modals and bottom sheets. */
  overlay: string;
  /**
   * Text and icons drawn directly on `overlay` — light in both themes, because
   * the scrim is dark in both. Not `textInverse`: that is dark in dark mode,
   * and on the scrim it all but disappeared (request photo tiles, found in
   * the 20/10/2026 shop-images slice).
   */
  onOverlay: string;
  skeleton: string;
  shadow: string;
}

export const lightColors: ColorTokens = {
  background: palette.gray50,
  surface: palette.white,
  surfaceAlt: palette.gray100,

  border: palette.gray200,
  borderStrong: palette.gray300,

  textPrimary: palette.gray900,
  textSecondary: palette.gray600,
  /**
   * Not gray500, which reads at 4.4:1 on surfaceAlt — the fill behind a
   * disabled input, and so exactly where placeholders and helper text land.
   * Darkening to gray600 would have cleared it too, but gray600 is what
   * secondary text uses: tertiary would have become the same color, and every
   * place that deliberately separates the two would have lost the distinction.
   * The midpoint keeps three visible tiers and clears the floor on all three
   * light surfaces.
   */
  textTertiary: palette.gray550,
  textDisabled: palette.gray400,
  textInverse: palette.white,

  primary: palette.blue500,
  primaryPressed: palette.blue600,
  primarySubtle: palette.blue100,
  onPrimarySubtle: palette.blue600,
  onPrimary: palette.white,

  success: palette.green500,
  successSubtle: palette.green100,
  onSuccessSubtle: palette.green700,
  warning: palette.amber500,
  warningSubtle: palette.amber100,
  onWarningSubtle: palette.amber700,
  danger: palette.red500,
  dangerPressed: palette.red600,
  dangerSubtle: palette.red100,
  dangerSubtlePressed: palette.red200,
  onDanger: palette.white,
  onDangerSubtle: palette.red700,
  info: palette.blue500,
  infoSubtle: palette.blue100,
  onInfoSubtle: palette.blue600,
  neutral: palette.gray500,
  neutralSubtle: palette.gray100,

  overlay: 'rgba(3, 7, 18, 0.5)',
  onOverlay: palette.white,
  skeleton: palette.gray200,
  shadow: palette.black,
};

export const darkColors: ColorTokens = {
  background: palette.gray950,
  surface: palette.gray900,
  surfaceAlt: palette.gray800,

  border: palette.gray800,
  borderStrong: palette.gray700,

  textPrimary: palette.gray50,
  textSecondary: palette.gray400,
  /**
   * The dark counterpart to gray550, and derived the same way. gray500 sat here
   * first and left placeholders, helper text, captions and section overlines at
   * 4.2:1 on the page background and 3.0:1 on a disabled input — under the 4.5:1
   * needed for normal text, and worst exactly where the text is smallest. One
   * step lighter clears it on all three dark surfaces while staying a step below
   * secondary.
   */
  textTertiary: palette.gray450,
  textDisabled: palette.gray600,
  textInverse: palette.gray950,

  primary: palette.blue400,
  primaryPressed: palette.blue500,
  primarySubtle: palette.blue950,
  onPrimarySubtle: palette.blue300,
  onPrimary: palette.white,

  success: palette.green500,
  successSubtle: palette.green950,
  onSuccessSubtle: palette.green400,
  warning: palette.amber500,
  warningSubtle: palette.amber950,
  onWarningSubtle: palette.amber400,
  danger: palette.red500,
  dangerPressed: palette.red600,
  dangerSubtle: palette.red950,
  dangerSubtlePressed: palette.red800,
  onDanger: palette.white,
  onDangerSubtle: palette.red300,
  info: palette.blue400,
  infoSubtle: palette.blue950,
  onInfoSubtle: palette.blue300,
  neutral: palette.gray400,
  neutralSubtle: palette.gray800,

  overlay: 'rgba(0, 0, 0, 0.65)',
  onOverlay: palette.white,
  skeleton: palette.gray800,
  shadow: palette.black,
};

/**
 * Semantic tone shared by StatusBadge, alerts and any component that varies by
 * intent. Modules map their domain values onto a tone rather than a color.
 */
export type ColorTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

/** A tone's quiet tint: the fill of a badge, a notice, a disc behind a glyph. */
export type SubtleTint = `${ColorTone}Subtle`;

/**
 * The ink for anything drawn on a subtle tint — words and glyphs alike
 * (owner's rule, 21/10/2026, Phase 3G-4).
 *
 * ⚠️ One rule: text or an icon drawn on a `…Subtle` tint uses that tint's own
 * ink, never the tone's base colour, which falls under 4.5:1 on its own tint
 * in at least one theme (2.9–4.4:1). Neutral has no `on…` token of its own:
 * its ink is `textSecondary`, the same grey family. A component whose tint
 * depends on a tone looks its ink up here; `__tests__/shared/theme` holds
 * every pair to 4.5:1 in both themes.
 */
export const SUBTLE_INK: Readonly<Record<SubtleTint, keyof ColorTokens>> = Object.freeze({
  primarySubtle: 'onPrimarySubtle',
  infoSubtle: 'onInfoSubtle',
  successSubtle: 'onSuccessSubtle',
  warningSubtle: 'onWarningSubtle',
  dangerSubtle: 'onDangerSubtle',
  neutralSubtle: 'textSecondary',
});
