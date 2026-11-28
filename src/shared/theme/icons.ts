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
  /**
   * Movement, where `forward` is position.
   *
   * A chevron points at what is next to it — the end of a row, the edge of a
   * card. An arrow says the thing it sits on takes you somewhere, which is what
   * a submit button does and what a chevron on one reads as slightly wrong.
   */
  arrowForward: 'arrow-right',
  close: 'close',
  menu: 'menu',
  // Horizontal by the owner's choice (28/11/2026), for the notifications menu button.
  more: 'dots-horizontal',

  // Tabs
  home: 'home-outline',
  categories: 'view-grid-outline',
  requests: 'clipboard-text-outline',
  notifications: 'bell-outline',
  profile: 'account-circle-outline',
  team: 'account-group-outline',
  reports: 'chart-bar',

  /*
   * Tabs — selected.
   *
   * A filled counterpart for every glyph the tab bars actually use, so the
   * selected tab differs in shape and not only in colour. Colour alone fails
   * PROJECT_BIBLE.md section 46: it is invisible to a monochrome display, to
   * most colour-vision deficiencies, and in bright sunlight.
   *
   * Only the four real tabs have one. The rest of the group above appears in
   * headers and buttons, where nothing is ever "selected".
   */
  homeSelected: 'home',
  requestsSelected: 'clipboard-text',
  profileSelected: 'account-circle',
  teamSelected: 'account-group',

  // Actions
  search: 'magnify',
  filter: 'filter-variant',
  add: 'plus',
  edit: 'pencil-outline',
  remove: 'delete-outline',
  retry: 'refresh',
  /**
   * Marking every notification as read. Two ticks rather than `selected`'s one:
   * it acts on the whole list, and choosing one item is a different gesture.
   */
  markAllRead: 'check-all',
  /**
   * Putting something on the clipboard.
   *
   * Distinct from `document`, which is a file. The copy action borrowed that one
   * and read as "open the paperwork" rather than "take a copy of this" — seen on
   * the request-sent screen, where the control sits beside a reference number.
   */
  copy: 'content-copy',
  send: 'send-outline',
  call: 'phone-outline',
  logout: 'logout',
  settings: 'cog-outline',
  /**
   * The app's language (Phase 5, 28/11/2026, approved by the owner's lead). It
   * replaced `settings` on the Language row, where a cog read as "app settings"
   * rather than "the language this app speaks".
   */
  language: 'translate',
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

  /**
   * Answering a request (PROJECT_BIBLE.md section 33). Their own names, not
   * `selected` and `close`: taking a job is not choosing an option, and
   * declining one is not dismissing a sheet — and the glyphs can change apart.
   */
  accept: 'check',
  reject: 'close-circle-outline',
  /**
   * A request called off (section 42's "Cancelled Requests"). Not `reject`:
   * the vendor declining and the job being cancelled are different outcomes,
   * and on the report they sit side by side, so they differ in shape too.
   */
  cancelled: 'cancel',

  /** Moving accepted work along (sections 35 and 36). */
  startWork: 'play-circle-outline',
  completeWork: 'check-circle-outline',

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
