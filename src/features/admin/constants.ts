/**
 * Admin feature constants.
 *
 * Category icon suggestions shown in the admin icon picker. These are glyph
 * names only (not categories) — the backend still owns which categories exist,
 * and an admin can still type any MaterialCommunityIcons name.
 */
export const CATEGORY_ICON_SUGGESTIONS = [
  'flash',
  'pipe-wrench',
  'air-conditioner',
  'washing-machine',
  'fridge-outline',
  'hammer-wrench',
  'broom',
  'spray-bottle',
  'format-paint',
  'bug-outline',
  'water-pump',
  'lightbulb-outline',
  'fan',
  'sofa-outline',
  'door',
  'toilet',
  'shower-head',
  'home-automation',
  'leaf',
  'television',
  'cctv',
  'key-variant',
  'car-wrench',
  'tools',
] as const;

/** Admin pages stay readable on wide desktop monitors. */
export const ADMIN_CONTENT_MAX_WIDTH = 1120;

/** Reasons an admin can pick when rejecting or suspending a provider. */
export const VENDOR_REJECTION_REASONS = ['Documents could not be verified', 'Incomplete business details', 'Service area not supported'] as const;
