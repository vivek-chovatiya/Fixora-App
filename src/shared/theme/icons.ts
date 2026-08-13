/**
 * Icons
 *
 * The icon registry. Components reference semantic tokens (`icons.back`), never
 * raw glyph strings, so the icon set can be swapped in this one file.
 *
 * Category icons are deliberately absent. Categories are business data owned by
 * the backend, so mapping "electrician" to a glyph here would hardcode a
 * category into the app and break the zero-code-change rule. Instead the
 * backend supplies the glyph name and `resolveRemoteIcon` falls back safely
 * when it is missing or unrecognised.
 */

/** Single icon family for the whole application. */
export const ICON_SET = 'MaterialCommunityIcons';

export const icons = Object.freeze({
  // Navigation
  back: 'chevron-left',
  forward: 'chevron-right',
  up: 'chevron-up',
  down: 'chevron-down',
  close: 'close',
  menu: 'menu',
  more: 'dots-vertical',

  // Tabs
  home: 'home-outline',
  categories: 'view-grid-outline',
  requests: 'clipboard-text-outline',
  notifications: 'bell-outline',
  profile: 'account-circle-outline',
  team: 'account-group-outline',
  reports: 'chart-bar',

  // Actions
  search: 'magnify',
  filter: 'filter-variant',
  add: 'plus',
  edit: 'pencil-outline',
  remove: 'delete-outline',
  retry: 'refresh',
  send: 'send-outline',
  call: 'phone-outline',
  logout: 'logout',
  settings: 'cog-outline',
  /** Password reveal toggle. */
  visibilityOn: 'eye-outline',
  visibilityOff: 'eye-off-outline',

  // Media
  camera: 'camera-outline',
  gallery: 'image-multiple-outline',
  image: 'image-outline',
  upload: 'tray-arrow-up',

  /**
   * A chosen item in a multi-select. Distinct from `success`, which reports
   * that an operation completed — selecting something completes nothing.
   */
  selected: 'check',

  // Status and feedback
  success: 'check-circle-outline',
  warning: 'alert-outline',
  error: 'alert-circle-outline',
  info: 'information-outline',
  help: 'help-circle-outline',
  empty: 'inbox-outline',
  offline: 'wifi-off',
  pending: 'clock-outline',
  verified: 'shield-check-outline',

  // Domain-neutral
  /** A person using the app to request services. */
  customer: 'account-circle-outline',
  /** A business offering them. Not a category — categories come from the backend. */
  business: 'storefront-outline',
  location: 'map-marker-outline',
  calendar: 'calendar-outline',
  star: 'star',
  starOutline: 'star-outline',
  priority: 'flag-outline',
  document: 'file-document-outline',

  /** Rendered when a backend-supplied icon is missing or unknown. */
  fallback: 'toolbox-outline',
});

export type IconName = keyof typeof icons;

export const iconSize = Object.freeze({
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
});

export type IconSizeToken = keyof typeof iconSize;

/**
 * Resolves an icon name supplied by the backend (for example a category icon)
 * into a glyph, falling back when the value is absent or blank.
 *
 * The app intentionally does not validate the glyph against a known list —
 * doing so would require redeploying whenever a new service is added.
 */
export function resolveRemoteIcon(raw?: string | null): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : icons.fallback;
}
