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
  blue100: '#DBEAFE',
  blue950: '#172554',

  green500: '#16A34A',
  green100: '#DCFCE7',
  green950: '#052E16',

  amber500: '#D97706',
  amber100: '#FEF3C7',
  amber950: '#451A03',

  red500: '#DC2626',
  red100: '#FEE2E2',
  red950: '#450A0A',

  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
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
  onPrimary: string;

  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  danger: string;
  dangerSubtle: string;
  info: string;
  infoSubtle: string;
  /** Neutral tone for inert states. */
  neutral: string;
  neutralSubtle: string;

  /** Scrim behind modals and bottom sheets. */
  overlay: string;
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
  textTertiary: palette.gray500,
  textDisabled: palette.gray400,
  textInverse: palette.white,

  primary: palette.blue500,
  primaryPressed: palette.blue600,
  primarySubtle: palette.blue100,
  onPrimary: palette.white,

  success: palette.green500,
  successSubtle: palette.green100,
  warning: palette.amber500,
  warningSubtle: palette.amber100,
  danger: palette.red500,
  dangerSubtle: palette.red100,
  info: palette.blue500,
  infoSubtle: palette.blue100,
  neutral: palette.gray500,
  neutralSubtle: palette.gray100,

  overlay: 'rgba(3, 7, 18, 0.5)',
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
  textTertiary: palette.gray500,
  textDisabled: palette.gray600,
  textInverse: palette.gray950,

  primary: palette.blue400,
  primaryPressed: palette.blue500,
  primarySubtle: palette.blue950,
  onPrimary: palette.white,

  success: palette.green500,
  successSubtle: palette.green950,
  warning: palette.amber500,
  warningSubtle: palette.amber950,
  danger: palette.red500,
  dangerSubtle: palette.red950,
  info: palette.blue400,
  infoSubtle: palette.blue950,
  neutral: palette.gray400,
  neutralSubtle: palette.gray800,

  overlay: 'rgba(0, 0, 0, 0.65)',
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
