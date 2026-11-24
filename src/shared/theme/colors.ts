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
  blue700: '#1D4ED8',
  blue600: '#2563EB',
  blue400: '#60A5FA',
  blue50: '#EFF6FF',
  blue950: '#172554',

  green600: '#16A34A',
  green700: '#15803D',
  green50: '#F0FDF4',
  green950: '#052E16',

  amber600: '#D97706',
  amber700: '#B45309',
  amber50: '#FFFBEB',
  amber950: '#451A03',

  red600: '#DC2626',
  red700: '#B91C1C',
  red50: '#FEF2F2',
  red950: '#450A0A',

  white: '#FFFFFF',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  slate950: '#020617',
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
  background: palette.slate50,
  surface: palette.white,
  surfaceAlt: palette.slate100,

  border: palette.slate200,
  borderStrong: palette.slate300,

  textPrimary: palette.slate900,
  textSecondary: palette.slate600,
  textTertiary: palette.slate500,
  textDisabled: palette.slate400,
  textInverse: palette.white,

  primary: palette.blue600,
  primaryPressed: palette.blue700,
  primarySubtle: palette.blue50,
  onPrimary: palette.white,

  success: palette.green700,
  successSubtle: palette.green50,
  warning: palette.amber700,
  warningSubtle: palette.amber50,
  danger: palette.red600,
  dangerSubtle: palette.red50,
  info: palette.blue600,
  infoSubtle: palette.blue50,
  neutral: palette.slate500,
  neutralSubtle: palette.slate100,

  overlay: 'rgba(2, 6, 23, 0.5)',
  skeleton: palette.slate200,
  shadow: palette.slate900,
};

export const darkColors: ColorTokens = {
  background: palette.slate950,
  surface: palette.slate900,
  surfaceAlt: palette.slate800,

  border: palette.slate800,
  borderStrong: palette.slate700,

  textPrimary: palette.slate50,
  textSecondary: palette.slate400,
  textTertiary: palette.slate500,
  textDisabled: palette.slate600,
  textInverse: palette.slate950,

  primary: palette.blue400,
  primaryPressed: palette.blue600,
  primarySubtle: palette.blue950,
  onPrimary: palette.slate950,

  success: palette.green600,
  successSubtle: palette.green950,
  warning: palette.amber600,
  warningSubtle: palette.amber950,
  danger: palette.red600,
  dangerSubtle: palette.red950,
  info: palette.blue400,
  infoSubtle: palette.blue950,
  neutral: palette.slate400,
  neutralSubtle: palette.slate800,

  overlay: 'rgba(0, 0, 0, 0.65)',
  skeleton: palette.slate800,
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
