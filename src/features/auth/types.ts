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

/**
 * Vendor onboarding state (PROJECT_BIBLE.md section 29). A vendor must not
 * receive service requests until approved.
 */
export type VendorApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  /** Vendors only. Always undefined for customers. */
  vendorApproval?: VendorApprovalStatus;
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
