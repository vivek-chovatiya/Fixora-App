/**
 * PermissionService
 *
 * The only route to a device permission.
 *
 * Screens must never import a permission library or touch a platform API, for
 * the same reason they never import axios: the boundary is what makes the UI
 * testable without a native dialog, and what keeps a platform difference from
 * spreading into a screen.
 *
 * Permissions are named by what the app wants to do, not by the constant the
 * platform happens to use. `location` is one idea; ACCESS_FINE_LOCATION and
 * LOCATION_WHEN_IN_USE are two spellings of it, and which one applies is the
 * implementation's business.
 */

/** What the app is asking for, in the app's own vocabulary. */
export type PermissionKind = 'location' | 'camera' | 'notifications';

/**
 * The outcome, reduced to the four cases a caller can actually act on.
 *
 * `limited` is deliberately absent: the platform reports it when the user grants
 * partial access, which for every use here means the app may proceed. Callers
 * that later need the distinction should get a richer type then, rather than a
 * fifth case nothing branches on now.
 */
export type PermissionStatus =
  /** The app may proceed. */
  | 'granted'
  /** Refused this time. Asking again later is allowed. */
  | 'denied'
  /**
   * Refused permanently, or restricted by policy. The system will no longer show
   * a dialog, so asking again does nothing and only Settings can change it.
   */
  | 'blocked'
  /** Not supported on this device or build. Nothing to ask for. */
  | 'unavailable';

export interface PermissionService {
  /** Reads the current state without prompting. */
  check(kind: PermissionKind): Promise<PermissionStatus>;
  /**
   * Prompts, if the platform still will.
   *
   * Resolves `blocked` rather than throwing when it will not, so a caller can
   * tell "the user said no" from "the user cannot be asked".
   */
  request(kind: PermissionKind): Promise<PermissionStatus>;
  /** Opens the app's settings page, the only route out of `blocked`. */
  openSettings(): Promise<void>;
}
