/**
 * Auth domain types
 *
 * The shape of "who is signed in". Navigation, the HTTP client and both role
 * applications read from here, so it stays free of UI concerns.
 *
 * Role and approval status are decided by the backend and only mirrored here.
 * The frontend never promotes a user or approves a vendor
 * (PROJECT_BIBLE.md section 52).
 */

/** Determines which application the user sees after sign in. */
export type UserRole = 'customer' | 'vendor';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  /**
   * Optional: both roles now authenticate by phone, so a user can exist without
   * an email. Required here would force a placeholder value on every session.
   */
  email?: string;
  /** The identifier for both roles. */
  phone: string;
  /**
   * The uploaded profile picture, once there is one (PROJECT_BIBLE.md section
   * 25, Phase 3D-8).
   *
   * A remote URL and never a local file path: a `file://` URI belongs to the
   * device that picked it, so persisting one would restore a broken image on
   * the next launch and show nothing at all on another device. The local file
   * exists only between picking and a successful upload, and lives in the
   * screen's own state for exactly that long.
   */
  avatarUrl?: string;
  role: UserRole;
}

/*
 * There is deliberately no vendor approval status here.
 *
 * Vendor onboarding no longer involves manual administrator approval: verifying
 * the registration code activates the vendor automatically, and a session only
 * exists once the vendor has confirmed their permanent auth code. A vendor
 * holding a session is therefore always active, so a status field could only
 * ever hold one value.
 *
 * Onboarding progress is screen-local state during registration, not session
 * state — see PROJECT_BIBLE.md section 7A.
 */

/**
 * A established session. Defined here rather than in the slice so that services
 * and storage can depend on the auth domain without importing Redux.
 */
export interface SessionPayload {
  token: string;
  user: AuthUser;
}

/**
 * `bootstrapping` covers the startup window while the stored session is read.
 * Splitting it from `unauthenticated` is what stops the login screen flashing
 * for a fraction of a second before a restored session resolves.
 */
export type AuthStatus = 'bootstrapping' | 'unauthenticated' | 'authenticated';

export function getFullName(user: AuthUser): string {
  return `${user.firstName} ${user.lastName}`.trim();
}
